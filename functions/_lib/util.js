// functions/lib/util.js
// ---------------------------------------------------------------------------
// 服务端共用小工具：带超时的抓取、XML/RSS 解析、去重、洗牌、简易内存缓存。
// 全部为无依赖实现（Workers 运行时没有 DOMParser / XMLHttpRequest）。
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 抓取三件套
//
// 2026-10-22 线上事故：AI 站「大模型 / 芯片算力 / 商业」三个 tab 全白，
// 接口有的直接跑满 11 秒返回 count:0，有的响应发到一半就再也结束不了。
// 根因在这里 —— 超时保护只覆盖了「拿到响应头」，没覆盖「读完响应体」。
//
// fetch() 的 promise 在 **响应头到达时** 就 resolve，body 还在流。
// 老写法在 fetch 返回 Response 的瞬间 clearTimeout()，等于亲手把 abort
// 保护摘掉：接下来 res.text() / res.json() 读 body 的全过程是**裸奔**的。
// 上游只要发了 header 就把 body 挂住（Google News、arXiv 从 Cloudflare
// 边缘访问时的高发形态），res.text() 就无限期挂着 —— 30 秒、60 秒都不结束。
//
// 表现之所以像「随机」，是因为它跟网络抖动强相关：
//   arXiv / Google News 源时好时坏，好的时候 1 秒出数据，坏的时候整个 tab 死。
//
// 所以下面的 fetchGuarded 把「建连 + 读 body」整个生命周期关在同一个
// AbortController 里，定时器直到 body 读完（或超时）才拆。
// ---------------------------------------------------------------------------

/**
 * 在超时保护下抓取并**读完整 body**。
 *
 * @param reader 拿到 Response 后要执行的读取动作，通常是 res.text() 或 res.json()。
 *               它在定时器仍然存活的情况下执行，所以读 body 慢也会被兜住。
 */
async function fetchGuarded(url, headers, timeout, reader) {
  const ctrl = new AbortController();
  // timeout 可能为 undefined/0（调用方没传），此时不设兜底定时器，
  // 交由上层的 withDeadline 处理 —— 但仍要把 signal 传下去，好让上层能取消。
  const id = timeout > 0 ? setTimeout(() => ctrl.abort(), timeout) : null;
  try {
    // header 合并必须大小写不敏感（2026-10-26 B 站 -352 风控踩坑）。
    //
    // 为什么不能直接 Object.assign：
    //   默认值用小写 "user-agent"，调用方（B 站/GitHub Trending 源）传的是
    //   大写 "User-Agent"。JS 对象的 key 大小写敏感，Object.assign 会把
    //   两个 key 都留下，undici 归一化时把它们**拼成一条**：
    //     user-agent: "Mozilla/5.0 (compatible; InfoStream/2.4), Mozilla/5.0 ... Chrome/122..."
    //   上游看到 UA 开头是自报爬虫标识的 InfoStream/2.4，直接判风控 ——
    //   B 站 ranking/v2 稳定返回 code:-352，列表被吞成 0 条。
    //
    // Headers.set() 本身大小写不敏感且同名即覆盖，
    // 所以传了 UA 的源拿到的是干净的单一 UA，没传的源保持原默认值。
    const h = new Headers({ "user-agent": "Mozilla/5.0 (compatible; InfoStream/2.4)" });
    for (const [k, v] of Object.entries(headers || {})) h.set(k, v);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: h,
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await reader(res);
  } finally {
    // 关键：定时器在这里才清理 —— 也就是 body 读完之后，而不是 headers 到达时。
    if (id) clearTimeout(id);
    // 主动断开上游连接，别让读完的 body 继续占着 socket。
    try { ctrl.abort(); } catch { /* 已结束 */ }
  }
}

export async function fetchRaw(url, headers, timeout = 4500) {
  // 注意：只保证「拿到 Response 对象」在超时内。调用方若还要读 body，
  // 必须用 fetchText / fetchJSON（它们把读 body 也纳入保护）。
  return await fetchGuarded(url, headers, timeout, (res) => res);
}

export async function fetchJSON(url, headers, timeout) {
  return await fetchGuarded(url, headers, timeout, (res) => {
    const ct = res.headers.get("content-type") || "";
    return ct.includes("json") ? res.json() : res.text();
  });
}

export async function fetchText(url, headers, timeout) {
  return await fetchGuarded(url, headers, timeout, (res) => res.text());
}

