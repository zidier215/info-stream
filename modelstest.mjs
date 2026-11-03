// modelstest.mjs —— AI 大模型演进编年史与跑分评测档案系统测试套件
import assert from "node:assert/strict";
import { onRequestGet as apiModelsGet } from "./functions/api/models.js";
import { onRequest as modelsPageGet } from "./functions/models.js";

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

console.log("===== 测试 1: GET /api/models?overview=1 种子模式看板统计 =====");
await testAsync("Overview 统计指标完整性", async () => {
  const req = new Request("https://ai.myinfostream.com/api/models?overview=1");
  const res = await apiModelsGet({ request: req, env: {} });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.ok(data.total_models >= 40, `收录模型数 >= 40 (实际: ${data.total_models})`);
  assert.ok(data.frontier_count >= 20, `Frontier 旗舰数 >= 20 (实际: ${data.frontier_count})`);
  assert.ok(data.open_weights_count >= 20, `开源权重数 >= 20 (实际: ${data.open_weights_count})`);
  assert.ok(data.reasoning_count >= 8, `深度推理思考模型数 >= 8 (实际: ${data.reasoning_count})`);
  assert.ok(data.max_elo >= 1350, `最高 LMSYS ELO >= 1350 (实际: ${data.max_elo})`);
  assert.ok(data.max_context >= 1000000, `最大上下文 >= 1M Tokens (实际: ${data.max_context})`);
  assert.ok(data.orgs && data.orgs.length >= 6, `研究机构数 >= 6 (实际: ${data.orgs?.length})`);
  assert.ok(data.years && data.years.length >= 4, `年份覆盖完整 (实际: ${data.years?.length}年)`);
});

console.log("\n===== 测试 2: 机构、开源形态与推理类型筛选 =====");
await testAsync("DeepSeek 机构筛选", async () => {
  const req = new Request("https://ai.myinfostream.com/api/models?org=DeepSeek");
  const res = await apiModelsGet({ request: req, env: {} });
  const data = await res.json();
  assert.equal(data.success, true);
  assert.ok(data.items.length >= 4, `DeepSeek 模型数 >= 4 (实际: ${data.items.length})`);
  for (const m of data.items) {
    assert.equal(m.org, "DeepSeek");
  }
});

await testAsync("开源权重形态筛选", async () => {
  const req = new Request("https://ai.myinfostream.com/api/models?license=open");
  const res = await apiModelsGet({ request: req, env: {} });
  const data = await res.json();
  assert.equal(data.success, true);
  assert.ok(data.items.length > 0);
  for (const m of data.items) {
    assert.ok(m.license_type === "open_weights" || m.license_type === "open_source");
  }
});

await testAsync("深度思考 Reasoning 模型筛选", async () => {
  const req = new Request("https://ai.myinfostream.com/api/models?is_reasoning=1");
  const res = await apiModelsGet({ request: req, env: {} });
  const data = await res.json();
  assert.equal(data.success, true);
  assert.ok(data.items.length >= 8);
  for (const m of data.items) {
    assert.equal(m.is_reasoning, 1);
  }
});

console.log("\n===== 测试 3: 搜索与排序 =====");
await testAsync("搜索 'Claude' 关键词", async () => {
  const req = new Request("https://ai.myinfostream.com/api/models?q=claude");
  const res = await apiModelsGet({ request: req, env: {} });
  const data = await res.json();
  assert.ok(data.items.length >= 5);
  for (const m of data.items) {
    assert.ok(m.name.toLowerCase().includes("claude") || m.org.toLowerCase().includes("claude"));
  }
});

await testAsync("按 LMSYS Arena ELO 从高到低排序", async () => {
  const req = new Request("https://ai.myinfostream.com/api/models?sort=elo&pageSize=20");
  const res = await apiModelsGet({ request: req, env: {} });
  const data = await res.json();
  for (let i = 0; i < data.items.length - 1; i++) {
    assert.ok((data.items[i].arena_elo || 0) >= (data.items[i + 1].arena_elo || 0));
  }
});

await testAsync("按上下文窗口从长到短排序", async () => {
  const req = new Request("https://ai.myinfostream.com/api/models?sort=context&pageSize=10");
  const res = await apiModelsGet({ request: req, env: {} });
  const data = await res.json();
  assert.ok(data.items[0].context_window >= 1000000, "最长上下文达到 1M~2M Tokens");
});

console.log("\n===== 测试 4: Clean URL 落地页 /models 渲染 =====");
import fs from "fs";
const mockHtml = fs.readFileSync("models.html", "utf8");
const mockEnv = {
  ASSETS: {
    fetch: async () => new Response(mockHtml, { status: 200 }),
  },
};

await testAsync("落地页基础渲染与 Canonical", async () => {
  const req = new Request("https://ai.myinfostream.com/models");
  const res = await modelsPageGet({ request: req, env: mockEnv });
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.ok(html.includes('rel="canonical" href="https://ai.myinfostream.com/models"'));
  assert.ok(html.includes("ca-pub-1130777358854864"));
  assert.ok(html.includes("G-JBQYPMLVHR"));
  assert.ok(html.includes('id="statModels"'));
  assert.ok(html.includes('id="statElo"'));
  assert.ok(html.includes('id="sparkBars"'));
  assert.ok(html.includes('id="modelsList"'));
});

await testAsync("带年份参数时 Canonical 自引用与标题定制", async () => {
  const req = new Request("https://ai.myinfostream.com/models?year=2024");
  const res = await modelsPageGet({ request: req, env: mockEnv });
  const html = await res.text();
  assert.ok(html.includes('rel="canonical" href="https://ai.myinfostream.com/models?year=2024"'));
  assert.ok(html.includes("2024 年度划时代 AI 大模型发布全记录"));
});

await testAsync("带机构参数时 Canonical 自引用与标题定制", async () => {
  const req = new Request("https://ai.myinfostream.com/models?org=OpenAI");
  const res = await modelsPageGet({ request: req, env: mockEnv });
  const html = await res.text();
  assert.ok(html.includes('rel="canonical" href="https://ai.myinfostream.com/models?org=OpenAI"'));
  assert.ok(html.includes("OpenAI 历年 AI 大模型全谱系演进与评测档案"));
});

console.log(`\n全部通过: ${pass} 项成功 / ${fail} 项失败`);
if (fail > 0) process.exit(1);

