// timeouttest.mjs —— 抓取超时的真实边界测试
// ---------------------------------------------------------------------------
// 这个测试存在的理由：2026-10-22 线上 AI 站三个 tab 全白，
// 接口有的 11 秒返回 count:0、有的响应发一半永远不结束。
//
// 根因是 fetchRaw 的一个非常隐蔽的错误：
//
//     const id = setTimeout(() => ctrl.abort(), timeout);
//     const res = await fetch(url, { signal: ctrl.signal });
//     if (!res.ok) throw ...
//     return res;
//   } finally { clearTimeout(id); }        // ← 这里就把保护摘了
//
// fetch() 的 promise 在**响应头到达时**就 resolve，body 还在流。
// 于是定时器在拿到 Response 的瞬间就被清掉，接下来的 res.text()
// 读 body 全程没有任何超时保护 —— 上游只要「发了 header 就把 body 挂住」，
// 这一行 await 就永远挂着。
//
// 真实世界的触发形态（Cloudflare 边缘访问 Google News / arXiv 时高发）：
//   TCP/TLS 建连成功 → 200 + Content-Length 到了 → body 传输卡死。
// curl 表现为「下载了 13KB 后再无进展，直到被 --max-time 砍掉」。
//
// 所以这里用一个**故意做坏**的本地上游来复现：
//   发响应头 + 发一半 body，然后永久挂住连接（不 close、不报错）。
// 修复前必然超时；修复后必须在 timeout 参数内放弃。
// ---------------------------------------------------------------------------

import { createServer } from "node:http";
import { fetchText, fetchJSON, withDeadline } from "./functions/_lib/util.js";

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`  ${pass ? "OK  " : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
}

/**
 * 起一个「坏上游」：
 *   /hang-headers  —— 发 header，一个字节 body 都不发，然后永久挂住
 *   /partial       —— 发 header + 半截 body（模拟下载了 13KB 卡死），然后挂住
 *   /fast          —— 正常返回，用来做对照组
 */
function startBadUpstream() {
  const sockets = new Set();
  const server = createServer((req, res) => {
    const url = req.url || "";
    if (url.startsWith("/fast")) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, n: 42 }));
      return;
    }
    // 下面两种都故意不 end()：header 发出去了，body 挂着
    res.writeHead(200, {
      "content-type": "application/json",
      "content-length": "999999",
    });
    if (url.startsWith("/partial")) {
      res.write('{"ok":true,"items":[');   // 发半截，模拟「下载一部分后卡死」
    }
    // 挂住：既不 end 也不 destroy，让对端一直等
    res.socket && sockets.add(res.socket);
  });
  server.on("connection", (s) => {
    sockets.add(s);
    s.on("close", () => sockets.delete(s));
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve({ server, port: server.address().port, sockets });
    });
  });
}

const { server, port, sockets } = await startBadUpstream();
const base = `http://127.0.0.1:${port}`;
console.log(`\n=== 坏上游已就绪 ${base} ===`);

// 收尾时把挂住的连接全部掐掉，否则进程不退出
function cleanup() {
  for (const s of sockets) { try { s.destroy(); } catch { /* 已断 */ } }
  try { server.close(); } catch { /* 已关 */ }
}
process.on("exit", cleanup);

// ---------------------------------------------------------------------------
console.log("\n【1】对照组：正常上游必须在预算内返回，且拿到完整 body");
// ---------------------------------------------------------------------------
{
  const t0 = Date.now();
  const j = await fetchJSON(`${base}/fast`, {}, 3000);
  const ms = Date.now() - t0;
  check("fetchJSON 正常返回", j && j.n === 42, `${ms}ms, n=${j && j.n}`);
  check("耗时在预算内", ms < 3000, `${ms}ms`);
}

