// functions/_lib/sources.js
// ---------------------------------------------------------------------------
// 数据源注册表 —— 站点配置里写的 sources: ["ai-news", ...] 在这里解析成取数函数。
//
// 设计原则：
//   1. 每个源是一个 async (opts) => card[]，返回统一的卡片结构。
//   2. 用 Promise.allSettled 并发拉，单源失败不影响整体（上游抽风是常态）。
//   3. 每张卡片带多维标签：category（类目）/ region（地域）/ sourceType（来源类型）
//      / topic（专题）/ lang（原文语言）。前端据此上色与筛选。
//
// Google News 的 source: 过滤经实测有区域性差异（2026-10 实测）：
//   en / es / fr —— source: 能精确命中本地大媒体
//   ar —— 本地媒体名匹配不上，source:France 24 有效
//   ru —— 本地媒体名匹配不上，source:Интерфакс 有效
//   因此小语种同时保留「关键词搜索」作为补充通道，避免单一通道返回空。
// ---------------------------------------------------------------------------

import { fetchJSON, fetchText, parseRssItems, parseAtomEntries, xmlPick, stripTags, dedupeBy, ago, toTs, withDeadline } from "./util.js";
import { makeGNews, GN_LANG, GN_SOURCES } from "./gnews.js";
import { SOURCE_DEADLINE, RETRY_DEADLINE, HTTP_TIMEOUT, SUB_DEADLINE } from "./budget.js";

// ---------- 通用卡片构造 ----------
function card(o) {
  return {
    category: o.category || "综合",
    title: o.title || "",
    url: o.url || "#",
    desc: o.desc || "",
    img: o.img || "",
    meta: o.meta || "",
    source: o.source || "",
    // 时间戳（epoch ms）。0 = 上游没给时间，前端把这类卡片排到末尾，
    // 不能当成 1970 年。meta 里那句话只是给人看的，排序一律用这个字段。
    ts: toTs(o.ts),
    lang: o.lang || "zh",
    region: o.region || "global",
    sourceType: o.sourceType || "web",
    topic: o.topic || "main",
    bucket: o.bucket || "",
    // 结构化标签。meta 是服务端拼好的字符串，写死一种语言；
    // 这里给「需要按语言重组文案」的源留一个出口（目前只有 Epic）。
    // 前端有 badge 就按 badge 渲染，没有才回落到 meta。
    badge: o.badge || null,
  };
}

// ---------- 卡片字段的后处理：补默认标签 ----------
// 注意：defs 是「站点级默认值」，只在该字段为空时才生效。
// 之前写成 {...o, ...defs}（defs 在后）会让站点的 region 覆盖掉源自己声明的
// region，导致 apac 之类的标签永远出不来。默认值必须放在前面。
function normalize(it, defs) {
  const c = card({ ...(defs || {}), ...it });
  if (!c.topic) c.topic = (defs && defs.topic) || "main";
  if (!c.region) c.region = (defs && defs.region) || "global";
  if (!c.sourceType) c.sourceType = (defs && defs.sourceType) || "web";
  if (!c.bucket) c.bucket = c.category;
  return c;
}

// =========================================================================
// 1. 境内源（主站用）
// =========================================================================

async function weibo(defs) {
  try {
    const d = await fetchJSON("https://v2.xxapi.cn/api/weibohot");
    if (!d || d.code !== 200) return [];
    // 热搜榜没有绝对时间，用抓取时刻代替——语义是「此刻正在热」
    const now = Date.now();
    return (d.data || []).map((x) => normalize({
      category: "境内热搜", title: x.title, url: x.url,
      meta: "🔥 " + (x.hot || ""), source: "微博", lang: "zh", ts: now,
      region: "cn", sourceType: "social", bucket: "cn",
    }, defs));
  } catch { return []; }
}

async function baidu(defs) {
  try {
    const d = await fetchJSON("https://v2.xxapi.cn/api/baiduhot");
    if (!d || d.code !== 200) return [];
    const now = Date.now();
    return (d.data || []).map((x) => normalize({
      category: "境内热搜", title: x.title, url: x.url, desc: x.desc, img: x.img,
      meta: "🔥 " + (x.hot || ""), source: "百度", lang: "zh", ts: now,
      region: "cn", sourceType: "social", bucket: "cn",
    }, defs));
  } catch { return []; }
}

async function douyin(defs) {
  try {
    const d = await fetchJSON("https://v2.xxapi.cn/api/douyinhot");
    if (!d || d.code !== 200) return [];
    const now = Date.now();
    return (d.data || []).map((x) => normalize({
      category: "娱乐", title: x.word,
      url: "https://www.douyin.com/search/" + encodeURIComponent(x.word || ""),
      meta: "🔥 " + (x.hot_value ? (x.hot_value / 10000).toFixed(0) + "万" : ""),
      source: "抖音", lang: "zh", ts: now,
      region: "cn", sourceType: "social", bucket: "fun",
    }, defs));
  } catch { return []; }
}

// =========================================================================
// 2. 生活服务源（主站简报用）
// =========================================================================

const CITY_COORDS = {
  "北京": [39.9042, 116.4074], "上海": [31.2304, 121.4737], "广州": [23.1291, 113.2644],
  "深圳": [22.5431, 114.0579], "成都": [30.5728, 104.0668], "杭州": [30.2741, 120.1551],
};
const WMO = {
  0: ["晴", "☀️"], 1: ["大致晴朗", "🌤️"], 2: ["局部多云", "⛅"], 3: ["阴", "☁️"],
  25: ["雾", "🌫️"], 45: ["雾", "🌫️"], 48: ["雾凇", "🌫️"],
  51: ["毛毛雨", "🌦️"], 53: ["毛毛雨", "🌦️"], 55: ["毛毛雨", "🌦️"],
  61: ["小雨", "🌧️"], 63: ["中雨", "🌧️"], 65: ["大雨", "🌧️"],
  71: ["小雪", "🌨️"], 73: ["中雪", "🌨️"], 75: ["大雪", "❄️"], 77: ["雪粒", "🌨️"],
  80: ["阵雨", "🌦️"], 81: ["阵雨", "🌦️"], 82: ["强阵雨", "⛈️"],
  95: ["雷阵雨", "⛈️"], 96: ["雷阵雨伴冰雹", "⛈️"], 99: ["强雷暴冰雹", "⛈️"],
};

