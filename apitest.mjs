// apitest.mjs —— API 层验证：按 host + tab 真调 onRequest，检查分发与字段完整性
import { onRequest as feed } from "./functions/api/feed.js";

const req = (host, qs = "") => new Request(`https://${host}/api/feed?${qs}`, {
  headers: { host, origin: `https://${host}` },
});

const HOSTS = [
  "myinfostream.com",
  "ai.myinfostream.com",
  "news.myinfostream.com",
  "game.myinfostream.com",
  "hot.myinfostream.com",
];
let fail = 0;

// 把 tab 按「源组合」分组，只真打一次接口。
//
// 为什么这么写：game 站的三个 tab 声明的是同一个源 games（见 hosts.js 注释），
// 逐 tab 打就是连续三次打 EPIC —— 那正是这个设计要避免的上游放大。
// 合并成一次打，既快，也顺带把「同源 tab 真的共用一次请求」变成可验证事实：
// 打印出来的耗时/条数就是真实成本，不是三倍放大的虚高数字。
const bySources = (tabs) => {
  const m = new Map();
  for (const t of tabs) {
    const k = t.sources.join(",");
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(t);
  }
  return [...m.values()];
};

for (const host of HOSTS) {
  console.log(`\n===== ${host} =====`);
  // 先拿 tab 列表
  const { HOSTS: CFG } = await import("./functions/_lib/hosts.js");
  const tabs = CFG[host].tabs;
  console.log(`tabs: ${tabs.map((t) => t.id).join(", ")}`);

  for (const group of bySources(tabs)) {
    const t = group[0];
    const t0 = Date.now();
    const res = await feed({ request: req(host, `tab=${t.id}&lang=${CFG[host].defaultLang}`), env: {} });
    const body = await res.json();
    const ms = Date.now() - t0;
    const items = body.items || [];
    const bad = items.filter((x) => !x.title || !x.url || !x.ts);
    const langs = {};
    for (const x of items) langs[x.lang] = (langs[x.lang] || 0) + 1;
    const regions = {};
    for (const x of items) regions[x.region] = (regions[x.region] || 0) + 1;
    const ok = res.status === 200 && items.length > 0 && bad.length === 0 && body.tab === t.id;
    if (!ok) fail++;
    const shared = group.length > 1 ? `  ← 共用此源，${group.map((x) => x.id).join("/")} 三个 tab 客户端再按 badge.k 收窄` : "";
    console.log(`  ${ok ? "OK  " : "FAIL"} /api/feed?tab=${t.id.padEnd(8)} ${String(items.length).padStart(3)}条 ${String(ms).padStart(5)}ms  site=${body.site} tab=${body.tab}${shared}`);
    console.log(`       lang=${JSON.stringify(langs)}`);
    console.log(`       region=${JSON.stringify(regions)}`);
    if (bad.length) console.log(`       !! 字段缺失 ${bad.length} 条: ${JSON.stringify(bad[0]).slice(0, 120)}`);

    // 共源 tab 必须真的切得开：按各自口径过一遍，任一为空说明客户端过滤会白屏
    if (group.length > 1) {
      for (const sub of group) {
        const scoped = items.filter((it) => it.badge && it.badge.k === sub.id);
        const subOk = scoped.length > 0;
        if (!subOk) fail++;
        console.log(`       ${subOk ? "OK  " : "FAIL"} 切片 tab=${sub.id.padEnd(6)} -> ${scoped.length} 条${subOk ? "" : "  ← 客户端过滤后会是空白页"}`);
      }
    }
  }

  // 未知 tab 回落测试
  const r2 = await feed({ request: req(host, "tab=__nope__"), env: {} });
  const b2 = await r2.json();
  const fbOk = b2.tab === tabs[0].id && b2.count > 0;
  if (!fbOk) fail++;
  console.log(`  ${fbOk ? "OK  " : "FAIL"} 未知 tab 回落 -> ${b2.tab} (${b2.count}条)`);
}

// 跨站盗用测试：Origin 与 host 不一致应 403
const res = await feed({
  request: new Request("https://news.myinfostream.com/api/feed?tab=top", {
    headers: { host: "news.myinfostream.com", origin: "https://evil.example.com" },
  }),
  env: {},
});
const crossOk = res.status === 403;
if (!crossOk) fail++;
console.log(`\n${crossOk ? "OK  " : "FAIL"} 跨站 Origin -> HTTP ${res.status}`);

console.log(`\n${fail === 0 ? "全部通过" : fail + " 项不达标"}`);
process.exit(fail === 0 ? 0 : 1);