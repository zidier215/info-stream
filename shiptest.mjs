// shiptest.mjs - Unit test for /ship route and API
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { onRequest as apiShipGet } from "./functions/api/ship.js";
import { onRequest as shipPageGet } from "./functions/ship.js";
import { PAYMENTS_DATA, INCORPORATION_DATA, DISTRIBUTION_DATA, STACK_DATA, SHIP_RULES } from "./functions/_lib/ship_seed.js";

const mockEnv = {
  ASSETS: {
    fetch: async (r) => {
      const u = new URL(r.url);
      if (u.pathname === "/ship.html") {
        return new Response(readFileSync("./ship.html", "utf8"), {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }
      return new Response("Not Found", { status: 404 });
    },
  },
};

console.log("=== Testing functions/_lib/ship_seed.js ===");
assert.ok(Array.isArray(PAYMENTS_DATA) && PAYMENTS_DATA.length >= 4, "PAYMENTS_DATA has at least 4 items");
assert.ok(Array.isArray(INCORPORATION_DATA) && INCORPORATION_DATA.length >= 4, "INCORPORATION_DATA has at least 4 items");
assert.ok(Array.isArray(DISTRIBUTION_DATA) && DISTRIBUTION_DATA.length >= 4, "DISTRIBUTION_DATA has at least 4 items");
assert.ok(Array.isArray(STACK_DATA) && STACK_DATA.length >= 5, "STACK_DATA has at least 5 items");
assert.ok(Array.isArray(SHIP_RULES) && SHIP_RULES.length >= 6, "SHIP_RULES has at least 6 rules");
console.log("  OK ship_seed.js data integrity verified");

console.log("=== Testing /api/ship?overview=1 ===");
{
  const req = new Request("https://myinfostream.com/api/ship?overview=1");
  const res = await apiShipGet({ request: req, env: {} });
  assert.equal(res.status, 200, "status 200");
  assert.ok(res.headers.get("content-type").includes("application/json"), "JSON content type");
  assert.ok(res.headers.get("cache-control").includes("public"), "Edge caching enabled");
  const data = await res.json();
  assert.equal(data.success, true, "success true");
  assert.ok(data.stats, "has stats");
  assert.ok(data.stats.payments_count >= 4, "payments_count >= 4");
  assert.ok(data.stats.incorporation_count >= 4, "incorporation_count >= 4");
  assert.ok(data.stats.distribution_count >= 4, "distribution_count >= 4");
  assert.ok(data.stats.stack_count >= 5, "stack_count >= 5");
  assert.ok(data.stats.rules_count >= 6, "rules_count >= 6");
  console.log(`  OK /api/ship?overview=1 returned stats: total ${data.stats.total_items} items`);
}

console.log("=== Testing /api/ship?tab=payments ===");
{
  const req = new Request("https://myinfostream.com/api/ship?tab=payments");
  const res = await apiShipGet({ request: req, env: {} });
  const data = await res.json();
  assert.equal(data.success, true, "success true");
  assert.ok(data.data.payments.length >= 4, "tab=payments has items");
  assert.equal(data.data.incorporation, undefined, "incorporation not included");
  console.log(`  OK /api/ship?tab=payments returned ${data.data.payments.length} items`);
}

console.log("=== Testing /api/ship?q=stripe ===");
{
  const req = new Request("https://myinfostream.com/api/ship?q=stripe");
  const res = await apiShipGet({ request: req, env: {} });
  const data = await res.json();
  assert.equal(data.success, true, "success true");
  assert.ok(data.data.payments.length >= 1, "search stripe returns matches");
  assert.ok(data.data.payments.some(i => i.name.toLowerCase().includes("stripe")), "stripe match found");
  console.log(`  OK /api/ship?q=stripe returned ${data.data.payments.length} items`);
}

console.log("=== Testing /ship SSR ===");
{
  const req = new Request("https://myinfostream.com/ship");
  const res = await shipPageGet({ request: req, env: mockEnv });
  assert.equal(res.status, 200, "status 200");
  assert.ok(res.headers.get("content-type").includes("text/html"), "HTML content type");
  const html = await res.text();
  assert.ok(html.includes("<!DOCTYPE html>"), "Contains <!DOCTYPE html>");
  assert.ok(html.includes("出海造筏与一人公司"), "Contains Chinese title");
  assert.ok(html.includes("https://myinfostream.com/ship"), "Contains canonical URL");
  assert.ok(html.includes("Stripe"), "Contains pre-rendered Stripe");
  assert.ok(html.includes("Lemon Squeezy"), "Contains pre-rendered Lemon Squeezy");
  console.log("  OK /ship SSR returned full HTML with pre-rendered cards");
}

console.log("=== Testing /ship/ 301 Trailing Slash Redirect ===");
{
  const req = new Request("https://myinfostream.com/ship/");
  const res = await shipPageGet({ request: req, env: {} });
  assert.equal(res.status, 301, "status 301");
  assert.equal(res.headers.get("location"), "https://myinfostream.com/ship", "Redirects to clean URL");
  console.log("  OK /ship/ redirects to /ship with 301");
}

console.log("=== Testing Subdomain Redirect to Main Host ===");
{
  const req = new Request("https://ai.myinfostream.com/ship");
  const res = await shipPageGet({ request: req, env: {} });
  assert.equal(res.status, 301, "status 301");
  assert.equal(res.headers.get("location"), "https://myinfostream.com/ship", "Subdomain redirects to main");
  console.log("  OK Subdomain /ship redirects to main host with 301");
}

console.log("\nALL SHIP TESTS PASSED!");
