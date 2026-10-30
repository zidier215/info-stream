// localsim.mjs —— 本地「准线上」预览服务器
// ---------------------------------------------------------------------------
// 为什么需要它（2026-10-22 新增）：
//   这次线上空白页的根因（loadFeed 拿完数据不绘制）是一个纯前端渲染链路 bug。
//   它在「后端有数据」的前提下才暴露，所以必须有一个环境同时满足：
//     1. 前端资源 = 本地刚改的（否则测的是线上旧文件）
//     2. /api/ 返回真实数据（否则测的是空壳页面）
//   wrangler dev 会把整个 functions 目录也拉起来，但本机到 Google News 只要 2 秒，
//   跑的是另一条链路，和线上边缘环境不一致。
//   所以这里反过来：静态资源走本地 public/，/api/ 原样代理到线上域名。
//   渲染链路 100% 是本地的，数据链路 100% 是线上的 —— 正好隔离出要测的那一段。
//
// 用法：node localsim.mjs [port]
// 然后： node webtest.mjs http://127.0.0.1:8788/
// ---------------------------------------------------------------------------
import http from "node:http";
import { readFile } from "node:fs/promises";
import { join, dirname, extname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { renderHostHTML } from "./functions/_lib/page.js";
import { HOSTS, resolveHost } from "./functions/_lib/hosts.js";

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.argv[2] || 8788);
// UPSTREAM=1 时 /api/ 代理到已部署站点（对比「本地代码 vs 线上代码」用）
const UPSTREAM = process.env.UPSTREAM === "1";
const UPSTREAM_BASE = "https://myinfostream.com";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".xml": "application/xml; charset=utf-8",
};

/** 把 node 的 IncomingMessage 收成一个 Buffer，供 Request 构造器当 body 用 */
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

