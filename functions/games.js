// functions/games.js
// ---------------------------------------------------------------------------
// Epic 喜加一历史总账本 Clean URL 落地页路由处理
// 响应 /history 与 /games 请求
// ---------------------------------------------------------------------------

import { resolveHost, MAIN_HOST, HOSTS } from "./_lib/hosts.js";

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // 拉取 games.html 静态模板
  const tplRes = await env.ASSETS.fetch(new Request(new URL("/games.html", url.origin)));
  if (!tplRes.ok) {
    return new Response("404 Not Found", { status: 404 });
  }

  let html = await tplRes.text();
  const { cfg } = resolveHost(request);
  const hostCfg = cfg || HOSTS["game.myinfostream.com"] || HOSTS[MAIN_HOST];

  const yearParam = url.searchParams.get("year");
  const isYear = yearParam && (/^\d{4}$/.test(yearParam) || yearParam === "all");

  // 按实际访问的主机与年份动态注入 Canonical 规范链接
  const canonicalUrl = isYear && yearParam !== "all"
    ? `https://${hostCfg.host}/history?year=${yearParam}`
    : `https://${hostCfg.host}/history`;
  html = html.replace(/<link rel="canonical" href="[^"]*"/i, `<link rel="canonical" href="${canonicalUrl}"`);

  if (isYear && yearParam !== "all") {
    const yearTitle = `Epic ${yearParam} 年免费游戏全记录 · 喜加一通鉴 | ${hostCfg.title}`;
    html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${yearTitle}</title>`);
    const yearDesc = `汇总 Epic Games Store ${yearParam} 年送出的全部免费大作与 3A 经典，涵盖原价、赠送起止时间、DLC 包含情况与特色导读。`;
    html = html.replace(/<meta name="description" content="[^"]*"/i, `<meta name="description" content="${yearDesc}"`);
  }

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

