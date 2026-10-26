// functions/api/feed.js
// ---------------------------------------------------------------------------
// Cloudflare Pages Function —— 按 host + tab 分发的信息流端点
// 路由：/api/feed?tab=<tabId>[&srcLang=fr][&city=北京][&limit=40]
//
// v2.4 架构变更（这一版是重写，不是小改）：
//   旧版  /api/feed?cat=热搜,娱乐,天气   —— 按「类目」分发，前端自己拼类目名
//   新版  /api/feed?tab=brief            —— 按「站点配置的 tab」分发
//
// 为什么必须改成 tab：
//   1. 三个子域名共用同一份代码，但每个站的 tab 组合完全不同
//      （ai 站有 models/chips/papers，news 站有 top/biz/region）。
//      用 cat 表达不了「这个站要哪几个 tab」，用 tab 才行 —— tab 就是 hosts.js
//      里的配置项，一一对应，加 tab 不用改前端。
//   2. tab 自带「每个 tab 用哪些源」的声明，取数逻辑收敛在 sources.js 一处。
//      前端不再需要知道「chips 该拉哪个源」。
//   3. 未知 tab 回落到该站第一个 tab，而不是像旧版那样回落成「全部类目」
//      —— 后者在 ai 站会拉一堆境内热搜出来，语义完全错。
//
// 保留 city/lat/lon：天气和市场源需要定位。
// ---------------------------------------------------------------------------

import { guard, apiHeaders } from "./_guard.js";
import { resolveHost, HOSTS, MAIN_HOST } from "../_lib/hosts.js";
import { fetchBySources } from "../_lib/sources.js";

// 三层缓存，从快到慢：
//
//   L1  模块级 Map —— 零网络开销，同 isolate 内亚毫秒命中。
//   L2  caches.default 短TTL(60s) —— **跨 isolate 共享**。这一层是 2026-10-22 加的，
//       起因是实测到同一个 tab 连续两次请求耗时 1.4s / 23.4s：
//       15 秒 TTL 的 Map 只在一个 isolate 内有效，而 Pages 会随时回收 isolate、
//       新建冷 isolate。冷 isolate 上 L1 全空，于是每个请求都要重新抓上游，
//       表现为「同一个 URL 有时秒回，有时白屏二十多秒」。
//   L3  真抓上游 —— 有 SOURCE_DEADLINE 兜底，最坏 11s（见 budget.js）。
const cache = new Map();
const CACHE_TTL = 15000;

function setL1Cache(key, items) {
  cache.set(key, { t: Date.now(), items });
  if (cache.size > 200) {
    const now = Date.now();
    for (const [k, v] of cache) {
      if (now - v.t > CACHE_TTL) cache.delete(k);
    }
  }
}

// L2 边缘缓存 TTL。设定为 1 小时（3600 秒）：
// 同一 PoP 边缘节点在此期间内的所有访客直接命中缓存，
// 只有过期后的首位访客触发后台异步更新。
const EDGE_TTL = 3600;

// ---------------------------------------------------------------------------
// 陈旧兜底快照（stale-while-error）
//
// 2026-10-22 第二次线上事故的真正解药。
//
// 现象：Cloudflare 边缘 IP 访问 news.google.com 会**间歇性**失败 ——
// 同一分钟里 biz tab 拿到 15 条 Reuters/Bloomberg，models tab 却跑满
// 11 秒双轮超时后返回 count:0。用户看到的是「有的 tab 有图，有的 tab 全白」。
//
// 为什么「空结果不缓存」还不够：
//   不缓存确实避免了「一次失败放大成一分钟白屏」，但同时也意味着
//   **每一次上游抖动，用户都要实打实干等 11 秒**然后看一个空白 tab。
//   对一个信息聚合站来说，白屏比旧数据糟糕得多 —— 用户要的是「有内容」，
//   哪怕是 20 分钟前的。
//
// 所以维护两份边缘缓存，用 URL 前缀区分（Cache API 的 match 不按 TTL 过滤，
// 只能靠不同的 key 来分开）：
//
//   /__f60?…   新鲜层，TTL 60s   —— 正常读取路径
//   /__s86400?… 兜底层，TTL 24h  —— 只在「新鲜层没有」且「本次抓取失败」时读
//
// 抓取成功 → 两份都刷新；抓取失败 → 用兜底层的旧快照，响应里标 stale:true。
// 关键约束：**兜底层只在有非空数据时才写**，绝不让一次失败污染兜底。
// ---------------------------------------------------------------------------
const STALE_TTL = 86400;

