// functions/index.js
// ---------------------------------------------------------------------------
// 主站 HTML 外壳 —— 三个域名共用一份 assets/index.html，按 Host 改写。
//
// 为什么要在服务端改写而不是做三份 HTML：
//   三份文件必然漂移 —— 改一处 bug 要同步三遍，漏一处就是线上不一致。
//   改写则保证「差异」只存在于 hosts.js 这一张表里，一眼能看全。
//
// 走 env.ASSETS.fetch() 而不是把 HTML 硬编码进 JS：
//   静态资源仍然由 Cloudflare 的 CDN 缓存（改 CSS/JS 立即生效），
//   只有首页这一份 HTML 每次都过函数。正因为如此要显式关掉 CDN 缓存。
//
// 缓存策略要点：
//   - 预览域名（pages.dev）no-store，避免本地调试看到旧 HTML
//   - 正式域名 s-maxage=300 + stale-while-revalidate，
//     既让 CF 边缘缓存减轻函数调用量，又保证改 hosts.js 后 5 分钟内全网生效
// ---------------------------------------------------------------------------

import { resolveHost, HOSTS, MAIN_HOST } from "./_lib/hosts.js";
import { renderHostHTML } from "./_lib/page.js";

export async function onRequest(context) {
  const { request, env } = context;

  // 规范化路径：只处理根路径（/ 与 /index.html 等价），其他路径交给静态资源
  const url = new URL(request.url);
  let pathname = url.pathname.replace(/\/{2,}/g, "/");
  if (pathname.length > 1) pathname = pathname.replace(/\/+$/, "");
  // /index.html 与 / 是同一份文档，统一按根路径处理，避免出现
  // 「访问 /index.html 拿到未改写的模板」这种 SEO 重复内容漏洞
  if (pathname === "/index.html" || pathname === "/index.htm") pathname = "/";
  if (pathname !== "/" && pathname !== "") {
    // 带扩展名或静态子路径交给 ASSETS；未找到的补充 X-Robots-Tag: noindex 并返回 404 页面
    const assetRes = await env.ASSETS.fetch(request);
    if (assetRes.status === 404) {
      let bodyText = "";
      try {
        const notFound404 = await env.ASSETS.fetch(new Request(new URL("/404.html", url.origin)));
        if (notFound404 && notFound404.ok) bodyText = await notFound404.text();
      } catch {}
      return new Response(bodyText || "404 Not Found", {
        status: 404,
        statusText: "Not Found",
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "X-Robots-Tag": "noindex, nofollow",
          "Cache-Control": "no-cache, no-store",
        },
      });
    }
    return assetRes;
  }

  const { host, cfg, isPreview } = resolveHost(request);
  const conf = cfg || HOSTS[MAIN_HOST];

  // 取原始 HTML。404 不该被改写（说明静态资源缺失，直接透传错误更好排查）
  const assetReq = new Request(new URL("/index.html", url.origin), { method: "GET" });
  const res = await env.ASSETS.fetch(assetReq);
  if (!res || !res.ok) return res || new Response("Not Found", { status: 404 });
  const raw = await res.text();

  // 首屏 0ms 秒开：尝试从静态数据快照预取该站首屏 tab 的数据
  let initialFeed = null;
  const primaryTab = (conf.tabs && conf.tabs[0] && conf.tabs[0].id) || "brief";
  const candidateTabs = [primaryTab];
  if (conf.key === "ai") candidateTabs.push("all", "ai", "models");
  else if (conf.key === "main") candidateTabs.push("brief");
  for (const cTab of candidateTabs) {
    try {
      const snapReq = new Request(new URL(`/data/feed-${cTab}.json`, url.origin), { method: "GET" });
      const snapRes = await env.ASSETS.fetch(snapReq);
      if (snapRes && snapRes.ok) {
        initialFeed = await snapRes.json();
        break;
      }
    } catch {}
  }

  let html;
  try {
    html = renderHostHTML(raw, conf, {
      canonical: `https://${conf.host}/`,
      isPreview,
      initialFeed,
    });
  } catch (err) {
    // 改写失败宁可直接发原页面，也不要给用户一个 500 白屏
    console.error("renderHostHTML failed:", err && err.message);
    return new Response(raw, {
      headers: res.headers,
      status: 200,
    });
  }

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // 预览域名完全不缓存；正式域名边缘缓存 5 分钟，后台刷新
      "Cache-Control": isPreview
        ? "no-store"
        : "public, max-age=0, s-maxage=300, stale-while-revalidate=600",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      // 站点标识，前端与排障都用得上
      "X-InfoStream-Site": conf.key,
    },
  });
}