/**
 * 给任意 promise 加一个「硬上限」。
 *
 * 为什么需要它（2026-10 实测踩坑）：
 *   Cloudflare Workers 里单个请求默认只给 10s CPU / 子请求配额，而上游抽风时
 *   AbortController 的 abort 未必立刻生效（实测币价源 TCP connect timeout
 *   能把整个 /api/feed?tab=brief 拖到 7.6 秒）。
 *   只靠 fetchRaw 内部的 signal 不够 —— 需要在「源」这一层再兜一层：
 *   超时就降级成空数组，让这一个源消失，而不是让整个 tab 卡住。
 *
 * 注意这是「不等」而不是「取消」：超时后原请求仍在后台跑完，只是结果被丢弃。
 * 对 RSS/JSON 这种一次性拉取，这样最简单也最安全；写操作不要这么包。
 */
export function withDeadline(promise, ms, fallback = null) {
  return new Promise((resolve) => {
    let done = false;
    const id = setTimeout(() => {
      if (!done) { done = true; resolve(fallback); }
    }, ms);
    Promise.resolve(promise).then(
      (v) => { if (!done) { done = true; clearTimeout(id); resolve(v); } },
      () => { if (!done) { done = true; clearTimeout(id); resolve(fallback); } },
    );
  });
}