async function weather(opts, defs) {
  const { city, lat, lon } = opts || {};
  let targets = [];
  if (lat != null && lon != null) targets = [[city || "本地", parseFloat(lat), parseFloat(lon)]];
  else if (city && CITY_COORDS[city]) targets = [[city, CITY_COORDS[city][0], CITY_COORDS[city][1]]];
  else targets = Object.keys(CITY_COORDS).slice(0, 6).map((n) => [n, CITY_COORDS[n][0], CITY_COORDS[n][1]]);
  const out = [];
  await Promise.all(targets.map(async ([name, la, lo]) => {
    try {
      const u = `https://api.open-meteo.com/v1/forecast?latitude=${la}&longitude=${lo}` +
        "&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m";
      const d = await fetchJSON(u);
      const c = d.current || {};
      const t = WMO[c.weather_code] || ["未知", "🌡️"];
      out.push(normalize({
        category: "天气", title: name + " " + t[1],
        desc: `${t[0]} ${Math.round(c.temperature_2m)}°C · 湿度 ${c.relative_humidity_2m}% · 风速 ${c.wind_speed_10m}km/h`,
        meta: name + " · Open-Meteo", source: "Open-Meteo", lang: "zh",
        ts: Date.parse(c.time || "") || Date.now(),
        region: "cn", sourceType: "service", bucket: "life",
      }, defs));
    } catch { /* 单城失败忽略 */ }
  }));
  return out;
}

// 币价源：Binance / Coinbase / Kraken 三家任选其一，先回来先用。
//
// 为什么不用单一上游（2026-10 实测）：
//   Binance 在国内网络与部分云机房直接不可达，裸 fetch 会挂到 10s 的
//   UND_ERR_CONNECT_TIMEOUT 才失败 —— 不是拒绝连接，是连接根本建不起来。
//   Coinbase / Kraken / CoinGecko 同样超时，说明是网络层封锁而非单个域名问题。
//   所以这里做成「三家并发竞速 + 3.5 秒截止」，任何一家通就用，通不了就
//   悄悄丢掉这两张卡，绝不让它拖慢整个简报页。
const CRYPTO_ENDPOINTS = [
  {
    name: "Binance", url: 'https://api.binance.com/api/v3/ticker/price?symbols=%5B%22BTCUSDT%22,%22ETHUSDT%22%5D',
    pick: (d) => (Array.isArray(d) ? d.map((t) => ({ sym: t.symbol, price: Number(t.price) })) : null)
  },
  {
    name: "Coinbase", url: "https://api.coinbase.com/v2/prices/BTC-USD/spot",
    pick: (d) => (d?.data?.amount ? [{ sym: "BTCUSDT", price: Number(d.data.amount) }] : null)
  },
  {
    name: "Kraken", url: "https://api.kraken.com/0/public/Ticker?pair=XBTUSD",
    pick: (d) => {
      const k = Object.keys(d?.result || {}).find((x) => x.startsWith("XBT"));
      const c = k ? d.result[k]?.c?.[0] : null;
      return c ? [{ sym: "BTCUSDT", price: Number(c) }] : null;
    }
  },
];

const CRYPTO_NAMES = { BTCUSDT: "比特币 BTC", ETHUSDT: "以太坊 ETH" };

async function marketCrypto(defs) {
  const tryOne = async (ep) => {
    try {
      const d = await fetchJSON(ep.url, {}, HTTP_TIMEOUT.fx);
      const rows = ep.pick(d);
      if (!rows || !rows.length) return null;
      return rows.filter((r) => r.price > 0).map((r) => normalize({
        category: "市场", title: CRYPTO_NAMES[r.sym] || r.sym,
        desc: `$${r.price.toLocaleString("en-US", { maximumFractionDigits: 2 })}`,
        meta: "🪙 加密 · " + ep.name, source: ep.name, lang: "en",
        ts: Date.now(),
        region: "global", sourceType: "market", bucket: "life",
      }, defs));
    } catch { return null; }
  };

  // 竞速：三家并发，谁先成功用谁；全挂则返回空（降级，不报错）
  // 2.5s 截止是算过的：正常情况下任意一家 300–800ms 就回，
  // 超过 2.5s 说明这台机器根本出不去，等下去对简报页毫无收益。
  const results = await Promise.all(CRYPTO_ENDPOINTS.map((ep) =>
    withDeadline(tryOne(ep), SUB_DEADLINE.fx, null)));
  const hit = results.find((r) => Array.isArray(r) && r.length);
  return hit || [];
}

async function marketFx(defs) {
  const out = [];
  try {
    const d = await fetchJSON("https://open.er-api.com/v6/latest/USD", {}, HTTP_TIMEOUT.fx);
    const r = d.rates || {};
    if (r.CNY) {
      for (const [nm, code, mul] of [["美元", "USD", 1], ["欧元", "EUR", 1], ["日元", "JPY", 100], ["英镑", "GBP", 1], ["港币", "HKD", 1]]) {
        if (r[code]) {
          out.push(normalize({
            category: "市场", title: `${nm} → 人民币`,
            desc: `1 ${code} ≈ ${(r.CNY / r[code] * mul).toFixed(code === "JPY" ? 3 : 4)} ¥`,
            meta: "💱 汇率 · Exchangerate", source: "Exchangerate", lang: "zh",
            ts: toTs(d.time_last_update_unix),
            region: "global", sourceType: "service", bucket: "life",
          }, defs));
        }
      }
    }
  } catch { /* ignore */ }
  return out;
}

