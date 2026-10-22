// functions/api/translate.js
// 免费翻译代理（MyMemory，无需密钥）：把卡片内容翻译成用户语言。
// 与 discover 同理：默认关闭，仅自己可用。未配置 API_SECRET 时返回 403。
//
// 两种调用形态：
//   单条（兼容旧写法）：GET  /api/translate?q=文本&from=zh-CN&to=en
//                       ->  {"text": "..."}
//   批量（现用）：      POST /api/translate   {"items":[{"text","from","to"}, ...]}
//                       ->  {"results": ["...", ...]}   顺序与入参一致
//
// 为什么加批量（2026-10-22，实测数据）：
//   原来只有单条形态，前端就一条文本一个请求。一屏 24 张卡片，
//   加上天气/游戏/AI 三个固定部件（每部件 6 条，标题和字段各要译），
//   一次页面会话实测打出 **59 个 /api/translate 请求**。
//   而这个端点是私密的，RATE_LIMIT 默认 10 次/分 —— 第 11 个请求开始就是 429。
//   结果不是「慢一点」，是翻译功能对所有人直接失效：界面语言一切到非中文，
//   前十条之后的标题就永远停在原文。
//   线上配了 API_SECRET 之后这 59 个请求还会变成 59 次真实上游调用，
//   既烧 Pages Functions 额度，也烧 MyMemory 每天约 5000 词的免费额度。
//
//   批量化之后同样 59 条文本只占 6 个请求（每批最多 10 条），
//   限流计数、函数调用次数同步降到 1/10，而上游调用次数不变
//   （MyMemory 是按词计费的，合并请求并不会让它少翻，但省下的是我们这边的开销）。
//
// 上游限制：MyMemory 单次 langpair 请求只接受一条 q，所以这里是对数组逐条取、
// 再汇总返回 —— 不能指望上游替我们合并。全部失败时逐条回落成原文，
// 绝不因为其中一条挂了就让整批丢翻译。

import { guard } from "./_guard.js";

// 单批最多多少条。10 是在「够抵掉限流」和「别把 MyMemory 打超时」之间取的：
// 24 张卡片一批刚好装得下，翻完整个首屏 2~3 个请求就够。
const MAX_BATCH = 10;

async function fetchJSON(url) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), 7000);
  try {
    // await 不能少。这里以前写成 `const res = fetch(...)`，res 拿到的是 Promise，
    // 于是 res.ok 恒为 undefined → `!res.ok` 恒真 → 每一条都抛「HTTP undefined」
    // → 回落原文。症状极有欺骗性：端点照样返回 200、results 长度也对、
    // 只是每条都等于原文，所以「看日志全是 200」完全看不出问题，
    // 翻译实际从来没工作过。Promise 上再取 .headers 则直接 TypeError。
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  } finally { clearTimeout(id); }
}

const HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

/** 翻一条，失败一律回落成原文 —— 翻译是锦上添花，不能让它把页面拖垮 */
async function translateOne(text, from, to) {
  try {
    const api = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(from)}|${encodeURIComponent(to)}`;
    const d = await fetchJSON(api);
    return (d && d.responseData && d.responseData.translatedText) || (d && d.translatedText) || text;
  } catch (e) {
    return text;
  }
}

/** 把入参归一成 [{text, from, to}]，同时挡掉明显不合理的载荷 */
function normalizeItems(raw, fallbackFrom, fallbackTo) {
  const list = Array.isArray(raw) ? raw : [raw];
  const out = [];
  for (const it of list.slice(0, MAX_BATCH)) {
    if (!it || typeof it !== "object") continue;
    const text = typeof it.text === "string" ? it.text.slice(0, 500) : "";
    const to = typeof it.to === "string" && it.to ? it.to : fallbackTo;
    if (!text || !to) continue;
    const from = typeof it.from === "string" && it.from ? it.from : fallbackFrom;
    out.push({ text, from, to });
  }
  return out;
}

export async function onRequest(context) {
  // 注意 guard 整个请求只跑一次 —— 这正是批量的意义所在：
  // 限流计数按「请求数」而不是「文本条数」算。
  const blocked = guard(context.request, { private: true, label: "translate", env: context.env });
  if (blocked) return blocked;

  const { request } = context;
  const url = new URL(request.url);

  let items = [];
  let single = false;

  if (request.method === "POST") {
    let body = null;
    try { body = await request.json(); } catch (e) { /* 空/坏 body 当没给 */ }
    const list = body && Array.isArray(body.items) ? body.items : [];
    const f = (body && body.from) || "zh-CN";
    const t = (body && body.to) || "en";
    items = normalizeItems(list, f, t);
    single = items.length === 1 && !Array.isArray(list);
  } else {
    const q = url.searchParams.get("q") || "";
    const from = url.searchParams.get("from") || "zh-CN";
    const to = url.searchParams.get("to") || "en";
    if (!q || !to) {
      return new Response(JSON.stringify({ text: q }), { status: 400, headers: HEADERS });
    }
    items = normalizeItems([{ text: q, from, to }], from, to);
    single = true;
  }

  if (!items.length) {
    return new Response(
      JSON.stringify(single ? { text: "" } : { results: [] }),
      { status: 400, headers: HEADERS }
    );
  }

  const results = await Promise.all(items.map((it) => translateOne(it.text, it.from, it.to)));

  // 单条沿用旧的 {text} 形状，免得任何还在用旧调用的地方悄悄拿到 undefined
  const payload = single ? { text: results[0] } : { results };
  return new Response(JSON.stringify(payload), { headers: HEADERS });
}