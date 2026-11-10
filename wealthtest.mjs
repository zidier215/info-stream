// wealthtest.mjs —— 验证人类商业变现与财富杠杆演进通鉴 (/wealth & /api/wealth)
import { readFileSync } from "node:fs";
import { onRequest as wealthPageFn } from "./functions/wealth.js";
import { onRequest as wealthApiFn } from "./functions/api/wealth.js";

const RAW = readFileSync(new URL("./wealth.html", import.meta.url), "utf8");

const env = {
  ASSETS: {
    async fetch(req) {
      const u = new URL(req.url);
      if (u.pathname === "/wealth.html") {
        return new Response(RAW, { status: 200, headers: { "Content-Type": "text/html" } });
      }
      return new Response("Not Found", { status: 404 });
    },
  },
};

let fail = 0;
const ok = (cond, label) => {
  if (!cond) fail++;
  console.log(`  ${cond ? "OK  " : "FAIL"} ${label}`);
};

console.log("===== 测试 1: GET /api/wealth?overview=1 看板统计 =====");
const ovRes = await wealthApiFn({ request: new Request("https://myinfostream.com/api/wealth?overview=1") });
const ov = await ovRes.json();
ok(ovRes.status === 200 && ov.success === true, "Overview HTTP 200 & success=true");
ok(ov.total_methods >= 30, `收录赚钱母范式充足 (${ov.total_methods} 种)`);
ok(ov.solo_count >= 20, `适合普通人/一人公司起步充足 (${ov.solo_count} 种)`);
ok(Array.isArray(ov.eras) && ov.eras.length === 4, "4 大历史纪元齐全");
ok(Array.isArray(ov.leverages) && ov.leverages.length === 6, "6 大底层财富杠杆齐全");

console.log("\n===== 测试 2: 按纪元、杠杆与个体友好筛选 =====");
const r3Res = await wealthApiFn({ request: new Request("https://myinfostream.com/api/wealth?era=recent3&solo=1") });
const r3 = await r3Res.json();
ok(r3.items.length >= 5 && r3.items.every((x) => x.era === "recent3" && x.solo_friendly), `最近三年 AI 期 + 个体友好筛选正常 (${r3.items.length} 种)`);

console.log("\n===== 测试 3: Clean URL /wealth SSR 落地页渲染 =====");
const pageRes = await wealthPageFn({ request: new Request("https://myinfostream.com/wealth", { headers: { host: "myinfostream.com" } }), env });
const html = await pageRes.text();
ok(pageRes.status === 200, "落地页 HTTP 200");
ok(html.includes('rel="canonical" href="https://myinfostream.com/wealth"'), "Canonical 指向 https://myinfostream.com/wealth");
ok(html.includes("ca-pub-1130777358854864") && html.includes("adsbygoogle.js"), "包含 Google AdSense 脚本与 Meta");
ok((html.match(/<article class="w-card"/g) || []).length >= 30, "SSR 首屏直出全部商业变现卡片");

process.exit(fail === 0 ? 0 : 1);