// 汇率与币价互不依赖，并发拉取。
// 旧版是串行的（先汇率后币价），币价源一挂就把整个简报页拖到 7.6 秒 ——
// 实测 8 秒里 7 秒都在等一个连不上的 TCP 连接。
async function market(opts, defs) {
  const [fx, crypto] = await Promise.all([
    withDeadline(marketFx(defs), SUB_DEADLINE.market, []),
    withDeadline(marketCrypto(defs), SUB_DEADLINE.market, []),
  ]);
  return (fx || []).concat(crypto || []);
}

// ---------- Epic 免费游戏 ----------
//
// 这个源的坑比想象的多，逐条记下来（2026-10-22 实测 14 个 element）：
//
// 1. freeGamesPromotions 这个接口名字有误导性 —— 它返回的是「免费游戏区」的
//    全部条目，里面混着打折款。实测：Eternal Threads 是 20% off、
//    Castlevania 40% off、Monument Valley 35% off、LISA 55/60% off。
//    唯一能判定「真免费」的字段是 discountSetting.discountPercentage === 0。
//    旧实现只看 startDate <= now，于是把 40% off 的 Castlevania 也标成
//    「🎮 免费领取 · Epic」—— 这不是标签难看，是把打折说成免费。
//
// 2. promotions 为 null ≠ 「正在免费」。它是「长期免费区」：Them's Fightin' Herds
//    (2022)、Luftrausers、TerraScape 这些是 Epic 挂在免费区常驻的，
//    API 不给促销对象。旧代码此时 start 取默认值 0，0 <= now 恒真，
//    于是被当成「正在免费」混进列表 —— 少了一个状态维度。
//
// 3. 三态对用户的含义完全不同，卡片必须分开：
//    本周免费（不领就没）→ 即将免费（先收藏）→ 长期免费（慢慢玩）
//
// 4. URL 不能写死。真实页面路径是 /p/<pageSlug>，来自
//    catalogNs.mappings[0].pageSlug；productSlug 常为 null，不能依赖它。
//
// 5. 缩略图在 keyImages 里，type 命中顺序：OfferImageWide → Thumbnail。
//    （featuredMedia 是预告片/GalleryImage，不是封面，别用。）

const EPIC_API = "https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions";

// 从 freeGamesPromotions 的一条 element 里找出「当前生效 / 即将生效 / 常驻」
// 三种状态里的一种。真免费 = discountPercentage === 0。
function epicOfferState(e, now) {
  const P = e.promotions;
  const scan = (arr) => {
    const out = [];
    for (const grp of arr || []) {
      for (const o of grp?.promotionalOffers || []) {
        const pct = o?.discountSetting?.discountPercentage;
        const s = Date.parse(o?.startDate || "");
        const t = Date.parse(o?.endDate || "");
        // pct 必须是显式的 0：字段缺失时 pct 是 undefined，
        // undefined === 0 是 false，正好把「折扣信息不明」的条目排除掉，
        // 而不是当成免费。
        if (pct === 0 && Number.isFinite(s) && Number.isFinite(t)) out.push({ start: s, end: t });
      }
    }
    return out;
  };

  if (!P) return { state: "perma" };
  const cur = scan(P.promotionalOffers);
  const up = scan(P.upcomingPromotionalOffers);

  const live = cur.find((o) => o.start <= now && o.end > now);
  if (live) return { state: "live", start: live.start, end: live.end };

  const soon = up
    .filter((o) => o.start > now)
    .sort((a, b) => a.start - b.start)[0];
  if (soon) return { state: "soon", start: soon.start, end: soon.end };

  // 有促销对象但当下没生效：要么是过期了（不该出现），要么 upcoming 里的
  // 折扣不是 0（打折款）。两种都不该以「免费」示人。
  return { state: "none" };
}

// Epic 的 description 是 HTML，且常在「DLC」「Complete Edition」这类
// 关键词上正好被 140 字切断。把这些信息提前到 meta / badge 里，desc 只留叙事。
// 返回机器可读的 code 数组（{c: "allDlc", n: 3}），由前端按语言渲染；
// epicBundleNote() 再把同一份结果拼成中文，服务端自用与回落都一致。
function epicBundleCodes(e) {
  const raw = stripTags(e.description || "").toLowerCase();
  const out = [];
  if (/all (currently )?available dlcs?/.test(raw) || /base game and all/.test(raw)) out.push({ c: "allDlc" });
  else {
    const m = raw.match(/(\d+)\s+dlcs?/);
    if (m) out.push({ c: "dlcN", n: Number(m[1]) });
  }
  if (/complete edition/.test(raw)) out.push({ c: "edition" });
  else if (/deluxe edition/.test(raw)) out.push({ c: "deluxe" });
  if (e.categories?.some((c) => c.path === "bundles")) out.push({ c: "bundle" });
  return out;
}

const EPIC_BUNDLE_ZH = {
  allDlc: "含全部 DLC", edition: "完全版", deluxe: "豪华版", bundle: "捆绑包",
};

function epicBundleNote(e) {
  return epicBundleCodes(e)
    .map((b) => (b.c === "dlcN" ? `含 ${b.n} 个 DLC` : EPIC_BUNDLE_ZH[b.c] || ""))
    .filter(Boolean).join(" · ");
}

