// widgettest.mjs —— 验证固定看板（天气/游戏/AI）与 Clean URL 路由修复
import { onRequest as feedReq } from "./functions/api/feed.js";
import { onRequest as wealthReq } from "./functions/wealth.js";
import { onRequest as indexReq } from "./functions/index.js";
import assert from "node:assert";

async function test() {
  console.log("=== 测试 1: /api/feed?tab=weather 独立天气接口 ===");
  const reqW = new Request("https://myinfostream.com/api/feed?tab=weather");
  const resW = await feedReq({ request: reqW, env: {} });
  assert.strictEqual(resW.status, 200);
  const dataW = await resW.json();
  assert.strictEqual(dataW.tab, "weather");
  assert(dataW.items.length > 0, "天气接口应返回条目");
  assert(dataW.items.every(it => it.category === "天气"), "天气接口所有条目类别必须为天气");
  console.log("  OK 天气接口独立且全量为天气条目:", dataW.items.length, "条");

  console.log("=== 测试 2: /api/feed?tab=games 独立游戏接口 ===");
  const reqG = new Request("https://myinfostream.com/api/feed?tab=games");
  const resG = await feedReq({ request: reqG, env: {} });
  assert.strictEqual(resG.status, 200);
  const dataG = await resG.json();
  assert.strictEqual(dataG.tab, "games");
  assert(dataG.items.length > 0, "游戏接口应返回条目");
  assert(dataG.items.every(it => it.category.startsWith("游戏")), "游戏接口所有条目必须为游戏相关类别");
  console.log("  OK 游戏接口独立且全量为游戏条目:", dataG.items.length, "条");

  console.log("=== 测试 3: /api/feed?tab=ai 独立AI接口 ===");
  const reqA = new Request("https://myinfostream.com/api/feed?tab=ai");
  const resA = await feedReq({ request: reqA, env: {} });
  assert.strictEqual(resA.status, 200);
  const dataA = await resA.json();
  assert.strictEqual(dataA.tab, "ai");
  assert(dataA.items.length > 0, "AI接口应返回条目");
  console.log("  OK AI接口返回条目:", dataA.items.length, "条");

  console.log("=== 测试 4: /wealth 路由及带尾部斜杠 (/wealth/) 规范重定向 ===");
  const reqWealthSlash = new Request("https://myinfostream.com/wealth/");
  const resWealthSlash = await wealthReq({ request: reqWealthSlash, env: {} });
  assert.strictEqual(resWealthSlash.status, 301, "带斜杠请求应 301 重定向");
  assert.strictEqual(resWealthSlash.headers.get("Location"), "https://myinfostream.com/wealth");
  console.log("  OK /wealth/ 成功 301 重定向至规范无斜杠地址 https://myinfostream.com/wealth");

  console.log("=== 测试 5: index.js 路由守卫对 /wealth/ 的 301 重定向 ===");
  const reqIndexSlash = new Request("https://myinfostream.com/wealth/");
  const resIndexSlash = await indexReq({ request: reqIndexSlash, env: {} });
  assert.strictEqual(resIndexSlash.status, 301);
  assert.strictEqual(resIndexSlash.headers.get("Location"), "https://myinfostream.com/wealth");
  console.log("  OK index.js 成功拦截带斜杠请求并 301 重定向");

  console.log("\n✓ 全部测试通过！");
}

test().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});

