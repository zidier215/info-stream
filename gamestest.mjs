// gamestest.mjs —— Epic 喜加一历史总账本 API 与落地页全量单元测试
import { onRequest as gamesApiFn } from "./functions/api/games.js";
import { onRequest as gamesPageFn } from "./functions/games.js";
import { readFileSync } from "node:fs";

let fail = 0;
const check = (ok, label, extra = "") => {
  if (!ok) fail++;
  console.log(`  ${ok ? "OK  " : "FAIL"} ${label}${extra ? "  " + extra : ""}`);
};

const req = (url, method = "GET", body = null) => {
  const opts = { method, headers: { host: "game.myinfostream.com" } };
  if (body) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  return new Request(url, opts);
};

// ---------------- 测试 1: 种子数据概览与大盘统计 ----------------
console.log("===== 测试 1: GET /api/games?overview=1 种子模式看板统计 =====");
{
  const res = await gamesApiFn({ request: req("https://game.myinfostream.com/api/games?overview=1"), env: {} });
  check(res.status === 200, "HTTP 200");
  const data = await res.json();
  check(data.success === true, "success=true");
  check(data.total_games >= 50, `累计收录免费游戏数 >= 50 (实际: ${data.total_games})`);
  check(data.total_value_usd > 2000, `累计白嫖总值 > $2,000 USD (实际: $${data.total_value_usd})`);
  check(data.total_value_rmb > 8000, `折合人民币总值 > ¥8,000 (实际: ¥${data.total_value_rmb})`);
  check(data.aaa_count >= 30, `3A 殿堂级大作数 >= 30 (实际: ${data.aaa_count})`);
  check(data.mystery_count >= 15, `圣诞神秘连送数 >= 15 (实际: ${data.mystery_count})`);
  check(Array.isArray(data.years) && data.years.length === 8, `历年统计覆盖完整 8 年 (2019-2026, 实际: ${data.years?.length}年)`);
}

// ---------------- 测试 2: 年份与分类标签筛选 ----------------
console.log("\n===== 测试 2: 年份与分类标签筛选 =====");
{
  const res2026 = await gamesApiFn({ request: req("https://game.myinfostream.com/api/games?year=2026&pageSize=10"), env: {} });
  const d2026 = await res2026.json();
  check(d2026.success === true, "2026 年份查询成功");
  check(d2026.items.every(g => g.giveaway_year === 2026), "2026 列表内游戏年份均为 2026");

  const resAaa = await gamesApiFn({ request: req("https://game.myinfostream.com/api/games?tag=aaa&pageSize=20"), env: {} });
  const dAaa = await resAaa.json();
  check(dAaa.items.every(g => g.is_aaa === true), "3A 标签筛选结果均为 3A 大作");

  const resMystery = await gamesApiFn({ request: req("https://game.myinfostream.com/api/games?tag=mystery&pageSize=20"), env: {} });
  const dMystery = await resMystery.json();
  check(dMystery.items.every(g => g.is_mystery === true), "神秘连送筛选结果均为神秘喜加一");
}

// ---------------- 测试 3: 搜索与排序 ----------------
console.log("\n===== 测试 3: 搜索与排序 =====");
{
  const resSearch = await gamesApiFn({ request: req("https://game.myinfostream.com/api/games?q=侠盗猎车手"), env: {} });
  const dSearch = await resSearch.json();
  check(dSearch.items.length >= 1, "搜 '侠盗猎车手' 命中 GTA5");
  check(dSearch.items.some(g => g.title.includes("Grand Theft Auto")), "命中项英文原名匹配");

  const resPriceSort = await gamesApiFn({ request: req("https://game.myinfostream.com/api/games?sort=price&pageSize=10"), env: {} });
  const dPrice = await resPriceSort.json();
  let isDesc = true;
  for (let i = 1; i < dPrice.items.length; i++) {
    if (dPrice.items[i].price_usd > dPrice.items[i-1].price_usd) isDesc = false;
  }
  check(isDesc, "按原价从高到低排序正确");
}

// ---------------- 测试 4: Clean URL 落地页 /history 渲染 ----------------
console.log("\n===== 测试 4: Clean URL 落地页 /history 渲染 =====");
{
  const htmlRaw = readFileSync(new URL("./games.html", import.meta.url), "utf8");
  const mockEnv = {
    ASSETS: {
      async fetch(r) {
        return new Response(htmlRaw, { status: 200, headers: { "Content-Type": "text/html" } });
      }
    }
  };

  const pageRes = await gamesPageFn({ request: req("https://game.myinfostream.com/history"), env: mockEnv });
  check(pageRes.status === 200, "落地页 HTTP 200");
  const html = await pageRes.text();
  check(html.includes('rel="canonical" href="https://game.myinfostream.com/history"'), "Canonical 指向本域 /history");
  check(html.includes("ca-pub-1130777358854864"), "部署 AdSense 发布商账号");
  check(html.includes("G-JBQYPMLVHR"), "部署 GA4 测量代码");
  check(html.includes('id="sparkBars"'), "包含走势柱状图容器");
  check(html.includes('id="gamesList"'), "包含游戏卡片流列表");
  check(html.includes('id="yearSelect"'), "包含年份切换选择器");

  // 年份参数 URL 测试
  const yearPageRes = await gamesPageFn({ request: req("https://game.myinfostream.com/history?year=2026"), env: mockEnv });
  const yearHtml = await yearPageRes.text();
  check(yearHtml.includes('rel="canonical" href="https://game.myinfostream.com/history?year=2026"'), "带年份参数时 Canonical 自引用 ?year=2026");
  check(yearHtml.includes("<title>Epic 2026 年免费游戏全记录"), "带年份参数时动态优化网页标题");
}

console.log("\n" + (fail === 0 ? "全部通过" : `✗ 存在 ${fail} 项失败`));
if (fail > 0) process.exit(1);

