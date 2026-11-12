// truthtest.mjs - Unit & integration tests for /truth route and /api/truth API
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { onRequest as apiTruthGet } from "./functions/api/truth.js";
import { onRequest as truthPageGet } from "./functions/truth.js";
import { TRUTH_I18N, TRUTH_CASES, REGIONS, VERDICTS } from "./functions/_lib/truth_seed.js";

const mockEnv = {
  ASSETS: {
    fetch: async (r) => {
      const u = new URL(r.url);
      if (u.pathname === "/truth.html") {
        return new Response(readFileSync("./truth.html", "utf8"), {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }
      return new Response("Not Found", { status: 404 });
    },
  },
};

console.log("=== 1. Testing functions/_lib/truth_seed.js Integrity ===");
assert.ok(Array.isArray(TRUTH_CASES) && TRUTH_CASES.length >= 10, "TRUTH_CASES has at least 10 dossiers");
assert.ok(REGIONS.length >= 6, "REGIONS has at least 6 categories (all, china, germany, japan, americas, global)");
assert.ok(VERDICTS.length === 3, "VERDICTS has 3 types (myth, half-truth, pseudoscience)");

const requiredLangs = ["zh", "zh-Hant", "en", "ja", "de"];
for (const lang of requiredLangs) {
  assert.ok(TRUTH_I18N[lang], `TRUTH_I18N contains language: ${lang}`);
  assert.ok(TRUTH_I18N[lang].siteTitle, `TRUTH_I18N[${lang}] has siteTitle`);
  assert.ok(TRUTH_I18N[lang].step1Title, `TRUTH_I18N[${lang}] has step1Title`);
  assert.ok(TRUTH_I18N[lang].step5Title, `TRUTH_I18N[${lang}] has step5Title`);
}

for (const c of TRUTH_CASES) {
  assert.ok(c.id, "Case has id");
  assert.ok(c.no, "Case has case number");
  assert.ok(c.region, "Case has region");
  assert.ok(c.verdict, "Case has verdict");
  assert.ok(typeof c.toxicity === "number" && c.toxicity >= 1 && c.toxicity <= 10, "Toxicity is 1-10");
  for (const l of requiredLangs) {
    assert.ok(c.titles && c.titles[l], `Case ${c.id} has title in ${l}`);
    assert.ok(c.quotes && c.quotes[l], `Case ${c.id} has quote in ${l}`);
    assert.ok(c.flaws && c.flaws[l], `Case ${c.id} has flaw analysis in ${l}`);
    assert.ok(c.corrections && c.corrections[l], `Case ${c.id} has truth correction in ${l}`);
  }
}
console.log(`  OK truth_seed.js verified: ${TRUTH_CASES.length} cases in 5 languages across ${REGIONS.length} regions.`);

console.log("\n=== 2. Testing /api/truth?overview=1 ===");
{
  const req = new Request("https://myinfostream.com/api/truth?overview=1");
  const res = await apiTruthGet({ request: req, env: {} });
  assert.equal(res.status, 200, "status 200");
  assert.ok(res.headers.get("content-type").includes("application/json"), "JSON content type");
  assert.ok(res.headers.get("cache-control").includes("public"), "Edge caching enabled");
  const data = await res.json();
  assert.equal(data.success, true, "success true");
  assert.ok(data.stats, "has stats");
  assert.equal(data.stats.total_cases, TRUTH_CASES.length, "total_cases matches");
  assert.deepEqual(data.stats.supported_languages, requiredLangs, "languages match");
  console.log(`  OK /api/truth?overview=1 returned stats for ${data.stats.total_cases} cases`);
}

console.log("\n=== 3. Testing /api/truth Filter by Region ===");
{
  const req = new Request("https://myinfostream.com/api/truth?region=germany");
  const res = await apiTruthGet({ request: req, env: {} });
  const data = await res.json();
  assert.equal(data.success, true);
  assert.ok(data.cases.length >= 2, "germany has cases");
  assert.ok(data.cases.every(c => c.region === "germany"), "all returned cases are in germany");
  console.log(`  OK /api/truth?region=germany returned ${data.cases.length} cases`);
}

console.log("\n=== 4. Testing /api/truth Filter by Verdict & Language ===");
{
  const req = new Request("https://myinfostream.com/api/truth?verdict=myth&lang=ja");
  const res = await apiTruthGet({ request: req, env: {} });
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.lang, "ja");
  assert.ok(data.cases.every(c => c.verdict === "myth"), "all returned cases are myth");
  assert.ok(data.i18n.siteTitle.includes("脱神話"), "Japanese i18n title returned");
  console.log(`  OK /api/truth?verdict=myth&lang=ja returned ${data.cases.length} cases with JA i18n`);
}

console.log("\n=== 5. Testing /api/truth Sort by Toxicity ===");
{
  const req = new Request("https://myinfostream.com/api/truth?sort=toxicity");
  const res = await apiTruthGet({ request: req, env: {} });
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.cases[0].toxicity, 10, "highest toxicity is 10");
  for (let i = 1; i < data.cases.length; i++) {
    assert.ok(data.cases[i - 1].toxicity >= data.cases[i].toxicity, "sorted descending");
  }
  console.log(`  OK /api/truth?sort=toxicity verified descending order`);
}

console.log("\n=== 6. Testing /truth SSR Page Rendering ===");
{
  const req = new Request("https://myinfostream.com/truth");
  const res = await truthPageGet({ request: req, env: mockEnv });
  assert.equal(res.status, 200, "status 200");
  assert.ok(res.headers.get("content-type").includes("text/html"), "HTML content type");
  const html = await res.text();
  assert.ok(html.includes("<!DOCTYPE html>"), "Contains <!DOCTYPE html>");
  assert.ok(html.includes("认知求真与毒鸡汤避雷通鉴"), "Contains Chinese title");
  assert.ok(html.includes("https://myinfostream.com/truth"), "Contains canonical URL");
  assert.ok(html.includes("青岛油纸包零件神话"), "Contains pre-rendered Qingdao case");
  assert.ok(html.includes("野田圣子"), "Contains pre-rendered toilet water case");
  assert.ok(html.includes("window.__TRUTH_DATA__"), "Inlines window.__TRUTH_DATA__");
  assert.ok(html.includes("ca-pub-1130777358854864"), "Contains Google AdSense publisher ID");
  console.log("  OK /truth SSR returned full HTML with pre-rendered cards & seed data");
}

console.log("\n=== 7. Testing /truth/ 301 Trailing Slash Redirect ===");
{
  const req = new Request("https://myinfostream.com/truth/");
  const res = await truthPageGet({ request: req, env: mockEnv });
  assert.equal(res.status, 301, "status 301");
  assert.equal(res.headers.get("location"), "https://myinfostream.com/truth", "Redirects to clean URL");
  console.log("  OK /truth/ redirects to /truth with 301");
}

console.log("\n=== 8. Testing Subdomain Redirect to Main Host ===");
{
  const req = new Request("https://ai.myinfostream.com/truth");
  const res = await truthPageGet({ request: req, env: mockEnv });
  assert.equal(res.status, 301, "status 301");
  assert.equal(res.headers.get("location"), "https://myinfostream.com/truth", "Subdomain redirects to main");
  console.log("  OK Subdomain /truth redirects to main host with 301");
}

console.log("\nALL TRUTH TESTS PASSED!");