function edgeKey(request, host, tabId, opts) {
  // 用完整的查询串做 key：城市经纬度 / 语种 / limit 都会改变结果。
  // 注意 host 要单独带上：三个子域名共用同一个 Pages 项目，
  // 不同 host 下同名 tab（ai 站的 all 和主站的 ai）源组合完全不同。
  // 这里的 host 一律传**裸域**（conf.host）：www 与裸域是同一个站，
  // 传原始 host 会让同一份数据在边缘存两份，白白多抓一次上游。
  const u = new URL(request.url);
  const q = u.search;
  return `https://${host}/__edge${tabId}${q}`;
}

/** 新鲜层 / 兜底层的两个 key。靠 path 前缀区分，Cache API 才能分别设 TTL。 */
function edgeKeys(request, host, tabId) {
  const base = edgeKey(request, host, tabId);
  return { fresh: base.replace("/__edge", "/__f"), stale: base.replace("/__edge", "/__s") };
}

/**
 * caches 是 Workers 运行时注入的全局。本机 node（apitest/hosttest）里根本没有这个全局，
 * 直接引用会 ReferenceError —— 所以一律用 typeof 探测，拿不到就退化成「只有 L1」。
 */
function edgeCache() {
  try {
    return typeof caches !== "undefined" && caches.default ? caches.default : null;
  } catch {
    return null;
  }
}

/** 有 data items 时才写边缘缓存 —— 空响应绝不能被缓存住 */
async function edgePut(key, payload, ttl) {
  const c = edgeCache();
  if (!c) return;
  try {
    const res = new Response(payload, {
      headers: { "content-type": "application/json; charset=utf-8" },
    });
    await c.put(new Request(key), res, { expiration: { ttlSeconds: ttl } });
  } catch {
    // 边缘缓存写失败不该影响正常响应。免费版偶发的配额/限额类错误直接吞掉。
  }
}

async function edgeGet(key) {
  const c = edgeCache();
  if (!c) return null;
  try {
    const res = await c.match(new Request(key));
    if (!res) return null;
    const j = await res.json();
    return Array.isArray(j && j.items) && j.items.length ? j.items : null;
  } catch {
    return null;
  }
}

