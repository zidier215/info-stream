// diag.mjs —— 单点深诊断：把「为什么页面是空的」四层逐层拆开看
// 用法：node diag.mjs [baseUrl] [tabId]
//   node diag.mjs https://myinfostream.com/ brief
//   node diag.mjs https://ai.myinfostream.com/ ai
// 默认 https://myinfostream.com/ + brief
//
// 为什么需要它（2026-10-22 新增）：
//   白屏时分四层，任何一层断了都表现成「没数据」，但修法完全不同：
//     ① 接口层  HTTP 状态 / ok 字段 / items 长度
//     ② 渲染层  DOM 里有没有卡片（feed.children）
//     ③ 边界层  请求失败 / 控制台报错 / 上游超时
//   v2.4.1 那次前三层全绿但页面空白，恰恰说明「接口返回对」≠「用户看得到」，
//   所以这里分层打，避免再被前两层的绿灯骗一次。
import { loadPlaywright } from "./pwpath.mjs";

const BASE = process.argv[2] || "https://myinfostream.com/";
const TAB = process.argv[3] || "brief";

const { chromium } = await loadPlaywright();
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1360, height: 940 } });

const net = [];
p.on("request", (r) => { if (r.url().includes("/api/")) net.push("REQ   " + r.url()); });
p.on("response", async (r) => {
  if (!r.url().includes("/api/")) return;
  const len = (await r.body().catch(() => Buffer.from(""))).length;
  net.push(`RESP  ${r.status()}  len=${len}  ${r.url()}`);
});
const errs = [];
p.on("pageerror", (e) => errs.push("pageerror: " + e.message));
p.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text()); });

const t0 = Date.now();
await p.goto(BASE, { waitUntil: "domcontentloaded", timeout: 45000 });

// 切到目标 tab：优先点 UI 上的那个，点不到就靠 URL 参数兜底
const hit = await p.evaluate((tab) => {
  const tabs = [...document.querySelectorAll("#tabs .tab")];
  const i = tabs.findIndex((t) => (t.dataset.tab || t.dataset.id || "") === tab);
  if (i >= 0) { tabs[i].click(); return { idx: i + 1, n: tabs.length }; }
  return { idx: -1, n: tabs.length };
}, TAB);

let waited = 0;
let cards = 0;
while (waited < 25000) {
  cards = await p.locator("#feed .card").count();
  if (cards > 0) break;
  await p.waitForTimeout(500);
  waited += 500;
}

const tabDesc = hit.idx > 0 ? `点击命中第 ${hit.idx}/${hit.n} 个` : `未在 UI 命中（共 ${hit.n} 个），已用默认 tab`;
console.log(`\n═══ ${BASE}  [tab=${TAB}，${tabDesc}] ═══`);
console.log(`首屏卡片出现耗时 ${Date.now() - t0} ms（轮询上限 25s）\n`);

// ① 接口层
console.log("① 接口层（绕过页面逻辑，直接 fetch）");
const direct = await p.evaluate(async (tab) => {
  const r = await fetch(`/api/feed?tab=${encodeURIComponent(tab)}&lang=zh`, { cache: "no-store" });
  const j = await r.json().catch(() => null);
  return {
    http: r.status,
    ok: j?.ok,
    count: j?.count,
    items: Array.isArray(j?.items) ? j.items.length : null,
    first: j?.items?.[0]?.title?.slice(0, 60),
    err: j?.error || j?.message,
  };
}, TAB);
console.log("   " + JSON.stringify(direct));

// ② 渲染层
console.log("\n② 渲染层");
const dom = await p.evaluate(() => {
  const feed = document.getElementById("feed");
  return {
    domCards: document.querySelectorAll("#feed .card").length,
    feedChildren: feed?.children.length ?? null,
    feedHTMLHead: (feed?.innerHTML || "").slice(0, 100),
    sentinel: (document.querySelector("#sentinel")?.textContent || "").trim().slice(0, 80),
    banner: (document.querySelector(".banner")?.textContent || "").trim().slice(0, 80),
  };
});
console.log("   " + JSON.stringify(dom, null, 2).split("\n").join("\n   "));

// ③ 边界层
console.log("\n③ 边界层");
console.log("   网络:");
net.forEach((l) => console.log("     " + l));
console.log("   错误:");
if (errs.length) errs.forEach((l) => console.log("     " + l));
else console.log("     无");

// 判定：直接指出断在哪一层
console.log("\n═══ 判定 ═══");
if ((direct.items ?? 0) > 0 && dom.domCards === 0) {
  console.log("✗ 接口有数据、DOM 没卡片  →  渲染层断了：loadFeed 拿到 buffer 后没调 renderMore");
  process.exitCode = 1;
} else if ((direct.items ?? 0) === 0) {
  console.log("✗ 接口自己就没数据  →  接口层：看上面的 RESP 耗时与 budget 预算是否失衡");
  process.exitCode = 1;
} else if (dom.domCards === 0) {
  console.log("✗ 页面 25s 内没出卡片  →  看网络段有没有请求发出、错误段有没有报错");
  process.exitCode = 1;
} else {
  console.log(`✓ 接口 ${direct.items} 条、页面渲染 ${dom.domCards} 条，链路通`);
}

await p.screenshot({ path: "shot-diag.png", fullPage: false });
console.log("\n截图: shot-diag.png");
await b.close();