// trendstest.mjs —— 互联网破圈大事件与年度热搜历史通鉴系统测试套件
import assert from "node:assert/strict";
import fs from "fs";
import { onRequestGet as apiTrendsGet } from "./functions/api/trends.js";
import { onRequest as historyPageGet } from "./functions/history.js";
import { onRequest as trendsPageGet } from "./functions/trends.js";

let pass = 0, fail = 0;
function test(name, fn) {
  try {
    fn();
    pass++;
    console.log(`  OK   ${name}`);
  } catch (e) {
    fail++;
    console.error(`  FAIL ${name}: ${e.message}`);
  }
}
async function testAsync(name, fn) {
  try {
    await fn();
    pass++;
    console.log(`  OK   ${name}`);
  } catch (e) {
    fail++;
    console.error(`  FAIL ${name}: ${e.message}`);
  }
}

console.log("===== 测试 1: GET /api/trends?overview=1 看板统计 =====");
await testAsync("Overview 统计指标完整性", async () => {
  const req = new Request("https://hot.myinfostream.com/api/trends?overview=1");
  const res = await apiTrendsGet({ request: req, env: {} });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.ok(data.total_events >= 35, `收录事件数 >= 35 (实际: ${data.total_events})`);
  assert.ok(data.epoch_count >= 15, `时代历史印记数 >= 15 (实际: ${data.epoch_count})`);
  assert.ok(data.peak_heat_max >= 90000000, `全网最高热度 >= 9000万 (实际: ${data.peak_heat_max})`);
  assert.ok(data.categories && data.categories.length >= 4, `分类数 >= 4 (实际: ${data.categories?.length})`);
  assert.ok(data.years && data.years.length >= 6, `年份覆盖完整 (实际: ${data.years?.length}年)`);
});

console.log("\n===== 测试 2: 分类、年份与时代影响力筛选 =====");
await testAsync("科技突破 (tech) 分类筛选", async () => {
  const req = new Request("https://hot.myinfostream.com/api/trends?category=tech");
  const res = await apiTrendsGet({ request: req, env: {} });
  const data = await res.json();
  assert.equal(data.success, true);
  assert.ok(data.items.length >= 10, `科技事件数 >= 10 (实际: ${data.items.length})`);
  for (const item of data.items) {
    assert.equal(item.category, "tech");
  }
});

await testAsync("2024 年份专区筛选", async () => {
  const req = new Request("https://hot.myinfostream.com/api/trends?year=2024");
  const res = await apiTrendsGet({ request: req, env: {} });
  const data = await res.json();
  assert.equal(data.success, true);
  assert.ok(data.items.length >= 5);
  for (const item of data.items) {
    assert.equal(item.event_year, 2024);
  }
});

await testAsync("时代历史印记 (impact=3) 筛选", async () => {
  const req = new Request("https://hot.myinfostream.com/api/trends?impact=3&pageSize=30");
  const res = await apiTrendsGet({ request: req, env: {} });
  const data = await res.json();
  assert.equal(data.success, true);
  assert.ok(data.items.length >= 15);
  for (const item of data.items) {
    assert.equal(item.impact_level, 3);
  }
});

console.log("\n===== 测试 3: 搜索与排序 =====");
await testAsync("搜索 '悟空' 关键词", async () => {
  const req = new Request("https://hot.myinfostream.com/api/trends?q=悟空");
  const res = await apiTrendsGet({ request: req, env: {} });
  const data = await res.json();
  assert.ok(data.items.length >= 1);
  assert.ok(data.items[0].title.includes("黑神话：悟空"));
});

await testAsync("按全网热度排序", async () => {
  const req = new Request("https://hot.myinfostream.com/api/trends?sort=heat&pageSize=10");
  const res = await apiTrendsGet({ request: req, env: {} });
  const data = await res.json();
  for (let i = 0; i < data.items.length - 1; i++) {
    assert.ok((data.items[i].peak_heat || 0) >= (data.items[i + 1].peak_heat || 0));
  }
});

console.log("\n===== 测试 4: Clean URL 落地页与 Host 智能调度 =====");
const trendsHtml = fs.readFileSync("trends.html", "utf8");
const gamesHtml = fs.readFileSync("games.html", "utf8");

const mockEnv = {
  ASSETS: {
    fetch: async (req) => {
      const u = new URL(req.url);
      if (u.pathname === "/trends.html") return new Response(trendsHtml, { status: 200 });
      if (u.pathname === "/games.html") return new Response(gamesHtml, { status: 200 });
      return new Response("Not Found", { status: 404 });
    },
  },
};

await testAsync("hot.myinfostream.com/history 渲染热搜大事件通鉴", async () => {
  const req = new Request("https://hot.myinfostream.com/history");
  const res = await historyPageGet({ request: req, env: mockEnv });
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.ok(html.includes('rel="canonical" href="https://hot.myinfostream.com/history"'));
  assert.ok(html.includes("ca-pub-1130777358854864"));
  assert.ok(html.includes("G-JBQYPMLVHR"));
  assert.ok(html.includes('id="statEvents"'));
  assert.ok(html.includes('id="statEpoch"'));
  assert.ok(html.includes('id="sparkBars"'));
  assert.ok(html.includes('id="eventsList"'));
});

await testAsync("game.myinfostream.com/history 保持调度 Epic 喜加一总账本", async () => {
  const req = new Request("https://game.myinfostream.com/history");
  const res = await historyPageGet({ request: req, env: mockEnv });
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.ok(html.includes('rel="canonical" href="https://game.myinfostream.com/history"'));
  assert.ok(html.includes('id="statGames"'));
  assert.ok(html.includes('id="statUsd"'));
});

await testAsync("带年份参数时热搜通鉴 Canonical 自引用与标题定制", async () => {
  const req = new Request("https://hot.myinfostream.com/history?year=2024");
  const res = await historyPageGet({ request: req, env: mockEnv });
  const html = await res.text();
  assert.ok(html.includes('rel="canonical" href="https://hot.myinfostream.com/history?year=2024"'));
  assert.ok(html.includes("2024 年度互联网破圈大事件全纪录"));
});

console.log(`\n全部通过: ${pass} 项成功 / ${fail} 项失败`);
if (fail > 0) process.exit(1);
