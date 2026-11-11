// firetest.mjs - Unit test for /fire route and API
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { onRequest as apiFireGet } from "./functions/api/fire.js";
import { onRequest as firePageGet } from "./functions/fire.js";
import { PORTFOLIO_MODELS, ETF_TAX_EFFICIENCY, FIRE_METHODOLOGY } from "./functions/_lib/fire_seed.js";

const mockEnv = {
  ASSETS: {
    fetch: async (r) => {
      const u = new URL(r.url);
      if (u.pathname === "/fire.html") {
        return new Response(readFileSync("./fire.html", "utf8"), {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }
      return new Response("Not Found", { status: 404 });
    },
  },
};

console.log("=== Testing functions/_lib/fire_seed.js ===");
assert.ok(Array.isArray(PORTFOLIO_MODELS) && PORTFOLIO_MODELS.length >= 4, "PORTFOLIO_MODELS has >= 4 items");
assert.ok(Array.isArray(ETF_TAX_EFFICIENCY) && ETF_TAX_EFFICIENCY.length >= 4, "ETF_TAX_EFFICIENCY has >= 4 items");
assert.ok(Array.isArray(FIRE_METHODOLOGY) && FIRE_METHODOLOGY.length >= 3, "FIRE_METHODOLOGY has >= 3 items");
console.log("  OK fire_seed.js data integrity verified");

console.log("=== Testing /api/fire?overview=1 ===");
{
  const req = new Request("https://myinfostream.com/api/fire?overview=1");
  const res = await apiFireGet({ request: req, env: {} });
  assert.equal(res.status, 200, "status 200");
  assert.ok(res.headers.get("content-type").includes("application/json"), "JSON content type");
  assert.ok(res.headers.get("cache-control").includes("public"), "Edge caching enabled");
  const data = await res.json();
  assert.equal(data.success, true, "success true");
  assert.ok(data.stats, "has stats");
  assert.ok(data.stats.models_count >= 4, "models_count >= 4");
  assert.ok(data.stats.etfs_count >= 4, "etfs_count >= 4");
  assert.ok(data.stats.rules_count >= 3, "rules_count >= 3");
  console.log(`  OK /api/fire?overview=1 returned stats: total ${data.stats.total_items} items`);
}

console.log("=== Testing /api/fire?tab=models ===");
{
  const req = new Request("https://myinfostream.com/api/fire?tab=models");
  const res = await apiFireGet({ request: req, env: {} });
  const data = await res.json();
  assert.equal(data.success, true, "success true");
  assert.ok(data.data.models.length >= 4, "tab=models has items");
  assert.equal(data.data.etfs, undefined, "etfs not included");
  console.log(`  OK /api/fire?tab=models returned ${data.data.models.length} items`);
}

console.log("=== Testing /api/fire?q=dalio ===");
{
  const req = new Request("https://myinfostream.com/api/fire?q=dalio");
  const res = await apiFireGet({ request: req, env: {} });
  const data = await res.json();
  assert.equal(data.success, true, "success true");
  assert.ok(data.data.models.length >= 1, "search dalio returns matches");
  assert.ok(data.data.models.some(i => i.name.toLowerCase().includes("达利欧") || i.author.toLowerCase().includes("dalio")), "dalio match found");
  console.log(`  OK /api/fire?q=dalio returned ${data.data.models.length} items`);
}

console.log("=== Testing /fire SSR ===");
{
  const req = new Request("https://myinfostream.com/fire");
  const res = await firePageGet({ request: req, env: mockEnv });
  assert.equal(res.status, 200, "status 200");
  assert.ok(res.headers.get("content-type").includes("text/html"), "HTML content type");
  const html = await res.text();
  assert.ok(html.includes("<!DOCTYPE html>"), "Contains <!DOCTYPE html>");
  assert.ok(html.includes("全球指数化投资与经典资产配置模型"), "Contains Chinese title");
  assert.ok(html.includes("https://myinfostream.com/fire"), "Contains canonical URL");
  assert.ok(html.includes("全天候组合"), "Contains pre-rendered All Weather");
  assert.ok(html.includes("永久投资组合"), "Contains pre-rendered Permanent Portfolio");
  console.log("  OK /fire SSR returned full HTML with pre-rendered cards");
}

console.log("=== Testing /fire/ 301 Trailing Slash Redirect ===");
{
  const req = new Request("https://myinfostream.com/fire/");
  const res = await firePageGet({ request: req, env: mockEnv });
  assert.equal(res.status, 301, "status 301");
  assert.equal(res.headers.get("location"), "https://myinfostream.com/fire", "Redirects to clean URL");
  console.log("  OK /fire/ redirects to /fire with 301");
}

console.log("=== Testing Subdomain Redirect to Main Host ===");
{
  const req = new Request("https://ai.myinfostream.com/fire");
  const res = await firePageGet({ request: req, env: mockEnv });
  assert.equal(res.status, 301, "status 301");
  assert.equal(res.headers.get("location"), "https://myinfostream.com/fire", "Subdomain redirects to main");
  console.log("  OK Subdomain /fire redirects to main host with 301");
}

console.log("\nALL FIRE TESTS PASSED!");
