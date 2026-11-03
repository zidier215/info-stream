// papertest.mjs —— 验证 AI 论文档案库与持久化存储 API 及落地页
import { onRequestGet as papersGet, onRequestPost as papersPost } from "./functions/api/papers.js";
import { onRequest as papersPage } from "./functions/papers.js";
import { readFileSync } from "node:fs";

let fail = 0;
const check = (ok, label, extra = "") => {
  if (!ok) fail++;
  console.log(`  ${ok ? "OK  " : "FAIL"} ${label}${extra ? "  " + extra : ""}`);
};

console.log("===== 测试 1: GET /api/papers 种子快照模式 =====");
const req1 = new Request("https://ai.myinfostream.com/api/papers?days=7&pageSize=20");
const res1 = await papersGet({ request: req1, env: {} });
check(res1.status === 200, "HTTP 200");
const data1 = await res1.json();
check(Array.isArray(data1.items), "返回 items 数组");
check(data1.items.length === 20, "第 1 页条目数符合 pageSize=20", String(data1.items.length));
check(data1.total === 50, "7 天内种子论文总数 50 篇", String(data1.total));
check(data1.stats && data1.stats.sources >= 20, "信源数量覆盖丰富 (>=20)", String(data1.stats?.sources));
check(Array.isArray(data1.daily) && data1.daily.length > 0, "返回每日统计数据 (Daily Sparkbar)", String(data1.daily?.length));
check(data1.daily.every(d => d.date && d.count > 0), "每日统计项均包含有效日期与篇数");

console.log("\n===== 测试 2: 关键词搜索与筛选 =====");
const reqKw = new Request("https://ai.myinfostream.com/api/papers?days=7&q=DeepMind");
const resKw = await papersGet({ request: reqKw, env: {} });
const dataKw = await resKw.json();
check(dataKw.total > 0, "搜 'DeepMind' 能成功命中论文", `总数: ${dataKw.total}`);
check(dataKw.items.some(p => p.title.includes("DeepMind") || p.source.includes("DeepMind")), "命中项标题或来源包含 DeepMind");

console.log("\n===== 测试 3: 精选筛选 (is_starred) =====");
const reqStar = new Request("https://ai.myinfostream.com/api/papers?days=7&starred=1");
const resStar = await papersGet({ request: reqStar, env: {} });
const dataStar = await resStar.json();
check(dataStar.items.every(p => p.is_starred === 1), "全部返回精选论文");
check(dataStar.total === 15, "精选论文总数匹配 15 篇", String(dataStar.total));

console.log("\n===== 测试 4: 2026 全年周刊概览与单周查询 (Weekly Almanac) =====");
const reqWeeks = new Request("https://ai.myinfostream.com/api/papers?weeks_overview=1");
const resWeeks = await papersGet({ request: reqWeeks, env: {} });
check(resWeeks.status === 200, "周概览 HTTP 200");
const dataWeeks = await resWeeks.json();
check(dataWeeks.success === true, "周概览 success=true");
check(Array.isArray(dataWeeks.weeks) && dataWeeks.weeks.length > 0, "返回有效周刊列表", `总周数: ${dataWeeks.weeks?.length}`);
check(dataWeeks.weeks.some(w => w.week === "2026-W44"), "周刊列表包含 2026-W44");

const reqW44 = new Request("https://ai.myinfostream.com/api/papers?week=2026-W44");
const resW44 = await papersGet({ request: reqW44, env: {} });
check(resW44.status === 200, "单周查询 HTTP 200");
const dataW44 = await resW44.json();
check(dataW44.stats && dataW44.stats.mode === "week", "模式为 week 模式");
check(dataW44.stats && dataW44.stats.week === "2026-W44", "周标记匹配 2026-W44");
check(Array.isArray(dataW44.daily) && dataW44.daily.length === 7, "单周包含完整 7 天柱状图 (周一至周日)", String(dataW44.daily?.length));
check(dataW44.daily.every(d => d.dayName && d.fullDate), "柱状图每日包含星期与完整日期");

console.log("\n===== 测试 5: Clean URL 落地页 /papers 渲染 =====");
const rawHtml = readFileSync(new URL("./papers.html", import.meta.url), "utf8");
const mockEnv = {
  ASSETS: {
    async fetch(r) {
      return new Response(rawHtml, { status: 200, headers: { "Content-Type": "text/html" } });
    }
  }
};
const pageReq = new Request("https://ai.myinfostream.com/papers");
const pageRes = await papersPage({ request: pageReq, env: mockEnv });
check(pageRes.status === 200, "落地页 HTTP 200");
const pageHtml = await pageRes.text();
check(pageHtml.includes('rel="canonical" href="https://ai.myinfostream.com/papers"'), "Canonical 指向本域 /papers");
check(pageHtml.includes('ca-pub-1130777358854864'), "包含 Google AdSense 验证代码");
check(pageHtml.includes('id="sparkWrap"'), "包含每日动态柱状图容器");
check(pageHtml.includes('id="timelineList"'), "包含时间轴容器");

console.log(`\n${fail === 0 ? "全部通过" : fail + " 项不达标"}`);
process.exit(fail === 0 ? 0 : 1);