// ---------------------------------------------------------------------------
console.log("\n【2】核心回归：只发响应头、body 永久挂住 → 必须在 timeout 内放弃");
// ---------------------------------------------------------------------------
{
  const t0 = Date.now();
  let result = null;
  let threw = false;
  try {
    result = await fetchText(`${base}/hang-headers`, {}, 1200);
  } catch (e) {
    threw = true;
  }
  const ms = Date.now() - t0;
  // 这是修复前会挂死的那一行。修复后它应该在 1200ms 附近以 abort 收场。
  check("fetchText 不再无限挂起", ms < 3000, `${ms}ms（预算 1200ms）`);
  check("以 abort 而非正常返回结束", threw || result === null, threw ? "抛错" : "返回空");
}

// ---------------------------------------------------------------------------
console.log("\n【3】半截 body 卡死（真实事故形态）→ 必须在 timeout 内放弃");
// ---------------------------------------------------------------------------
{
  const t0 = Date.now();
  let threw = false;
  try {
    await fetchText(`${base}/partial`, {}, 1200);
  } catch {
    threw = true;
  }
  const ms = Date.now() - t0;
  check("fetchText 不会卡在半截 body", ms < 3000, `${ms}ms（预算 1200ms）`);
  check("以 abort 收场", threw, threw ? "抛错" : "未抛错（异常）");
}

// ---------------------------------------------------------------------------
console.log("\n【4】fetchJSON 同样受保护（曾经绕过 fetchRaw 直接读 body）");
// ---------------------------------------------------------------------------
{
  const t0 = Date.now();
  let threw = false;
  try {
    await fetchJSON(`${base}/hang-headers`, {}, 1200);
  } catch {
    threw = true;
  }
  const ms = Date.now() - t0;
  check("fetchJSON 也会被 timeout 兜住", ms < 3000 && threw, `${ms}ms`);
}

// ---------------------------------------------------------------------------
console.log("\n【5】withDeadline 外层兜底仍然有效（不依赖内层是否正确）");
// ---------------------------------------------------------------------------
{
  const t0 = Date.now();
  const r = await withDeadline(new Promise(() => {}), 800, "FALLBACK");
  const ms = Date.now() - t0;
  check("withDeadline 按时降级", r === "FALLBACK" && ms < 2000, `${ms}ms, r=${r}`);
}

// ---------------------------------------------------------------------------
console.log("\n【6】两层嵌套的总耗时上界（源层 deadline + 内层 HTTP 超时）");
// ---------------------------------------------------------------------------
// 这是用户实际等待的时间。fetchBySources = SOURCE_DEADLINE + RETRY_DEADLINE = 11s，
// 而内层每个 fetch 最多 HTTP_TIMEOUT（最大 6500）。修复后，内层先放弃，
// 外层等到 SOURCE_DEADLINE 时内层早已结束 —— 不再有「外层返回了、内层还在跑」
// 的悬挂请求堆积在 isolate 里。
{
  const { SOURCE_DEADLINE, RETRY_DEADLINE, HTTP_TIMEOUT } =
    await import("./functions/_lib/budget.js");
  const maxInner = Math.max(...Object.values(HTTP_TIMEOUT));
  check(
    "内层超时 < 外层 deadline（不留悬挂窗口）",
    maxInner < SOURCE_DEADLINE,
    `max(内层)=${maxInner} < SOURCE_DEADLINE=${SOURCE_DEADLINE}`
  );
  check(
    "用户最坏等待有明确上界",
    SOURCE_DEADLINE + RETRY_DEADLINE <= 11000,
    `最坏 ${SOURCE_DEADLINE + RETRY_DEADLINE}ms`
  );
}

// ---------------------------------------------------------------------------
const failed = results.filter((r) => !r.pass);
console.log(
  `\n${failed.length ? "✗" : "✓"} ${results.length - failed.length}/${results.length} 项通过`
);
if (failed.length) {
  console.log("失败：\n" + failed.map((f) => "  · " + f.name + " — " + f.detail).join("\n"));
}
cleanup();
process.exit(failed.length ? 1 : 0);