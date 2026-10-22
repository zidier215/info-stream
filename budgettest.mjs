// budgettest.mjs —— 超时预算不变式测试
// ---------------------------------------------------------------------------
// 用法：node budgettest.mjs
//
// 这个文件存在的理由：2026-10-22 一天内出了三次「内层 HTTP 超时 > 外层
// SOURCE_DEADLINE」的事故，全部症状都是「接口 200、JSON 合法、0 条数据」，
// 而且没有一条报错日志。每次都要靠人肉比对三个文件里的数字才发现。
//
// 同一个晚上还发现：所有数据源都用 Google News 通道，一旦限流就是全站空白。
// 所以这里一并检查「站点是否过度依赖单一上游」。
//
// 这些断言的价值不在于测当前值对不对，而在于**任何人以后改动任一超时数字，
// 这个测试立刻变红** —— 把「靠人记住的不变式」变成「CI 强制的不变式」。
// ---------------------------------------------------------------------------
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { HTTP_TIMEOUT, SUB_DEADLINE, SOURCE_DEADLINE, RETRY_DEADLINE, WORST_CASE } from "./functions/_lib/budget.js";

const ROOT = dirname(fileURLToPath(import.meta.url));

let failed = 0;
function ok(cond, msg, extra) {
  console.log((cond ? "  OK   " : "  FAIL ") + msg + (extra ? "  " + extra : ""));
  if (!cond) failed++;
}

console.log("\n=== A. 内层超时必须严格小于外层 deadline ===\n");
const maxInner = Math.max(...Object.values(HTTP_TIMEOUT));
for (const [k, v] of Object.entries(HTTP_TIMEOUT)) {
  ok(v < SOURCE_DEADLINE, `${k} 超时 ${v}ms < SOURCE_DEADLINE ${SOURCE_DEADLINE}ms`,
    v >= SOURCE_DEADLINE ? "← 外层会比内层先放弃，该源将静默返回空数组" : "");
}
ok(maxInner < SOURCE_DEADLINE, `max(内层) ${maxInner}ms < SOURCE_DEADLINE ${SOURCE_DEADLINE}ms`);

console.log("\n=== A2. 局部 deadline 同样必须小于外层 ===\n");
for (const [k, v] of Object.entries(SUB_DEADLINE)) {
  ok(v < SOURCE_DEADLINE, `sub.${k} ${v}ms < SOURCE_DEADLINE ${SOURCE_DEADLINE}ms`);
}

console.log("\n=== B. 重试预算必须短于第一轮 ===\n");
ok(RETRY_DEADLINE < SOURCE_DEADLINE,
  `RETRY ${RETRY_DEADLINE}ms < SOURCE_DEADLINE ${SOURCE_DEADLINE}ms`,
  RETRY_DEADLINE >= SOURCE_DEADLINE ? "重试比第一轮还久，坏上游会拖垮整个 tab" : "");
ok(WORST_CASE === SOURCE_DEADLINE + RETRY_DEADLINE,
  `WORST_CASE 与两轮之和一致 (${WORST_CASE}ms)`);

console.log("\n=== C. 源码里不许再出现裸的超时字面量 ===\n");
// 只要还有 fetchText(x, y, 3000) 这种写法，它就不会跟着 budget.js 走，
// 也就不受 A 段断言保护。逐个文件扫出来。
const files = ["functions/_lib/sources.js", "functions/_lib/gnews.js", "functions/_lib/util.js"];
let literals = [];
for (const f of files) {
  const src = readFileSync(join(ROOT, f), "utf8");
  const re = /fetch(?:Text|JSON|Raw)\([^)]*?,\s*(\d{4,})\s*\)/g;
  let m;
  while ((m = re.exec(src))) literals.push(`${f}: fetch*(..., ${m[1]})`);
  // 也检查 withDeadline(p, 数字)
  const re2 = /withDeadline\([^,]+,\s*(\d{4,})/g;
  while ((m = re2.exec(src))) literals.push(`${f}: withDeadline(..., ${m[1]})`);
}
ok(literals.length === 0, "所有超时都引用 budget.js，没有裸字面量",
  literals.length ? "\n         发现: " + literals.join("\n         发现: ") : "");

console.log("\n=== D. 上游依赖集中度 ===\n");
// Google News 是全站主通道。它一旦限流/改版，所有站点同时空白。
// 这不是要立刻换掉，而是把「单点依赖」变成一个每次测试都会看到的事实。
const sourcesSrc = readFileSync(join(ROOT, "functions/_lib/sources.js"), "utf8");
const gnewsCalls = (sourcesSrc.match(/\bg\(/g) || []).length;
const otherFetches = (sourcesSrc.match(/fetchText\(|fetchJSON\(/g) || []).length;
console.log(`  Google News 通道调用 ${gnewsCalls} 处，其他直连上游 ${otherFetches} 处`);
ok(otherFetches > 0, "存在不依赖 Google News 的直连上游",
  otherFetches === 0 ? "全部数据源都挂在 GN 上，GN 一限流就是全站空白" : "");

console.log("\n" + (failed ? `✗ ${failed} 条断言失败` : "✓ 超时预算全部自洽"));
process.exit(failed ? 1 : 0);