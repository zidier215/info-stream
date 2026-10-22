// webtest.mjs —— 线上真实环境端到端测试
// 用法：node webtest.mjs [baseUrl]
// 默认打 https://myinfostream.com/
//
// 为什么需要它（2026-10-22 新增）：
//   apitest / hosttest 都是「本机直调 handler」，走的是本机网络 —— 本机到
//   Google News 约 2 秒，永远碰不到 Cloudflare 边缘的真实延迟。
//   于是一类只在边缘才复现的 bug 能让全部单测绿灯，上线却是空白页：
//       外层 SOURCE_DEADLINE(6s) 比源自己的超时(8s) 还短 → 源被判成空数组。
//   这个脚本用真实浏览器打真实域名，覆盖「用户看到的那一屏」。
import { loadPlaywright } from "./pwpath.mjs";
import { simArgs, simURL } from "./simhosts.mjs";

// SIM=1：配合 localsim.mjs 用。
// 关键点是不能打 127.0.0.1 —— app.js 的 isLocal() 判 hostname，
// localhost/127.0.0.1 会让它切到 demo 演示池，真实取数链路整个被绕过。
// 这里把假域名 myinfostream.test 解析到本机，走的才是「前端本地 + /api/ 线上」的组合。
// simArgs() 自带 --no-proxy-server，理由见 simhosts.mjs：漏了会间歇 502。
const SIM = process.env.SIM === "1";
const launchArgs = SIM ? simArgs() : [];

const BASE = process.argv[2] || (SIM ? simURL("main") : "https://myinfostream.com/");
const { chromium } = await loadPlaywright();
const b = await chromium.launch({ args: launchArgs });
const p = await b.newPage({ viewport: { width: 1360, height: 940 } });

const errs = [];
const netFails = [];
p.on("pageerror", (e) => errs.push("pageerror: " + e.message));
p.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text()); });
p.on("response", (r) => {
  if (r.status() >= 400) netFails.push(`${r.status()} ${r.url()}`);
});

function ok(c, msg, extra) { console.log((c ? "  OK   " : "  FAIL ") + msg + (extra ? "  " + extra : "")); return c; }

const t0 = Date.now();
await p.goto(BASE, { waitUntil: "domcontentloaded", timeout: 45000 });
// 等首屏卡片出现，而不是死等固定时间：网络慢时多给机会，
// 网络快时不用白等 5 秒。
let waited = 0;
let cards = 0;
while (waited < 20000) {
  cards = await p.locator("#feed .card").count();
  if (cards > 0) break;
  await p.waitForTimeout(500);
  waited += 500;
}
const firstPaint = Date.now() - t0;

console.log(`\n=== ${BASE} ===`);
console.log(`首屏渲染耗时 ${firstPaint} ms（含等卡片出现的轮询）\n`);

// --- 主站：逐个 tab 真实点一遍 ---
const tabs = await p.locator("#tabs .tab").allTextContents();
console.log(`发现 ${tabs.length} 个 tab: ${tabs.map((s) => s.trim()).join(" | ")}`);
console.log("");

// 单个 tab 最多等这么久
const TAB_WAIT = 20000;

const perTab = {};
// 因边缘冷启动而重试才过的 tab（不算失败，但必须单独报出来）
const coldStarts = [];

for (let i = 0; i < tabs.length; i++) {
  const name = tabs[i].trim();
  await p.locator("#tabs .tab").nth(i).click();
  await p.waitForTimeout(400);

  // 等卡片出现（而不是死等固定时间）。
  // 踩坑（2026-10-22）：这里原来只等一轮 20 秒，冷启动的 tab 直接判 FAIL。
  // 但实测同一个 URL 三次分别 10.2s / 3.4s / 10.2s —— 首次请求吃满
  // WORST_CASE（SOURCE_DEADLINE 8s + RETRY_DEADLINE 3s = 11s），之后命中
  // 边缘缓存降到 3 秒级。**这是缓存冷启动开销，不是数据缺失**，
  // 两者在「有没有卡片」这个断言下长得一模一样。
  // 所以：一轮没出就再点一次同一 tab 重试。重试过 → 记 coldStarts 不算失败；
  // 重试仍空 → 那才是真空白，照样 FAIL。重试绝不能被当成把失败变绿的橡皮擦。
  const waitFor = async () => {
    const t = Date.now();
    let n = 0, w = 0;
    while (w < TAB_WAIT) {
      n = await p.locator("#feed .card").count();
      if (n > 0) break;
      await p.waitForTimeout(400);
      w += 400;
    }
    return { n, ms: Date.now() - t };
  };

  let r = await waitFor();
  if (r.n === 0) {
    await p.locator("#tabs .tab").nth(i).click();  // 重试：再触发一次取数
    r = await waitFor();
    if (r.n > 0) coldStarts.push({ name, ms: r.ms });
  }

  perTab[name] = r.n;
  const tag = r.n === 0 ? "" : r.ms >= 8000 ? "  ⚠ 边缘冷启动" : "";
  ok(r.n > 0, `tab「${name}」出 ${r.n} 条`, `${r.ms} ms${tag}`);
}

// --- 看板（主站常驻）---
const widgets = await p.evaluate(() => {
  const wrap = document.getElementById("widgetsWrap");
  if (!wrap || wrap.hidden) return null;
  return {
    weather: !!document.querySelector("#w-weather")?.textContent.trim(),
    games: !!document.querySelector("#w-games")?.textContent.trim(),
    ai: !!document.querySelector("#w-ai")?.textContent.trim(),
  };
});
if (widgets) ok(widgets.weather && widgets.games, "看板有内容（天气 / 游戏）", JSON.stringify(widgets));

// --- 入口卡片（仅主站）---
const entries = await p.locator("#entries .entry-card").count();
ok(entries > 0, `主站入口卡片 ${entries} 个`);

// --- 控制台与网络 ---
console.log("");
if (errs.length) ok(false, `控制台有 ${errs.length} 条错误`, errs.slice(0, 3).join(" | "));
else ok(true, "控制台 0 错误");

if (netFails.length) ok(false, `${netFails.length} 个请求非 2xx`, netFails.slice(0, 3).join(" | "));
else ok(true, "无失败请求");

await p.screenshot({ path: "shot-web.png", fullPage: false });

const failed = Object.entries(perTab).filter(([, n]) => n === 0);
console.log("");
if (coldStarts.length) {
  console.log(`⚠ ${coldStarts.length} 个 tab 首次为空、重试才出数据: ${coldStarts.map((c) => `${c.name}(${c.ms}ms)`).join("、")}`);
  console.log("  边缘冷启动开销，非回归。若频繁出现，考虑给热门 tab 加预热。");
}
if (failed.length) {
  console.log(`✗ ${failed.length}/${Object.keys(perTab).length} 个 tab 重试后仍空白: ${failed.map(([k]) => k).join("、")}`);
  process.exitCode = 1;
} else {
  console.log("✓ 所有 tab 均有数据");
}

await b.close();