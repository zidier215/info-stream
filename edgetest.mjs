// edgetest.mjs —— stale-while-error 兜底逻辑回归测试（后端层）
//
// 为什么单独写：stale 回退只在「实时源全部失败」时才触发 ——
// 也就是说，它是一条**永远不在正常路径上执行**的代码。
// 上一轮 ai.myinfostream.com 空白就是踩在这条路径上（边缘 IP 间歇性失败），
// 而所有「源正常」的测试全绿，测不出问题。
//
// 手法：不改生产代码，只替换两个全局：
//   globalThis.fetch  —— 模拟上游成功 / 挂掉两种世界
//   globalThis.caches —— Workers 运行时注入的边缘缓存，本机没有，补一个内存版
// 另外每个场景用不同的 city 参数，把 L1 内存缓存隔离开，
// 否则场景之间会互相命中，看起来「通过」其实是假通过。
import { onRequest as feed } from "./functions/api/feed.js";

let pass = 0, fail = 0;
const ok = (c, msg, extra) => {
  console.log((c ? "  OK   " : "  FAIL ") + msg + (extra ? "  " + extra : ""));
  c ? pass++ : fail++;
};

// ---------------------------------------------------------------- 内存版 caches
// 语义要对齐 Cache API 关键的两点：key 精确匹配、值是 Response。
// 不模拟 TTL 过期 —— feed.js 本身就是靠「不同 key」区分新鲜层/兜底层的，
// TTL 只交给 Cloudflare，过期行为用假实现反而会掩盖真问题。
const store = new Map();
globalThis.caches = {
  default: {
    async put(req, res) { store.set(new Request(req).url, res); },
    async match(req) { return store.get(new Request(req).url) || undefined; },
    async delete(req) { store.delete(new Request(req).url); },
  },
};

// ---------------------------------------------------------------- 上游 mock
let upstreamMode = "ok";   // "ok" | "dead"
const realFetch = globalThis.fetch;
function rss(n, tag) {
  let items = "";
  for (let i = 1; i <= n; i++) {
    items += `<item><title>${tag} 标题${i} - Reuters</title><link>https://ex.com/${tag}/${i}</link>` +
      `<pubDate>${new Date(Date.now() - i * 60000).toUTCString()}</pubDate>` +
      `<source url="https://reuters.com">Reuters</source></item>`;
  }
  return `<?xml version="1.0"?><rss version="2.0"><channel>${items}</channel></rss>`;
}
globalThis.fetch = async (url, init) => {
  const u = String(url && url.url ? url.url : url);
  // dead 模式必须**所有**上游都挂，不能只拦 news.google.com。
  // 上一版只拦 GN，结果 arXiv 等真实源照常返回，items 非空 → 走成功路径，
  // stale 分支根本没被执行，两个场景却「看起来测过了」。造故障要造到底。
  if (upstreamMode === "dead") throw new TypeError("fetch failed");
  if (u.includes("news.google.com")) {
    return new Response(rss(6, "好数据"), {
      status: 200, headers: { "content-type": "application/rss+xml; charset=utf-8" },
    });
  }
  return realFetch(url, init);
};

const HOST = "ai.myinfostream.com";
const call = (qs) => feed({
  request: new Request(`https://${HOST}/api/feed?${qs}`, { headers: { host: HOST, origin: `https://${HOST}` } }),
  env: {},
});

// ================================================================= 场景
console.log("\n=== 场景 A：上游正常，首抓成功 ===");
upstreamMode = "ok";
const a = await (await call("tab=all&lang=zh&city=Alpha")).json();
ok(a.count > 0, "拿到实时数据", `${a.count} 条 / stale=${a.stale}`);
ok(a.stale === false, "stale 标志为 false");
ok(store.size >= 2, "同时写入新鲜层 + 兜底层两份缓存", `${store.size} 个 key`);
const titleA = a.items[0]?.title || "";

console.log("\n=== 场景 B：上游挂 + 新鲜层已过期 → 回退兜底快照 ===");
// 要走到 stale 分支，必须同时满足三个条件，缺一个都测不到：
//   1. 该 city 之前成功抓过（有旧快照）——用场景 A 的 Alpha
//   2. L1 内存缓存已过期（15s）——L1 是模块私有的，测试拿不到，只能真等
//   3. L2 新鲜层已过期（60s）——fake caches 不实现 TTL，用删 key 来表达「已过期」
// 上一版这三条都没满足，B 场景实际测的是「没有快照时的空响应」。
// 真实部署里 CF 会自己按 ttlSeconds 过期，所以条件 2/3 在线上是自然发生的。
upstreamMode = "dead";
const alphaFresh = [...store.keys()].filter((k) => k.includes("Alpha") && k.includes("/__f"));
const alphaStale = [...store.keys()].filter((k) => k.includes("Alpha") && k.includes("/__s"));
ok(alphaStale.length === 1, "Alpha 的兜底层存在", alphaStale.length + " 个");
for (const k of alphaFresh) store.delete(k);          // 模拟新鲜层过期

const waitUntil = Date.now() + 16000;
while (Date.now() < waitUntil) await new Promise((r) => setTimeout(r, 500));  // 等 L1 过期

const b = await (await call("tab=all&lang=zh&city=Alpha")).json();
ok(b.count > 0, "不是白屏，回退到旧快照", `${b.count} 条`);
ok(b.stale === true, "stale 标志为 true（前端据此给提示）");
ok((b.items[0]?.title || "") === titleA, "回退内容与之前抓到的数据一致", JSON.stringify((b.items[0]?.title || "").slice(0, 24)));

console.log("\n=== 场景 C：上游挂 + 只有新鲜层（无兜底层） ===");
// 要证明「优先读新鲜层、根本不碰兜底」，唯一的办法是把兜底层**删掉**：
// 若代码误走了 stale 分支，这里会返回空；若正确读 fresh，则照样有数据。
upstreamMode = "ok";
await call("tab=all&lang=zh&city=Gamma");
const gammaKeys = [...store.keys()].filter((k) => k.includes("Gamma"));
for (const k of gammaKeys.filter((k) => k.includes("/__s"))) store.delete(k);   // 只删兜底层
ok(gammaKeys.some((k) => k.includes("/__f")), "Gamma 的新鲜层仍在", gammaKeys.length + " 个 key");
upstreamMode = "dead";
const c = await (await call("tab=all&lang=zh&city=Gamma")).json();
ok(c.count > 0, "新鲜层命中，未触发重抓、也未回退兜底", `${c.count} 条`);
ok(c.stale === false, "新鲜数据不算 stale");

console.log("\n=== 场景 D：上游挂 + 兜底层也没有（冷启动） ===");
upstreamMode = "dead";
const d = await (await call("tab=all&lang=zh&city=Delta")).json();
ok(d.count === 0, "确实没有数据可给（如实返回空，不编造）", `${d.count} 条`);
ok(d.stale === false, "没数据时不该标 stale（标了就是骗用户说有兜底）");

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);