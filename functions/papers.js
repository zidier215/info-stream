// functions/papers.js
// ---------------------------------------------------------------------------
// AI 论文档案专区 Clean URL 落地页路由处理
// 响应 /papers 请求
// ---------------------------------------------------------------------------

import { resolveHost, MAIN_HOST, HOSTS } from "./_lib/hosts.js";

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // 拉取 papers.html 静态模板
  let tplRes = await env.ASSETS.fetch(new Request(new URL("/papers.html", url.origin)));
  if (!tplRes.ok) {
    tplRes = await env.ASSETS.fetch(new Request("https://fake-host/papers.html"));
  }
  if (!tplRes.ok) {
    return new Response("404 Not Found", { status: 404 });
  }

  let html = await tplRes.text();
  const { cfg } = resolveHost(request);
  const hostCfg = cfg || HOSTS[MAIN_HOST];

  // 按实际访问的主机动态注入 Canonical 规范链接
  const canonicalUrl = `https://${hostCfg.host}/papers`;
  html = html.replace(/<link rel="canonical" href="[^"]*"/i, `<link rel="canonical" href="${canonicalUrl}"`);

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