export async function onRequest(context) {
  const { request, env } = context;

  const url = new URL(request.url);
  const { host, cfg, isPreview } = resolveHost(request);
  // 未知 host（pages.dev 预览域名）已在 resolveHost 里标了 isPreview，
  // 这里回落到主站配置，保证预览环境也有数据可看。
  const conf = cfg || HOSTS[MAIN_HOST];

  // ---- tab 解析：未知 tab 回落本站第一个 tab，而不是「全部类目」 ----
  const wantTab = url.searchParams.get("tab") || "";
  const force = url.searchParams.get("force") === "1" || url.searchParams.get("force") === "true";
  const tabs = conf.tabs || [];
  const tab = tabs.find((t) => t.id === wantTab) || tabs[0] || { id: "default", sources: [] };

  // ---- 内容语言过滤（srcLang）与界面语言（lang）是两件事 ----
  // lang   只影响前端渲染文案，不参与取数
  // srcLang 可选，传了才做内容语种过滤；不传 = 该源默认的全语种
  const opts = {
    lang: url.searchParams.get("lang") || conf.defaultLang,
    srcLang: url.searchParams.get("srcLang") || "",
    city: url.searchParams.get("city") || "",
    lat: url.searchParams.get("lat"),
    lon: url.searchParams.get("lon"),
  };

  const limit = Math.min(
    Math.max(parseInt(url.searchParams.get("limit"), 10) || 60, 1),
    120,
  );

  // 缓存 key 一律用 conf.host（裸域）而不是请求里的原始 host：
  // www 与裸域是同一个站、共用同一份数据，分开算 key 等于多抓一次上游。
  const cacheKey = [conf.host, tab.id, opts.srcLang, opts.city, opts.lat, opts.lon].join("|");
  const hit = cache.get(cacheKey);
  let items;
  let stale = false;   // 本次响应是否来自「陈旧兜底」——前端会据此提示用户
  let cacheHit = false;

  // ---- 先查缓存，再谈限流 ----
  //
  // 顺序是有讲究的，不能图省事把 guard() 挪回最前面。
  // 限流器护的是**上游抓取额度**；缓存命中压根没碰上游，
  // 把它算进「真抓取」的 30 次/分桶里，页面自己的请求就会把自己 429 掉
  // （实测：一次加载 4 个请求 + 切一次界面语言 4 个，翻 8 种语言 = 36 个 > 30）。
  // 所以缓存命中走独立的宽松配额桶，但**同源校验一步都不能省** ——
  // 缓存命中也照样要挡跨站盗用。
  if (!force && hit && Date.now() - hit.t < CACHE_TTL) {
    items = hit.items;
    cacheHit = true;
  } else {
    // L2：跨 isolate 的边缘缓存。冷 isolate 上这是唯一能避免重抓上游的一层。
    const { fresh, stale: staleKey } = edgeKeys(request, conf.host, tab.id);
    const cached = !force ? await edgeGet(fresh) : null;
    if (cached) {
      items = cached;
      // 顺手回填 L1，让同 isolate 的下一个请求走零开销路径
      setL1Cache(cacheKey, items);
      cacheHit = true;
    } else {
      // 缓存没有，要真打上游了 —— 这才是限流该管的地方。
      // 注意守卫放在 fetchBySources 之前：被限流的客户端不能触发上游抓取。
      const blocked = guard(request, { private: false, label: "feed", limit: undefined, env });
      if (blocked) return blocked;

      items = await fetchBySources(tab.sources, opts, {
        topic: conf.key === "main" ? "main" : conf.key,
      });
      // 只截断到 limit；sources 里已经各自限过量
      items = items.slice(0, limit);
      // 空结果 **不进任何一层缓存**。2026-10-22 实测踩坑：上游 Google News
      // 偶发超时，抓回来 0 条也照样写缓存，于是接下来 15 秒内这个 tab 一直返回空 ——
      // 一次偶发失败被放大成一整段用户可见的空白。
      if (items.length) {
        setL1Cache(cacheKey, items);
        // 两份都写：新鲜的给正常路径，旧快照留作兜底。fire-and-forget，
        // 不 await —— 缓存写失败不该让用户多等。
        const payload = JSON.stringify({ items });
        edgePut(fresh, payload, EDGE_TTL).catch(() => {});
        edgePut(staleKey, payload, STALE_TTL).catch(() => {});
      } else {
        // 本次抓取失败（上游在 Cloudflare 边缘上抽风）。别让用户对着白屏等 11 秒，
        // 退而求其次给一份旧快照。宁可新闻旧几小时，也不能没有。
        const old = await edgeGet(staleKey);
        if (old) {
          items = old;
          stale = true;
        }
      }
    }
  }

  // 缓存命中：同源校验照做（跨站盗用要挡），但不扣「真抓取」的限流配额。
  if (cacheHit) {
    const blocked = guard(request, { private: false, label: "feed", limit: undefined, env, cacheHit: true });
    if (blocked) return blocked;
  }

  return new Response(JSON.stringify({
    ok: true,
    host,
    site: conf.key,
    tab: tab.id,
    updated: Date.now(),
    count: items.length,
    // stale=true 表示这次没能拿到实时数据，展示的是旧快照。
    // 前端据此在顶部给一条轻提示，而不是假装一切正常。
    stale,
    preview: isPreview,
    items,
  }), {
    headers: apiHeaders({
      // 预览域或强制刷新保持 no-store；正式域开启 Cloudflare CDN 边缘缓存（1小时）与后台异步刷新（10分钟）
      // 挡掉重复请求，直接节约 99% 的 Pages Functions 免费调用配额
      "Cache-Control": (isPreview || force)
        ? "no-cache, no-store"
        : "public, max-age=1800, s-maxage=3600, stale-while-revalidate=600",
    }),
  });
}