export function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function dedupeBy(items, keyFn) {
  const seen = new Set();
  const out = [];
  for (const it of items) {
    const k = keyFn(it);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
}

export function stripTags(s, max) {
  const t = (s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return max ? t.slice(0, max) : t;
}

export function escapeXml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

// ---------- XML / RSS 解析（正则版，够用即可） ----------

export function xmlUnescape(s) {
  return String(s == null ? "" : s)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
}

export function xmlPick(block, tag) {
  const re = new RegExp("<" + tag + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + tag + ">", "i");
  const m = block.match(re);
  return m ? xmlUnescape(m[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim()) : "";
}

export function xmlAttr(block, tag, attr) {
  const re = new RegExp("<" + tag + "\\s[^>]*" + attr + '="([^"]*)"', "i");
  const m = block.match(re);
  return m ? xmlUnescape(m[1]) : "";
}

export function parseRssItems(xml) {
  const out = [];
  const re = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = re.exec(xml)) && out.length < 60) out.push(m[1]);
  return out;
}

export function parseAtomEntries(xml) {
  const out = [];
  const re = /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi;
  let m;
  while ((m = re.exec(xml)) && out.length < 60) out.push(m[1]);
  return out;
}

// ---------- 内容质量闸门（专治 Google News 混进来的 SEO / 博彩垃圾） ----------
//
// 背景（2026-10 实测）：Google News 的 source: 过滤器不是硬过滤，只是「偏向」。
// 纯 source: OR 查询（如 `(source:Reuters OR source:"BBC News") when:1d`）会因为
// 缺少主题词而让相关性排序退化，实测能召回美国地方电视网（WAFB / WJHG / KWCH）
// 转载的同一条「宠物名字」新闻，甚至混入日本betting 站点
// （北陸地方整備局 ‍~"√((football live)) Como vs Man Utd）。
// 所以：source: 只用来构造查询，返回后必须按 <source> 实际媒体名做白名单硬校验，
// 再过一遍垃圾特征闸门。

const ZERO_WIDTH = /[\u200b-\u200f\u202a-\u202e\u2060-\u2064\ufeff]/g;
// 数学字母数字符号区（𝐋 𝑀 𝑎 𝑡 𝑐 𝑘 …）几乎只出现在博彩/引流垃圾标题里
const MATH_ALNUM = /[\u{1D400}-\u{1D7FF}]/u;

const JUNK_WORDS = new RegExp(
  [
    "betting", "\\bbet\\b", "casino", "poker", "sportsbook", "\\bodds\\b", "picks?\\b",
    "1xbet", "bet365", "betsson", " Stake", "_prediction", "tipster",
    "博彩", "彩票", "赌球", "赔率", "赌马", "时时彩", "百家乐", "老虎机",
    "كازينو", "مراهنات", "ставки", "букмекер",
  ].join("|"),
  "i",
);

/** 标题是否应被丢弃。保守起见：只拦特征极强的垃圾，不做主观判断。 */
export function isJunkTitle(title) {
  const t = String(title || "").replace(ZERO_WIDTH, "").trim();
  if (t.length < 8) return true;
  if (MATH_ALNUM.test(t)) return true;
  if (/~{2,}/.test(t)) return true;
  if (/[√∑≠≤≥⊥∫¤§¶]/.test(t)) return true;
  if (JUNK_WORDS.test(t)) return true;
  // 符号密度过高（正常新闻标题极少出现）
  const letters = (t.match(/\p{L}/gu) || []).length;
  if (letters / t.length < 0.55) return true;
  // 多个「 - 」，多半是转载站套壳
  if ((t.match(/\s-\s/g) || []).length > 1) return true;
  return false;
}

/**
 * 媒体名归一化，用于白名单比对。
 * 去掉引号/反引号/点号/空格等一切装饰字符，只留字母与数字。
 */
export function normSource(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[''`.]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

/**
 * 生成媒体名的「可接受变体」集合。
 *
 * 实测（2026-10）：Google News 的 <source> 媒体名跟 source: 查询里写的名字
 * 经常对不上，同一家媒体会返回好几种写法，直接精确比会误杀大量正规内容：
 *   白名单 "Bloomberg"    ← 实际返回 "Bloomberg.com"     （80 条里杀掉 10 条）
 *   白名单 "BBC News"     ← 实际返回 "BBC"                （杀掉 5 条）
 *   白名单 "Reuters"      ← 实际返回 "Reuters.com" / "Reuters"（两种都出现）
 *   白名单 "Le Monde"     ← 实际返回 "Le Monde"
 * 因此比对前先展开出常见变体：域名后缀（.com/.net/...）、News/The 前缀剥离。
 * 注意仍然不用「任意前缀匹配」——那会把 CNBC 判成 CNN。
 */
const SOURCE_VARIANTS = (s) => {
  const out = new Set();
  const add = (v) => { if (v && v.length >= 3) out.add(v); };

  const base = normSource(s);
  add(base);
  // 剥掉 .com / .net / .org / .co.uk 之类的域名后缀
  const noDomain = base.replace(/(com|net|org|couk|cojp|combr|io|tv|news)$/, "");
  add(noDomain);
  // 剥掉 News 前缀（BBC News -> BBC）
  add(noDomain.replace(/^(the)?news/, (m) => (m.length > 4 ? "" : m)));
  // 剥掉 The 前缀（The Guardian -> Guardian）
  add(noDomain.replace(/^the/, ""));
  return [...out];
};

/**
 * 媒体白名单硬校验。
 * 返回命中的白名单条目（原始写法），未命中返回 null。
 */
export function matchSource(actual, whitelist) {
  const a = normSource(actual);
  if (!a) return null;
  const variants = SOURCE_VARIANTS(a);
  for (const w of whitelist || []) {
    for (const v of SOURCE_VARIANTS(w)) {
      if (variants.includes(v)) return w;
    }
  }
  return null;
}

// ---------- 简易 TTL 缓存（单 isolate 内有效，够避免重复拉上游） ----------
export function makeCache(ttl) {
  const m = new Map();
  return {
    get(key) {
      const hit = m.get(key);
      return hit && Date.now() - hit.t < ttl ? hit.v : undefined;
    },
    set(key, v) {
      m.set(key, { t: Date.now(), v });
      if (m.size > 200) {
        for (const [k, val] of m) {
          if (Date.now() - val.t > ttl) m.delete(k);
        }
      }
    },
  };
}

// 相对时间：RSS 只给绝对时间，转成「3 小时前」更好读
export function ago(iso, lang) {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const s = Math.max(0, (Date.now() - t) / 1000);
  const zh = !lang || lang === "zh" || lang === "zh-Hant";
  const h = Math.floor(s / 3600);
  const m = Math.floor(s / 60) % 60;
  if (h < 1) return zh ? `${m || 1} 分钟前` : `${m || 1}m ago`;
  if (h < 24) return zh ? `${h} 小时前` : `${h}h ago`;
  return zh ? `${Math.floor(h / 24)} 天前` : `${Math.floor(h / 24)}d ago`;
}

/**
 * 把各种时间形态（ISO串 / epoch 秒 / epoch 毫秒 / 空）统一成 epoch 毫秒。
 * 没有时间就返回 0——前端据此把无时间戳的卡片排到末尾，而不是当成 1970 年。
 */
export function toTs(v) {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v > 1e11 ? v : v * 1000;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : 0;
}