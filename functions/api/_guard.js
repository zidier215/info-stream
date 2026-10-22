// functions/api/_guard.js
// ---------------------------------------------------------------------------
// API 访问守卫（三个端点共用）
//
// 为什么需要它：Cloudflare Pages Functions 的 /api/* 一旦部署就是公开 URL，
// 任何人都能直接 curl。不做防护的话，别人拿你的部署地址当免费 API 白嫖，
// 直接消耗你的 Pages Functions 免费额度（每天 10 万次请求，很快就会被打满）。
//
// 注意一个前提：/api/feed 必须对外可访问 —— 前端页面要靠它拿数据。
// 所以「不暴露 API」和「页面能用」本身是互斥的。这里能做的不是藏起来，
// 而是三件事：
//   1. 限流   —— 挡住脚本批量刷（最关键，直接保护额度）
//   2. 鉴权   —— 对"只给自己用"的端点要求密钥
//   3. 限源   —— 拒绝跨站盗用（带 Origin 但非同源的请求直接 403）
//
// 全部通过环境变量控制，不改代码就能调整强度：
//   API_SECRET        私密端点的密钥（x-api-secret 头 或 ?key=）。留空则私密端点一律 403
//   FEED_LIMIT        feed 端点单 IP 每分钟「真抓上游」的上限，默认 30
//   FEED_HIT_LIMIT    feed 端点单 IP 每分钟「缓存命中」的上限，默认 120
//   FEED_REQUIRE_KEY  设为 "1" 时 feed 也需要密钥（此时页面会失效，仅用于自查）
//   RATE_LIMIT        私密端点单 IP 每分钟上限，默认 10
//   ALLOW_NO_ORIGIN    设为 "1" 时放行无 Origin 的请求（curl / 服务端调用）
//
// 注意：Pages Functions 的 env 只在 handler 内可用，因此这里全部惰性读取。
// ---------------------------------------------------------------------------

function int(v, dflt) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : dflt;
}

// 从 context.env 读取配置，兼容直接传 env 对象
function cfg(env) {
  const e = env || {};
  return {
    secret: String(e.API_SECRET || "").trim(),
    feedLimit: int(e.FEED_LIMIT, 30),
    hitLimit: int(e.FEED_HIT_LIMIT, 120),
    rateLimit: int(e.RATE_LIMIT, 10),
    feedRequireKey: String(e.FEED_REQUIRE_KEY || "") === "1",
    allowNoOrigin: String(e.ALLOW_NO_ORIGIN || "") === "1",
  };
}

function clientIP(request) {
  return (
    request.headers.get("CF-Connecting-IP") ||
    (request.headers.get("X-Forwarded-For") || "").split(",")[0].trim() ||
    "unknown"
  );
}

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

// ---------- 限流：内存滑动窗口 ----------
// 注意：Workers 无状态，内存计数只在单个 isolate 内有效。
// 够挡住"随手刷"，挡不住有组织的分布式刷 —— 那需要 Cloudflare WAF 规则兜底（见 README）。
const buckets = new Map();

function rateLimited(ip, limit, windowMs) {
  const now = Date.now();
  const arr = (buckets.get(ip) || []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) {
    buckets.set(ip, arr);
    return true;
  }
  arr.push(now);
  buckets.set(ip, arr);
  // 顺手清掉过期的桶，避免 Map 无限增长
  if (buckets.size > 3000) {
    for (const [k, v] of buckets) {
      if (!v.length || now - v[v.length - 1] > windowMs) buckets.delete(k);
    }
  }
  return false;
}

// ---------- 鉴权：x-api-secret 头 或 ?key= ----------
function authorized(request, url, secret) {
  const viaHeader = request.headers.get("x-api-secret");
  const viaQuery = url.searchParams.get("key");
  return viaHeader === secret || viaQuery === secret;
}

// ---------- 限源：拒绝非同源的浏览器请求 ----------
function originBlocked(request, allowNoOrigin) {
  if (allowNoOrigin) return false;
  const origin = request.headers.get("Origin");
  if (!origin) return false;              // 无 Origin（curl、SSR、服务端调用）不在此列
  const host = new URL(request.url).host;
  try {
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}

/**
 * 守卫入口。
 * @param request  Request
 * @param {object} opt
 * @param {boolean} opt.private   true=仅自己可用（必须带密钥）；false=公开（仅限流）
 * @param {number}  opt.limit     每分钟上限，缺省按 public/private 取默认
 * @param {boolean} opt.cacheHit  true=本次是缓存命中（没碰上游），走更宽松的独立配额桶
 * @param {string}  opt.label     端点名，用于报错信息
 * @param {object}  opt.env       context.env（Pages Functions 中 env 只在 handler 内可取）
 * @returns {Response|null} 拦截时返回响应；放行返回 null
 */
export function guard(request, opt = {}) {
  const c = cfg(opt.env);
  const isPrivate = !!opt.private;
  const label = opt.label || "api";
  const url = new URL(request.url);
  const ip = clientIP(request);

  // 1) 限流
  //
  // 这里分两个桶，是被实测逼出来的（2026-10-22）：
  //   限流器的存在意义是护住**上游抓取额度**，而不是数 HTTP 请求个数。
  //   缓存命中根本没碰上游（不抓 RSS，Pages 调用开销也几乎为零），
  //   却和真抓取共用一个 30 次/分的桶，结果是**页面自己发的请求把页面自己挡在门外**：
  //   一次加载打 4 个 feed 请求（主信息流 + 天气/游戏/AI 三个部件），
  //   每切一次界面语言再来 4 个，用户翻 8 种语言 = 36 个 > 30 → 自己把自己 429 掉。
  //   这个 429 不是推演出来的，是 brandtest 切 8 种语言时必挂（8 语言断言全过，
  //   结果控制台里躺着一个 429，退出码 1）。
  //
  //   所以：真抓取仍受 FEED_LIMIT(30/分) 约束 —— 脚本刷不动上游；
  //   缓存命中走独立的 FEED_HIT_LIMIT(120/分) 桶 —— 给多语言浏览留够余量，
  //   但不是无限，脚本批量刷照样挡得住。
  //   注意鉴权与限源两步与命中与否无关，始终生效（跨站盗用照样 403）。
  if (opt.cacheHit) {
    if (rateLimited(ip + "|hit", c.hitLimit, 60000)) {
      return json(429, { error: "rate_limited", message: "请求过于频繁，请稍后再试", label });
    }
  } else {
    const limit = opt.limit || (isPrivate ? c.rateLimit : c.feedLimit);
    if (rateLimited(ip, limit, 60000)) {
      return json(429, { error: "rate_limited", message: "请求过于频繁，请稍后再试", label });
    }
  }

  // 2) 私密端点：必须配密钥且带对
  if (isPrivate || c.feedRequireKey) {
    if (!c.secret) {
      return json(403, { error: "disabled", message: "该接口未开放（未配置 API_SECRET）", label });
    }
    if (!authorized(request, url, c.secret)) {
      return json(401, { error: "unauthorized", message: "需要有效的 API 密钥", label });
    }
    return null; // 鉴权通过，跳过限源（命令行调用无 Origin）
  }

  // 3) 公开端点：拒绝跨站盗用
  if (originBlocked(request, c.allowNoOrigin)) {
    return json(403, { error: "forbidden_origin", message: "不允许的来源", label });
  }

  return null;
}

// 统一对外响应头（不再返回 Access-Control-Allow-Origin: *）
export function apiHeaders(extra) {
  return Object.assign(
    {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
    extra || {}
  );
}