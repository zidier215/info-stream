// staletest.mjs —— stale-while-error 前端链路专项测试
// 用法：先 node localsim.mjs 8788，再 SIM=1 node staletest.mjs
//
// 为什么单独写这个：stale 是一条「后端标了、前端横幅响了」的跨端约定，
// 两边各写各的很容易一边改了另一边没跟，而且它是**失败路径** ——
// 正常有数据时永远不会触发，光跑 e2e 测不出来。
// 这里直接拦截 /api/feed 注入 stale:true / false，把两种状态都走一遍。
import { loadPlaywright } from "./pwpath.mjs";
import { simArgs, simURL } from "./simhosts.mjs";

const BASE = simURL("main");
const { chromium } = await loadPlaywright();
const b = await chromium.launch({ args: simArgs() });
const p = await b.newPage({ viewport: { width: 1360, height: 940 } });

const errs = [];
p.on("pageerror", (e) => errs.push("pageerror: " + e.message));

let pass = 0, fail = 0;
function ok(c, msg) {
  console.log((c ? "  OK   " : "  FAIL ") + msg);
  c ? pass++ : fail++;
}

// 字段名必须和前端 card 模板一致（app.js 读 it.title / it.url / it.ts / it.src），
// 否则卡片会渲染成空壳 —— 上一版用了 it.t，测出来「有卡片但没内容」，
// 白白怀疑了一轮前端渲染。
const FAKE_ITEMS = [
  { title: "旧快照标题 A", url: "https://example.com/a", ts: Date.now() - 86400000, src: "快照源", lang: "zh" },
  { title: "旧快照标题 B", url: "https://example.com/b", ts: Date.now() - 172800000, src: "快照源", lang: "zh" },
];

// mode: "stale" | "fresh"
async function run(mode) {
  await p.route("**/api/feed*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: FAKE_ITEMS, stale: mode === "stale" }),
    });
  });
  await p.goto(BASE, { waitUntil: "domcontentloaded", timeout: 30000 });
  // 等首屏卡片出来，确保渲染链路真的跑完了再断言横幅
  for (let i = 0; i < 40 && (await p.locator("#feed .card").count()) === 0; i++) {
    await p.waitForTimeout(250);
  }
}

console.log("\n=== 场景 1：后端回退旧快照，stale:true ===");
await run("stale");
ok((await p.locator("#feed .card").count()) > 0, "有卡片渲染出来（不是白屏）");
const bn = p.locator("#banner");
ok(await bn.count() > 0, "stale 横幅出现");
const txt = await bn.textContent().catch(() => "");
ok(/暂时无响应/.test(txt || ""), "横幅文案是 stale 文案", JSON.stringify((txt || "").slice(0, 40)));
const cls = await bn.getAttribute("class").catch(() => "");
ok(/warn/.test(cls || ""), "横幅带 warn 样式（与 demo 配色区分）", cls);
const bodyTxt = await p.locator("#feed").textContent().catch(() => "");
ok(/旧快照标题 A/.test(bodyTxt || ""), "旧快照内容确实显示出来了");

console.log("\n=== 场景 2：后端恢复正常，stale 缺失 ===");
await run("fresh");
const txt2 = await p.locator("#banner").textContent().catch(() => null);
ok(txt2 === null || txt2.trim() === "", "stale 横幅已自动消失", JSON.stringify(txt2));

console.log("\n=== 页面 JS 错误 ===");
ok(errs.length === 0, "无 pageerror", errs.join(" | "));

await b.close();
console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);