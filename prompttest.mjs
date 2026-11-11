// prompttest.mjs - Unit test for /prompt route and API
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { onRequest as apiPromptGet } from "./functions/api/prompt.js";
import { onRequest as promptPageGet } from "./functions/prompt.js";
import { PROMPT_PATTERNS, AGENT_WORKFLOWS, SYSTEM_PROMPTS } from "./functions/_lib/prompt_seed.js";

const mockEnv = {
  ASSETS: {
    fetch: async (r) => {
      const u = new URL(r.url);
      if (u.pathname === "/prompt.html") {
        return new Response(readFileSync("./prompt.html", "utf8"), {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }
      return new Response("Not Found", { status: 404 });
    },
  },
};

console.log("=== Testing functions/_lib/prompt_seed.js ===");
assert.ok(Array.isArray(PROMPT_PATTERNS) && PROMPT_PATTERNS.length >= 8, "PROMPT_PATTERNS has >= 8 items");
assert.ok(Array.isArray(AGENT_WORKFLOWS) && AGENT_WORKFLOWS.length >= 5, "AGENT_WORKFLOWS has >= 5 items");
assert.ok(Array.isArray(SYSTEM_PROMPTS) && SYSTEM_PROMPTS.length >= 4, "SYSTEM_PROMPTS has >= 4 items");
console.log("  OK prompt_seed.js data integrity verified");

console.log("=== Testing /api/prompt?overview=1 ===");
{
  const req = new Request("https://myinfostream.com/api/prompt?overview=1");
  const res = await apiPromptGet({ request: req, env: {} });
  assert.equal(res.status, 200, "status 200");
  assert.ok(res.headers.get("content-type").includes("application/json"), "JSON content type");
  assert.ok(res.headers.get("cache-control").includes("public"), "Edge caching enabled");
  const data = await res.json();
  assert.equal(data.success, true, "success true");
  assert.ok(data.stats, "has stats");
  assert.ok(data.stats.patterns_count >= 8, "patterns_count >= 8");
  assert.ok(data.stats.agents_count >= 5, "agents_count >= 5");
  assert.ok(data.stats.prompts_count >= 4, "prompts_count >= 4");
  console.log(`  OK /api/prompt?overview=1 returned stats: total ${data.stats.total_items} items`);
}

console.log("=== Testing /api/prompt?tab=patterns ===");
{
  const req = new Request("https://myinfostream.com/api/prompt?tab=patterns");
  const res = await apiPromptGet({ request: req, env: {} });
  const data = await res.json();
  assert.equal(data.success, true, "success true");
  assert.ok(data.data.patterns.length >= 8, "tab=patterns has items");
  assert.equal(data.data.agents, undefined, "agents not included");
  console.log(`  OK /api/prompt?tab=patterns returned ${data.data.patterns.length} items`);
}

console.log("=== Testing /api/prompt?q=react ===");
{
  const req = new Request("https://myinfostream.com/api/prompt?q=react");
  const res = await apiPromptGet({ request: req, env: {} });
  const data = await res.json();
  assert.equal(data.success, true, "success true");
  assert.ok(data.data.patterns.length >= 1, "search react returns matches");
  assert.ok(data.data.patterns.some(i => i.name.toLowerCase().includes("react")), "react match found");
  console.log(`  OK /api/prompt?q=react returned ${data.data.patterns.length} items`);
}

console.log("=== Testing /prompt SSR ===");
{
  const req = new Request("https://myinfostream.com/prompt");
  const res = await promptPageGet({ request: req, env: mockEnv });
  assert.equal(res.status, 200, "status 200");
  assert.ok(res.headers.get("content-type").includes("text/html"), "HTML content type");
  const html = await res.text();
  assert.ok(html.includes("<!DOCTYPE html>"), "Contains <!DOCTYPE html>");
  assert.ok(html.includes("高阶提示词模式与自主 Agent 架构通鉴"), "Contains Chinese title");
  assert.ok(html.includes("https://myinfostream.com/prompt"), "Contains canonical URL");
  assert.ok(html.includes("Chain-of-Thought"), "Contains pre-rendered Chain-of-Thought");
  assert.ok(html.includes("Tree-of-Thoughts"), "Contains pre-rendered Tree-of-Thoughts");
  console.log("  OK /prompt SSR returned full HTML with pre-rendered cards");
}

console.log("=== Testing /prompt/ 301 Trailing Slash Redirect ===");
{
  const req = new Request("https://myinfostream.com/prompt/");
  const res = await promptPageGet({ request: req, env: mockEnv });
  assert.equal(res.status, 301, "status 301");
  assert.equal(res.headers.get("location"), "https://myinfostream.com/prompt", "Redirects to clean URL");
  console.log("  OK /prompt/ redirects to /prompt with 301");
}

console.log("=== Testing Subdomain Redirect to Main Host ===");
{
  const req = new Request("https://ai.myinfostream.com/prompt");
  const res = await promptPageGet({ request: req, env: mockEnv });
  assert.equal(res.status, 301, "status 301");
  assert.equal(res.headers.get("location"), "https://myinfostream.com/prompt", "Subdomain redirects to main");
  console.log("  OK Subdomain /prompt redirects to main host with 301");
}

console.log("\nALL PROMPT TESTS PASSED!");

