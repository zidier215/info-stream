// functions/contact.js
// ---------------------------------------------------------------------------
// 联系我们与在线反馈 Clean URL 落地页路由处理 (/contact)
// ---------------------------------------------------------------------------

import { resolveHost, MAIN_HOST, HOSTS } from "./_lib/hosts.js";

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // 1. 规范化重定向：若访问带有尾部斜杠 (/contact/)，301 重定向至 /contact 保持唯一 Canonical
  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    const cleanUrl = new URL(url.toString());
    cleanUrl.pathname = cleanUrl.pathname.replace(/\/+$/, "");
    return Response.redirect(cleanUrl.toString(), 301);
  }

  // 2. 跨子域访问重定向：法律合规页与联系页统一汇聚至主站规范 URL
  const { host, cfg } = resolveHost(request);
  const hostCfg = cfg || HOSTS[MAIN_HOST];
  if (host !== MAIN_HOST && host !== `www.${MAIN_HOST}` && !host.endsWith(".pages.dev") && host !== "localhost" && host !== "127.0.0.1") {
    const mainUrl = new URL(url.toString());
    mainUrl.hostname = MAIN_HOST;
    return Response.redirect(mainUrl.toString(), 301);
  }

  const tplRes = await env.ASSETS.fetch(new Request(new URL("/contact.html", url.origin)));
  if (!tplRes.ok) {
    return new Response("404 Not Found", { status: 404 });
  }

  const html = await tplRes.text();

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=600",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-InfoStream-Site": hostCfg.key,
    },
  });
}

