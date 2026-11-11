// rsstest.mjs —— 验证官方标准 RSS 2.0 聚合订阅源 (/feed.xml 与 /rss.xml)
import assert from "node:assert/strict";
import { onRequest as feedRequest } from "./functions/feed.xml.js";
import { onRequest as rssRequest } from "./functions/rss.xml.js";

console.log("=== 1. 测试 /feed.xml 默认全量订阅源 ===");
{
  const req = new Request("https://myinfostream.com/feed.xml");
  const res = await feedRequest({ request: req, env: {} });
  assert.equal(res.status, 200, "status 200");
  assert.ok(res.headers.get("content-type").includes("application/xml"), "Content-Type 是 application/xml");
  assert.ok(res.headers.get("cache-control").includes("s-maxage=3600"), "带边缘缓存配置");

  const xml = await res.text();
  assert.ok(xml.includes("<rss version=\"2.0\""), "合法 RSS 2.0 根标签");
  assert.ok(xml.includes("<channel>"), "包含 <channel>");
  assert.ok(xml.includes("<title><![CDATA[信息河 · InfoStream 精选订阅源]]></title>"), "包含主频道标题");
  assert.ok(xml.includes("<item>"), "包含文章条目");
  assert.ok(xml.includes("[AI论文]"), "收录 AI 论文条目");
  assert.ok(xml.includes("[大模型编年史]"), "收录 大模型编年史条目");
  assert.ok(xml.includes("[游戏福利]"), "收录 游戏福利条目");
  assert.ok(xml.includes("[破圈大事件]"), "收录 破圈大事件条目");
  assert.ok(xml.includes("[开源替代]"), "收录 开源替代条目");

  const itemCount = (xml.match(/<item>/g) || []).length;
  assert.ok(itemCount >= 20, `聚合条目充足 (实际: ${itemCount} 条)`);
  console.log(`  OK /feed.xml 验证通过，共汇聚 ${itemCount} 条精选条目`);
}

console.log("\n=== 2. 测试 /feed.xml 分类过滤参数 ===");
{
  const reqAi = new Request("https://myinfostream.com/feed.xml?cat=ai");
  const resAi = await feedRequest({ request: reqAi, env: {} });
  const xmlAi = await resAi.text();
  assert.ok(xmlAi.includes("[AI论文]") || xmlAi.includes("[大模型编年史]"), "包含 AI 类目条目");
  assert.ok(!xmlAi.includes("[游戏福利]"), "过滤掉游戏福利条目");
  console.log("  OK ?cat=ai 分类过滤生效");
}

console.log("\n=== 3. 测试 /rss.xml 别名响应 ===");
{
  const reqRss = new Request("https://myinfostream.com/rss.xml");
  const resRss = await rssRequest({ request: reqRss, env: {} });
  assert.equal(resRss.status, 200, "status 200");
  const xmlRss = await resRss.text();
  assert.ok(xmlRss.includes("<rss version=\"2.0\""), "合法 RSS 2.0 根标签");
  console.log("  OK /rss.xml 别名接口验证通过");
}

console.log("\nALL RSS TESTS PASSED!");