const srv = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  const p = url.pathname;

  // SIM 模式用假域名 *.myinfostream.test（见 simhosts.mjs），进 HOSTS 之前
  // 必须把 .test 还原成 .com，否则 resolveHost 匹配不到、静默回落到主站。
  //
  // 这个还原必须对 /api/ 生效，不能只做在下面的 HTML 分支 —— 漏掉时的症状
  // 极其隐蔽：页面按 hot 站渲染出「微博/百度/抖音」三个 tab，但每次取数实际
  // 打的仍是主站 brief 源，于是三个 tab 返回同一批内容，而常规断言全绿
  // （tab 数对、卡片有内容、标题含中文）。只有断言「卡片的 .meta source
  // 必须等于本 tab 对应的源名」才暴露得出来。
  const rawHost = String(req.headers.host || "") || "myinfostream.test";
  // 端口一律**剥掉**再交给 handler。_guard 的 originBlocked 比的是
  // new URL(origin).host 与 new URL(request.url).host（都含端口），
  // 而浏览器发来的 Host 头带 :8788、curl 可以不带 —— 只要两边不一致
  // 就会被判成跨站直接 403。线上两边都不带端口所以永远碰不到这个坑，
  // 本地必须主动归一，否则「curl 测得通、浏览器 403」这类假故障没法排查。
  const realHost = rawHost.split(":")[0].replace(/\.test$/, ".com");

  // --- /api/* ---
  // 默认调**本地** functions handler（真实代码、真实取数）。
  // UPSTREAM=1 时改成代理线上，用来对比「本地代码 vs 已部署代码」。
  //
  // 注意本机到 Google News 只要 ~2s，而边缘要 7~9s，所以本机复现不出
  // 超时类问题 —— 那部分交给 webtest 打真实域名。这里测的是：
  //   1. 前端渲染链路（这次修的主 bug）
  //   2. 本地改过的 sources/gnews/feed 在真实取数下是否还正常
  if (p.startsWith("/api/")) {
    const t0 = Date.now();
    if (!UPSTREAM) {
      try {
        // /api/xxx -> ./functions/api/xxx.js
        // 必须挡掉 ../ 穿越，并确认文件真的在 functions 目录内，
        // 否则这是个能把任意 .js 变成可执行端点的洞。
        const rel = p.replace(/^\/+/, "").replace(/\/$/, "") + ".js";
        if (rel.includes("..") || rel.includes("\\")) throw new Error("非法路径 " + rel);
        // Windows 上 ESM loader 只接受 file:// URL，直接给 C:\... 会被判成未知协议
        const mod = await import(pathToFileURL(join(ROOT, "functions", rel)).href);
        // 注意别把变量命名成 req —— 外层 createServer 回调已经有一个 req 参数，
        // 同名会触发 TDZ（Cannot access before initialization）。
        // SIM 模式用假域名 *.myinfostream.test（见 simhosts.mjs），
        // 它进 HOSTS 之前必须先把 .test 还原成 .com，否则 resolveHost 匹配不到。
        // realHost 由 handler 顶部统一算好，HTML 与 /api/ 两个分支共用同一口径。
        const origin = `http://${realHost}`;
        const hdrs = new Headers(req.headers);
        // host 头给 hostOf() 用（它只取 host:port 的 host 段），仍要还原 .test，
        // 否则 resolveHost 匹配不到 HOSTS。
        hdrs.set("host", realHost);
        // 浏览器同源 fetch 带 Origin: http://hot.myinfostream.test:8788，
        // 还原域名 + 剥端口，与上面的请求 URL 完全对齐。
        const orig = hdrs.get("origin");
        if (orig) {
          try {
            // 手拼而不是用 ou.origin：origin 会把非默认端口带回来（:8788），
            // 而请求 URL 那边已经剥掉了，两边又不一致了。
            const ou = new URL(orig);
            hdrs.set("origin", `${ou.protocol}//${ou.hostname.replace(/\.test$/, ".com")}`);
          } catch { /* Origin 不是合法 URL 就原样带过去，让 _guard 自己判 */ }
        }
        const wReq = new Request(origin + req.url, {
          method: req.method,
          headers: hdrs,
          // 请求体必须原样带过去。以前这里不传 body，于是任何 POST 端点
          // 在本地一律收不到 body —— handler 里 request.json() 直接抛，
          // 表现成「端点返回 400」，很容易被误判成线上代码写错了。
          // 例：/api/translate 的批量形态就是 POST + JSON items。
          // 注意 GET/HEAD 带 body 会被 Request 构造器判错，所以按方法分开给。
          ...(req.method === "GET" || req.method === "HEAD"
            ? {}
            : { body: await readBody(req), duplex: "half" }),
        });
        // env 要真传出去，不能给 {}。私密端点（discover / translate）靠
        // context.env.API_SECRET 判断有没有配密钥，给 {} 等于永远 403 —— 本地
        // 就再也验不到「密钥正确时这条链路到底通不通」。
        // 用法：API_SECRET=simsecret node localsim.mjs 8788
        // 然后浏览器用 ?key=simsecret 打开（app.js 会把它转成 x-api-secret 头）。
        const wRes = await mod.onRequest({ request: wReq, env: process.env });
        const buf = Buffer.from(await wRes.arrayBuffer());
        res.writeHead(wRes.status, { "content-type": wRes.headers.get("content-type") || "application/json" });
        res.end(buf);
        console.log(`  local ${wRes.status} ${p} host=${realHost} ${Date.now() - t0}ms ${buf.length}B`);
      } catch (e) {
        console.log(`  local FAIL ${p}: ${e.message}`);
        res.writeHead(500, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: String(e.message), items: [] }));
      }
      return;
    }
    try {
      // UPSTREAM_BASE 固定是主站域名，所以子站的 Host 头必须换成主站的，
      // 否则线上会按未知 host 回落主站 —— 也就是「对比线上」根本比的不是
      // 那条子站链路，白跑一趟。
      const upHost = realHost.replace(/^(ai|news|game|hot)\./, "");
      const r = await fetch(UPSTREAM_BASE + req.url, {
        headers: { "user-agent": "localsim", host: upHost },
      });
      const buf = Buffer.from(await r.arrayBuffer());
      res.writeHead(r.status, { "content-type": r.headers.get("content-type") || "application/json" });
      res.end(buf);
      console.log(`  proxy ${r.status} ${p} ${Date.now() - t0}ms ${buf.length}B`);
    } catch (e) {
      console.log(`  proxy FAIL ${p}: ${e.message}`);
      res.writeHead(502, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: String(e.message), items: [] }));
    }
    return;
  }

  // --- / 走真实 renderHostHTML，和线上同一套改写逻辑 ---
  if (p === "/" || p === "/index.html") {
    let html = await readFile(join(ROOT, "public", "index.html"), "utf8");
    // Host 头去掉端口（:8788），再决定渲染哪个站。
    // 这里曾经写死 "myinfostream.com"，结果本地只能验主站 ——
    // game / hot 的三态 tab、分榜对照全都只能靠 apitest 间接推断，
    // 「用户实际看到的那一屏」仍然是空白黑洞。Host 透传后五个站都能真跑。
    //
    // SIM 模式的 .test → .com 还原由 handler 顶部统一做（/api/ 分支也用它），
    // 这里只管剥端口。
    const host = realHost.split(":")[0];
    const r = resolveHost({ headers: new Headers({ host }) });
    html = renderHostHTML(html, r.cfg || HOSTS["myinfostream.com"], {});
    res.writeHead(200, { "content-type": MIME[".html"] });
    res.end(html);
    return;
  }

  // --- 其余静态资源 ---
  try {
    const file = join(ROOT, "public", p.replace(/^\/+/, ""));
    const buf = await readFile(file);
    res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" });
    res.end(buf);
  } catch {
    try {
      const notFoundBuf = await readFile(join(ROOT, "public", "404.html"));
      res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
      res.end(notFoundBuf);
    } catch {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("404");
    }
  }
});

srv.listen(PORT, "127.0.0.1", () => {
  // 注意：必须用 http://myinfostream.test 而不是 http://127.0.0.1/ 访问。
  // app.js 的 isLocal() 判的是 hostname，localhost/127.0.1 会让它走 demo 演示池，
  // 那样就完全绕开了真实取数链路 —— 而这次要测的正是那条链路。
  // 配 playwright 的 --host-resolver-rules 把假域名指到本机即可（见 webtest.mjs 的 SIM 模式）。
  console.log(`localsim -> http://myinfostream.test:${PORT}/  (/api/: ${UPSTREAM ? "代理 " + UPSTREAM_BASE : "本地 functions handler"})`);
  console.log(`  配套: SIM=1 node webtest.mjs http://myinfostream.test:${PORT}/`);
  console.log(`  对比线上: UPSTREAM=1 node localsim.mjs 8789`);
});