// fmtPrice.originalPrice 是已格式化的 "$19.99"；拿不到就用分转。
function epicPrice(e) {
  const s = e.price?.fmtPrice?.originalPrice;
  if (typeof s === "string" && /\d/.test(s)) return s;
  const cents = e.price?.totalPrice?.originalPrice;
  return Number.isFinite(cents) && cents > 0 ? `$${(cents / 100).toFixed(2)}` : "";
}

function epicDate(ts) {
  const d = new Date(ts);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

async function games(opts, defs) {
  try {
    const d = await fetchJSON(EPIC_API);
    const els = d?.data?.Catalog?.searchStore?.elements || [];
    const now = Date.now();
    const rows = [];

    for (const e of els) {
      const st = epicOfferState(e, now);
      if (st.state === "none") continue;   // 打折款 / 已过期，不进免费列表

      const slug =
        e.catalogNs?.mappings?.[0]?.pageSlug ||
        (e.productSlug ? e.productSlug.split("/")[0] : "") ||
        "";
      const url = slug ? `https://store.epicgames.com/p/${slug}` : "https://store.epicgames.com/";

      const ki = e.keyImages || [];
      const img = (ki.find((k) => k.type === "OfferImageWide") || ki.find((k) => k.type === "Thumbnail") || {}).url || "";

      const attr = {};
      for (const a of e.customAttributes || []) if (a.key) attr[a.key] = a.value;
      const studio = attr.developerName || attr.publisherName || "";
      const price = epicPrice(e);
      const bundle = epicBundleNote(e);

      let category, meta, badge, ts = now;
      if (st.state === "live") {
        category = "游戏·本周";
        const left = Math.max(0, Math.ceil((st.end - now) / 86400000));
        meta = `💰 ${price} · 至 ${epicDate(st.end)}（剩 ${left} 天）`;
        badge = { k: "live", price, date: epicDate(st.end), left, bundle: epicBundleCodes(e) };
        ts = st.start;
      } else if (st.state === "soon") {
        category = "游戏·即将";
        meta = `🔔 ${epicDate(st.start)} 起免费 · 价值 ${price}`;
        badge = { k: "soon", price, date: epicDate(st.start), bundle: epicBundleCodes(e) };
        ts = st.start;
      } else {
        category = "游戏·长期";
        meta = price ? `♾ 长期免费 · 原价 ${price}` : "♾ 长期免费";
        badge = { k: "perma", price, bundle: epicBundleCodes(e) };
        // 常驻款没有时间线，用上架时间当 ts，避免和「正在免费」抢新鲜度
        ts = toTs(e.effectiveDate) || now;
      }
      if (bundle) meta += ` · ${bundle}`;

      const descBits = [];
      if (studio) descBits.push(studio);
      const narrative = stripTags(e.description || "");
      if (narrative) descBits.push(narrative);

      rows.push({
        _sort: st.state === "live" ? 0 : st.state === "soon" ? 1 : 2,
        item: normalize({
          category, title: e.title, url, img, meta, badge,
          // stripTags 已做 \s+ 归一，截断点落在词边界上比原来的裸 slice 干净
          desc: descBits.join(" · ").slice(0, 220),
          source: "Epic", lang: "en", ts,
          region: "global", sourceType: "service", bucket: "life",
        }, defs),
      });
    }

    // 三态优先，组内按 ts 倒序。末尾补一个标题兜底：Epic 每周那几款通常
    // 共用同一个 startDate（都是周四 16:00 UTC 开领），只按 ts 排的话
    // 相对次序取决于接口返回顺序 —— 每次刷新卡片会乱跳。
    return rows
      .sort((a, b) =>
        a._sort - b._sort ||
        b.item.ts - a.item.ts ||
        String(a.item.title).localeCompare(String(b.item.title)))
      .map((r) => r.item);
  } catch { return []; }
}

async function football(opts, defs) {
  try {
    const leagues = [["bl1", "德甲"], ["eng1", "英超"], ["esp1", "西甲"], ["ita1", "意甲"]];
    const results = await Promise.all(leagues.map(async ([code, nm]) => {
      try {
        const d = await fetchJSON(`https://api.openligadb.de/getmatchdata/${code}`);
        return (d || []).slice(0, 4).map((m) => {
          const t1 = m.team1 && m.team1.teamName;
          const t2 = m.team2 && m.team2.teamName;
          let score = "即将开赛";
          let kickoff = 0;
          if (m.matchResults && m.matchResults[0]) {
            score = `${m.matchResults[0].pointsTeam1} : ${m.matchResults[0].pointsTeam2}`;
          } else if (m.matchDateTime) {
            kickoff = toTs(m.matchDateTime.replace("Z", ""));
          }
          return normalize({
            category: "足球", title: `${t1} vs ${t2}`, desc: score,
            meta: `${nm} · ${(m.group && m.group.groupName) || ""}`, source: "OpenLigaDB", lang: "en",
            ts: kickoff || Date.now(),
            region: "global", sourceType: "sports", bucket: "life",
          }, defs);
        });
      } catch { return []; }
    }));
    return results.flat();
  } catch { return []; }
}

// =========================================================================
// 3. AI 源
// =========================================================================

// HuggingFace 每日论文（一手论文源，不经媒体转述）
async function hfPapers(defs) {
  try {
    const d = await fetchJSON("https://huggingface.co/api/daily_papers?limit=20");
    return (Array.isArray(d) ? d : []).map((p) => {
      const paper = p.paper || {};
      return normalize({
        category: "AI 论文", title: paper.title || "",
        desc: (paper.summary || paper.abstract || "").replace(/\s+/g, " ").slice(0, 200),
        url: `https://huggingface.co/papers/${paper.id}`,
        meta: "🤖 " + (paper.publishedAt || "").slice(0, 10), source: "HuggingFace", lang: "en",
        ts: toTs(p.publishedAt || paper.publishedAt),
        region: "global", sourceType: "paper", bucket: "ai",
      }, defs);
    }).filter((x) => x.title);
  } catch { return []; }
}

// arXiv cs.AI / cs.LG 最新论文（比 HF 更即时）
async function arxiv(opts, defs) {
  try {
    const q = opts.arxivQuery || "cat:cs.AI+OR+cat:cs.LG";
    const u = `https://export.arxiv.org/api/query?search_query=${q}&sortBy=submittedDate&sortOrder=descending&max_results=15`;
    const xml = await fetchText(u, {}, HTTP_TIMEOUT.arxiv);
    const blocks = parseAtomEntries(xml);
    return blocks.map((b) => normalize({
      category: "AI 论文",
      title: xmlPick(b, "title").replace(/\s+/g, " "),
      desc: stripTags(xmlPick(b, "summary"), 200),
      url: xmlPick(b, "id"),
      meta: "📄 arXiv · " + ago(xmlPick(b, "published"), "en"),
      source: "arXiv", lang: "en", ts: toTs(xmlPick(b, "published")),
      region: "global", sourceType: "paper", bucket: "ai",
    }, defs)).filter((x) => x.title);
  } catch { return []; }
}

// Hacker News（技术圈风向）
async function hn(defs) {
  try {
    const ids = await fetchJSON("https://hacker-news.firebaseio.com/v0/topstories.json");
    const top = (Array.isArray(ids) ? ids : []).slice(0, 15);
    const items = await Promise.all(top.map(async (id) => {
      try {
        const it = await fetchJSON(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
        if (!it || it.type !== "story" || !it.title) return null;
        return normalize({
          category: "技术社区", title: it.title,
          url: it.url || `https://news.ycombinator.com/item?id=${id}`,
          desc: `▲ ${it.score || 0} points · ${it.descendants || 0} comments`,
          meta: "🔥 Hacker News", source: "Hacker News", lang: "en",
          ts: toTs(it.time),
          region: "global", sourceType: "community", bucket: "tech",
        }, defs);
      } catch { return null; }
    }));
    return items.filter(Boolean);
  } catch { return []; }
}

// =========================================================================
// 4. Google News 组合源
// =========================================================================

// Google News 源工厂的小包装。
// 注意两处展开顺序，必须都是「站点默认值在前、源自己的声明在后」：
//   1. 这里传给 makeGNews 的参数 —— 否则站点级 region:"global" 会盖掉源声明的
//      region:"eu"，导致「地区」Tab 的四个地区标签全部退化成 global，
//      前端地区筛选器形同虚设。
//   2. normalize() 里传给 card() 的参数（见文件头注释）。
const g = (o) => (opts, defs) => makeGNews({ ...(defs || {}), ...o })().then((items) =>
  items.map((x) => normalize(x, defs)));

// 主站简报：境内热搜（微博+百度，前端再排序取头部）
const briefCn = async (opts, defs) => {
  const [a, b] = await Promise.all([weibo(defs), baidu(defs)]);
  return dedupeBy(a.concat(b), (x) => x.title).slice(0, 12);
};
// 主站简报：国际要闻（中 + 英 + 西多语种混合，中文保障可读性，英美保障一手深度）
const briefWorld = async (opts, defs) => {
  const [zh, en, es] = await Promise.all([
    g({ lang: "zh", extra: "(国际局势 OR 联合早报 OR 路透 OR 中东 OR 美联储 OR 欧洲 OR 外交部)", strictSource: false, when: "2d", category: "国际要闻", topic: "main", limit: 6, label: "环球要闻" })(opts, defs),
    g({ lang: "en", sources: GN_SOURCES.en.slice(0, 6), when: "1d", category: "国际要闻", topic: "main", limit: 6, label: "Reuters · BBC · FT" })(opts, defs),
    g({ lang: "es", extra: "(internacional OR política OR economía)", strictSource: false, when: "2d", category: "国际要闻", topic: "main", limit: 4, label: "El País · EFE" })(opts, defs),
  ]);
  return zh.concat(en, es);
};
const briefAi = async (opts, defs) => {
  const [a, b] = await Promise.all([
    g({ lang: "en", extra: "artificial intelligence OR OpenAI OR Anthropic OR Nvidia", when: "1d", category: "AI 快讯", topic: "main", limit: 6, label: "AI News" })(opts, defs),
    g({ lang: "en", extra: "AI startup OR AI funding OR \"machine learning\"", when: "2d", category: "AI 商业", topic: "main", limit: 4, label: "AI Business" })(opts, defs),
  ]);
  return a.concat(b);
};
const briefLife = async (opts, defs) => {
  const [w, m, g2] = await Promise.all([weather(opts, defs), market(opts, defs), games(opts, defs)]);
  return w.slice(0, 2).concat(m.slice(0, 3), g2.slice(0, 2));
};

// 主站「国际」Tab 的五语种源，在 NEWS_LANGS 定义之后注册（见下方 news 章节末尾）。
// strict 与 news 站同一套结论：小语种（fr/ar/ru）不用 source: 白名单，
// 否则 fr 6 家媒体只回来 1 条、ar/ru 直接 0 条。
const funIntl = g({
  lang: "en", sources: ["Variety", "Hollywood Reporter", "The Guardian", "BBC News"],
  when: "2d", category: "娱乐", topic: "main", limit: 8, label: "Entertainment",
});

// =========================================================================
// 5. AI 专题站源
// =========================================================================
// strictSource=false 的理由（2026-10-22 实测，与 news 站 fr/ar/ru 同一结论）：
//   白名单 + 关键词 = 10 条 / 3 家媒体。5 家里 Ars Technica、VentureBeat
//   从不命中，等于写了 5 个名字只生效 3 个；limit=12 也永远凑不满。
//   放宽成纯关键词 = 100 条 / 42 家媒体，过闸门 96 条，
//   且相关性不降（Claude Duet、Walmart AI agents、AI 发现 0day 这类一手报道）。
//   质量靠 isJunkTitle 闸门兜，不靠白名单 —— 对一个 AI 新闻流来说，
//   覆盖度和时效性的价值高于「大厂一手」的比例。
const aiNews = g({
  lang: "en", extra: "AI OR OpenAI OR Anthropic OR \"AI model\"", when: "1d",
  category: "AI 产品", topic: "ai", limit: 12, label: "AI News",
  strictSource: false,
});
// 大模型：关键词已经是模型领域的专有词（LLM / benchmark / model release），
// 不需要媒体白名单来限定领域，加了反而把量压死。
const aiModels = g({
  lang: "en", extra: "\"new model\" OR \"model release\" OR LLM OR \"language model\" OR benchmark",
  when: "2d", category: "大模型", topic: "ai", limit: 12, label: "Model Releases",
  strictSource: false,
});
const aiChips = g({
  lang: "en", extra: "Nvidia OR AMD OR TPU OR HBM OR GPU OR \"AI chip\" OR datacenter",
  when: "2d", category: "芯片算力", topic: "ai", limit: 12, label: "Chips · Compute",
});
const aiBiz = g({
  lang: "en", extra: "AI startup OR \"AI funding\" OR valuation OR acquisition OR IPO OR \"AI revenue\"",
  when: "3d", category: "AI 商业", topic: "ai", limit: 12, label: "AI Business",
});
const aiIntl = async (opts, defs) => {
  const [a, b] = await Promise.all([
    g({ lang: "en", sources: ["Financial Times", "Bloomberg", "The Economist"], extra: "artificial intelligence", when: "3d", category: "AI 商业", topic: "ai", limit: 6, label: "FT · Bloomberg" })(opts, defs),
    g({ lang: "zh", sources: GN_SOURCES.zh.slice(0, 4), extra: "人工智能 OR AI 芯片", when: "2d", category: "AI 商业", topic: "ai", limit: 6, label: "中文报道" })(opts, defs),
  ]);
  return a.concat(b);
};

// =========================================================================
// 6. 国际新闻站源（news.）
// =========================================================================
// Google News source: 过滤的语言差异是硬伤，必须按语种分开处理（2026-10 实测）：
//   en —— 6 家白名单 + 关键词 → 80 条，过闸门 37 条。source: 完全可用。
//   es —— 白名单 + 关键词 → 4 条，全过闸门。可用，但量偏少。
//   fr —— 白名单 + 关键词 → 0 条；去掉 source: 只留关键词 → 100 条。
//   ar —— 白名单 + 关键词 → 0 条；只留关键词 → 100 条（半岛/BFM 等本地媒体）。
//   ru —— 6 家白名单 + 关键词 → 0 条；单个 source:Интерфакс + 关键词 → 30 条。
// 结论：小语种媒体没被完整索引进对应语种分区，死守 source: 白名单等于自杀。
// 所以给每个语种一个 strict 开关：
//   strict=true  （en / es）→ 写 source: 并做白名单硬校验，来源可信度高
//   strict=false （fr / ar / ru）→ 不写 source:，靠「本地化关键词 + 垃圾特征闸门」
//                                    保量。质量靠 isJunkTitle 兜底，不靠白名单。
const NEWS_LANGS = [
  { k: "en", hl: "en", strict: true, sources: GN_SOURCES.en.slice(0, 8), extra: "", fb: "(world OR international OR politics)" },
  { k: "es", hl: "es", strict: true, sources: GN_SOURCES.es.slice(0, 6), extra: "", fb: "(internacional OR política OR economía)" },
  { k: "fr", hl: "fr", strict: false, sources: GN_SOURCES.fr.slice(0, 6), extra: "", fb: "(international OR politique OR économie)" },
  { k: "ar", hl: "ar", strict: false, sources: ["France 24", "Reuters", "Sky News Arabia"], extra: "", fb: "(الشرق الأوسط OR اقتصاد OR سياسة)" },
  { k: "ru", hl: "ru", strict: false, sources: ["Интерфакс", "Reuters", "Euronext"], extra: "", fb: "(РБК OR Коммерсантъ OR экономика)" },
];

/**
 * 决定本次请求覆盖哪些「内容语种」。
 *
 * 这里踩过一个坑：最早直接读 opts.lang，而 opts.lang 是「界面语言」。
 * news.myinfostream.com 的 defaultLang 就是 en，于是四个非英语种全被灭掉，
 * 页面只剩英语，看起来像「抓不到西语法语新闻」，实际是参数用错了地方。
 *
 * 现在两个语义彻底分开：
 *   opts.lang    —— 界面语言（前端渲染 i18n 文案用），不参与取数
 *   opts.srcLang —— 内容语言过滤（可选）。不传 = 五语种全出（news 站的默认行为）
 *
 * 前端加「只看西语」筛选时才传 srcLang。
 */
function langParam(opts) {
  const want = (opts && opts.srcLang) || "";
  if (!want) return null;                    // 不过滤 → 调用方展开全部语种
  const hit = NEWS_LANGS.find((x) => x.k === want);
  return hit || null;
}

/** 头条：全部五语种混合 */
const newsTop = async (opts, defs) => {
  const only = langParam(opts);
  const list = only ? [only] : NEWS_LANGS;
  const all = await Promise.all(list.map((L) => Promise.all([
    g({ lang: L.hl, sources: L.sources, strictSource: L.strict, when: "1d", category: "头条", topic: "news", limit: 6, label: L.hl })(opts, defs),
    g({ lang: L.hl, extra: L.fb, when: "1d", category: "头条", topic: "news", limit: 4, label: L.hl })(opts, defs),
  ])));
  const items = all.flat(2);
  // 交错排列各语种，避免整屏全是英语
  const byLang = new Map();
  for (const it of items) {
    if (!byLang.has(it.lang)) byLang.set(it.lang, []);
    byLang.get(it.lang).push(it);
  }
  const out = [];
  const keys = [...byLang.keys()];
  let i = 0;
  while (out.length < items.length) {
    const L = keys[i % keys.length];
    const arr = byLang.get(L);
    if (arr && arr.length) out.push(arr.shift());
    if (i > items.length * 2) break;
    i++;
  }
  return dedupeBy(out, (x) => x.title);
};

function newsTopic(cat, extraByLang, when) {
  return async (opts, defs) => {
    const only = langParam(opts);
    const list = only ? [only] : NEWS_LANGS;
    const all = await Promise.all(list.map((L) => Promise.all([
      g({ lang: L.hl, sources: L.sources, strictSource: L.strict, extra: extraByLang[L.k] || "", when, category: cat, topic: "news", limit: 5, label: L.hl })(opts, defs),
      g({ lang: L.hl, extra: extraByLang[L.k] || extraByLang._, when, category: cat, topic: "news", limit: 4, label: L.hl })(opts, defs),
    ])));
    return dedupeBy(all.flat(2), (x) => x.title);
  };
}

// 财经
const newsBiz = newsTopic("财经", {
  en: "economy OR markets OR inflation OR stocks OR earnings",
  es: "economía OR mercados OR inflación OR bolsa",
  fr: "économie OR marchés OR inflation OR bourse",
  ar: "اقتصاد OR أسواق OR أسهم",
  ru: "экономика OR рынки OR инфляция OR акции",
  _: "(economy OR markets OR business)", _when: "2d",
}, "2d");

// 科技
const newsTech = newsTopic("科技", {
  en: "technology OR AI OR chips OR software OR startup",
  es: "tecnología OR inteligencia artificial OR chips",
  fr: "technologie OR intelligence artificielle OR puces",
  ar: "تكنولوجيا OR ذكاء اصطناعي",
  ru: "технологии OR искусственный интеллект",
  _: "(technology OR science OR research)", _when: "2d",
}, "2d");

// 地区：欧盟 / 中东 / 亚太 / 美洲
// region 标签必须逐个区分，否则前端地区筛选器形同虚设。
//
// 每个地区用「媒体白名单 + 地区关键词」双通道，白名单通道保证来源可信。
//
// 关键词必须按语种本地化 —— 这不是讲究，是实测逼出来的：
// Google News 按 ceid 分区（fr 站基本只能看到法语源），拿英文关键词
// `(Europe OR EU OR Brussels)` 去查 fr / ar / ru 分区，实测 16 个组合里
// 只有 en/es 出得来，fr/ar/ru 全军覆没。本地化后法语区才开始有结果。
const REGION_QUERIES = [
  {
    region: "eu", label: "欧洲",
    kw: {
      en: '(Europe OR EU OR "European Union" OR Brussels OR Ukraine)',
      es: '(Europa OR UE OR "Unión Europea" OR Ucrania OR Bruselas)',
      fr: '(Europe OR UE OR "Union européenne" OR Ukraine OR Bruxelles)',
      ar: '(أوروبا OR الاتحاد الأوروبي OR أوكرانيا OR بروكسل)',
      ru: '(Европа OR ЕС OR Европейский союз OR Украина OR Брюссель)',
    },
  },
  {
    region: "me", label: "中东",
    kw: {
      en: '("Middle East" OR Israel OR Iran OR Gaza OR Lebanon OR Gulf)',
      es: '("Oriente Medio" OR Israel OR Irán OR Gaza OR Líbano)',
      fr: '("Moyen-Orient" OR Israël OR Iran OR Gaza OR Liban)',
      ar: '(الشرق الأوسط OR إسرائيل OR إيران OR غزة OR لبنان)',
      ru: '(Ближний Восток OR Израиль OR Иран OR Газа OR Ливан)',
    },
  },
  {
    region: "apac", label: "亚太",
    kw: {
      en: '("Asia Pacific" OR China OR Japan OR Korea OR India OR ASEAN OR Taiwan)',
      es: '("Asia-Pacífico" OR China OR Japón OR Corea OR India OR Taiwán)',
      fr: '("Asie-Pacifique" OR Chine OR Japon OR Corée OR Inde OR Taïwan)',
      ar: '(آسيا والمحيط الهادئ OR الصين OR اليابان OR كوريا OR الهند OR تايوان)',
      ru: '(Азия и Тихий океан OR Китай OR Япония OR Корея OR Индия OR Тайвань)',
    },
  },
  {
    region: "am", label: "美洲",
    kw: {
      en: '(Americas OR "United States" OR Canada OR Brazil OR Mexico OR Argentina)',
      es: '(América OR "Estados Unidos" OR Canadá OR Brasil OR México OR Argentina)',
      fr: '(Amériques OR "États-Unis" OR Canada OR Brésil OR Mexique OR Argentine)',
      ar: '(الأمريكتان OR "الولايات المتحدة" OR كندا OR البرازيل OR المكسيك OR الأرجنتين)',
      ru: '(Америка OR "США" OR Канада OR Бразилия OR Мексика OR Аргентина)',
    },
  },
];
// 兼容缺语言维度的情况（理论上不会发生，双保险）
const REGION_KW_DEFAULT = '(Europe OR "Middle East" OR "Asia Pacific" OR Americas)';

const newsRegion = async (opts, defs) => {
  const only = langParam(opts);
  const langs = only ? [only] : NEWS_LANGS;
  const jobs = [];
  for (const L of langs) {
    for (const R of REGION_QUERIES) {
      jobs.push(
        // 通道 A：媒体白名单 + 地区关键词（来源可信）
        g({
          lang: L.hl, sources: L.sources, strictSource: L.strict,
          extra: R.kw[L.k] || REGION_KW_DEFAULT, when: "2d",
          category: "地区", region: R.region, topic: "news", limit: 4,
          label: R.label + " · " + L.hl,
        })(opts, defs),
      );
    }
  }
  const all = await Promise.all(jobs);
  const flat = all.flat();
  // 交错四个地区，避免某个地区刷满整屏
  const byRegion = new Map();
  for (const it of flat) {
    if (!byRegion.has(it.region)) byRegion.set(it.region, []);
    byRegion.get(it.region).push(it);
  }
  const out = [];
  const keys = [...byRegion.keys()];
  let i = 0;
  while (out.length < flat.length && i < flat.length * 2) {
    const arr = byRegion.get(keys[i % keys.length]);
    if (arr && arr.length) out.push(arr.shift());
    i++;
  }
  return dedupeBy(out, (x) => x.title);
};

// 主站「国际」Tab 的多语种源：包含中文国际要闻以及五大语种主流媒体。
// 修复核心：小语种必须带 fallback 关键词 L.fb，否则纯 when:1d 会被 Google News 返回 0 条。
const world = {
  "world-zh": g({
    lang: "zh",
    extra: "(国际局势 OR 联合早报 OR 路透 OR 中东 OR 美联储 OR 欧洲 OR 联合国)",
    strictSource: false,
    when: "2d",
    category: "国际",
    topic: "main",
    limit: 12,
    label: "环球要闻",
  }),
};
for (const L of NEWS_LANGS) {
  world["world-" + L.k] = g({
    lang: L.hl,
    sources: L.sources,
    strictSource: L.strict,
    extra: L.fb || "",
    when: "2d",
    category: "国际",
    topic: "main",
    limit: 10,
    label: L.hl,
  });
}
// =========================================================================
// 源注册表
// =========================================================================
export const SOURCES = {
  // 境内
  weibo, baidu, douyin,
  // 生活
  weather, market, games, football, hn,
  // AI
  hfPapers, arxiv,
  // 主站
  "brief-cn": briefCn,
  "brief-world": briefWorld,
  "brief-ai": briefAi,
  "brief-life": briefLife,
  "fun-cn": douyin,
  "fun-intl": funIntl,
  ...world,
  // AI 站
  "ai-news": aiNews,
  "ai-models": aiModels,
  "ai-chips": aiChips,
  "ai-biz": aiBiz,
  "ai-intl": aiIntl,
  "ai-papers": async (opts, defs) => {
    const [a, b] = await Promise.all([hfPapers(defs), arxiv(opts, defs)]);
    return a.concat(b);
  },
  // news 站：一个 tab 一个源，语种由 opts.lang 控制（不传则五语种全出）
  "news-top": newsTop,
  "news-biz": newsBiz,
  "news-tech": newsTech,
  "news-region": newsRegion,
};

export const SOURCE_IDS = Object.keys(SOURCES);

/**
 * 取数入口：按来源 id 列表并发拉取。
 *
 * 注意「一个 tab 一个源」的设计：站点配置里写 sources: ["news-top"]，
 * 而不是 ["w-en","w-es","w-fr","w-ar","w-ru"]。原因有二：
 *   1. 正确性 —— 早先把 5 个 id 都映射到同一个 newsTop，fetchBySources 会并发
 *      跑 5 遍完全相同的请求，等于自己把自己打到限流，实测 3 条就没了。
 *   2. 成本 —— 每个 tab 的上游请求数固定为「语种数 × 通道数」，可预期。
 * 语种筛选交给 opts.srcLang（见 langParam），不靠拆分 id 实现。
 * 注意区分 opts.lang（界面语言，只影响渲染文案）—— 两者不能混用，
 * 早期混用导致 news 站只剩英语内容。
 */
export async function fetchBySources(ids, opts = {}, defs = {}) {
  // 超时预算全部集中在 _lib/budget.js，这里只取用。
  // 为什么需要集中声明，见 budget.js 顶部注释：2026-10-22 一天内出了三次
  // 「内层超时 > 外层 deadline」，其中一次让 arXiv 源静默死了很久。
  //
  // 语义：单源硬上限。上游偶发抽风时，宁可这一源返回空，
  // 也不能让整个 tab 变成一个「转圈页面」。
  // 所有源并发，总耗时 ≈ 最慢的那个源，所以这个值不是「所有源之和」。
  const SOURCE_DEADLINE_MS = SOURCE_DEADLINE;

  // 跑一轮，超时即空
  const runOnce = (fn, ms) =>
    withDeadline(
      Promise.resolve().then(() => fn(opts, defs)).catch(() => []),
      ms,
      [],
    );

  // 第一轮全空才重试一次，且给更短的预算：上游若真挂了，不该让整个 tab
  // 连等两轮长超时。Google News 偶发 429、边缘冷启动慢都很常见，
  // 重试一次的成功率明显高于直接放弃。
  const fetchOne = async (fn) => {
    const first = await runOnce(fn, SOURCE_DEADLINE_MS);
    if (first.length) return first;
    return runOnce(fn, RETRY_DEADLINE);
  };

  const jobs = [];
  for (const id of ids || []) {
    const fn = SOURCES[id];
    if (!fn) continue;
    jobs.push(fetchOne(fn));
  }
  const settled = await Promise.allSettled(jobs);
  const out = [];
  for (const s of settled) {
    if (s.status === "fulfilled" && Array.isArray(s.value)) out.push(...s.value);
  }
  return dedupeBy(out, (x) => (x.title || "").trim().slice(0, 80).toLowerCase());
}

export { GN_LANG, GN_SOURCES };