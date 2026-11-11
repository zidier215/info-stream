// opensourcetest.mjs —— 开源与AI替代通鉴路由与接口专项自动化测试
import assert from "node:assert/strict";
import { onRequest as apiHandler } from "./functions/api/opensource.js";
import { onRequest as pageHandler } from "./functions/opensource.js";
import { readFileSync } from "node:fs";

console.log("===== 测试 1: GET /api/opensource?overview=1 看板统计 =====");
{
  const req = new Request("https://myinfostream.com/api/opensource?overview=1", { method: "GET" });
  const res = await apiHandler({ request: req, env: {} });
  assert.equal(res.status, 200, "Overview 状态码应为 200");
  const data = await res.json();
  assert.equal(data.success, true, "success 字段应为 true");
  assert.ok(data.stats.total >= 10, `收录商业软件应充足 (当前 ${data.stats.total} 款)`);
  assert.ok(data.stats.total_annual_saving_usd > 3000, "年化节省应达数千美元以上");
  assert.ok(data.stats.ai_disrupted_count >= 3, "大模型降维收录应充足");
  console.log(`  OK   Overview 接口正常: 共收录 ${data.stats.total} 款，年化节省估算 $${data.stats.total_annual_saving_usd}，AI降维率 ${data.stats.ai_disruption_rate}`);
}

console.log("\n===== 测试 2: 分类与大模型降维形态筛选 =====");
{
  const req = new Request("https://myinfostream.com/api/opensource?type=ai", { method: "GET" });
  const res = await apiHandler({ request: req, env: {} });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(data.items.length > 0, "AI 降维筛选结果应大于 0");
  for (const it of data.items) {
    assert.ok(it.disruption_type === "ai" || it.disruption_type === "hybrid", "应全部为 AI 降维或混合重构");
  }
  console.log(`  OK   AI 降维筛选正常: 返回 ${data.items.length} 款`);
}

console.log("\n===== 测试 3: 关键词检索 (如 Notion, Zapier) =====");
{
  const req = new Request("https://myinfostream.com/api/opensource?q=notion", { method: "GET" });
  const res = await apiHandler({ request: req, env: {} });
  const data = await res.json();
  assert.ok(data.items.length >= 1, "应检索出 Notion 对应条目");
  assert.ok(data.items[0].target_software.toLowerCase().includes("notion"));
  console.log(`  OK   关键词检索正常，命中: ${data.items[0].name_cn}`);
}

console.log("\n===== 测试 4: Clean URL /opensource SSR 落地页直出 =====");
{
  const mockEnv = {
    ASSETS: {
      fetch: async (r) => {
        const u = new URL(r.url);
        if (u.pathname === "/opensource.html") {
          return new Response(readFileSync("./opensource.html", "utf8"), {
            status: 200,
            headers: { "Content-Type": "text/html; charset=utf-8" },
          });
        }
        return new Response("Not Found", { status: 404 });
      },
    },
  };

  const req = new Request("https://myinfostream.com/opensource", { method: "GET" });
  const res = await pageHandler({ request: req, env: mockEnv });
  assert.equal(res.status, 200, "落地页 HTTP 响应应为 200");
  const html = await res.text();
  assert.ok(html.includes("https://myinfostream.com/opensource"), "Canonical 地址应规范");
  assert.ok(html.includes("ca-pub-1130777358854864"), "应包含 Google AdSense 凭据");
  assert.ok(html.includes("大模型对该类 SaaS 的降维打击机制剖析"), "应包含大模型降维机制解析");
  assert.ok(html.includes("AppFlowy"), "SSR 首屏应直出核心开源方案");
  assert.ok(html.includes("bookmarkBtn"), "应包含顶层智能收藏按钮");
  console.log("  OK   落地页 HTTP 200, Canonical 规范, 包含 AdSense, SSR 完整直出");
}

console.log("\n===== 测试 5: /opensource/ 尾部斜杠 301 规范重定向 =====");
{
  const req = new Request("https://myinfostream.com/opensource/", { method: "GET" });
  const res = await pageHandler({ request: req, env: {} });
  assert.equal(res.status, 301, "带斜杠请求应 301 重定向");
  assert.equal(res.headers.get("location"), "https://myinfostream.com/opensource", "目标应为规范无斜杠地址");
  console.log("  OK   /opensource/ 成功 301 重定向至规范地址");
}

console.log("\n✓ 全部 5 项测试通过！");

