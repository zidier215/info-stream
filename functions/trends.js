// functions/trends.js
// ---------------------------------------------------------------------------
// 互联网破圈大事件与年度热搜历史通鉴 Clean URL 落地页路由处理
// 响应 /trends 与 hot 域下的 /history 请求
// ---------------------------------------------------------------------------

import { resolveHost, MAIN_HOST, HOSTS } from "./_lib/hosts.js";

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // 拉取 trends.html 静态模板
  const tplRes = await env.ASSETS.fetch(new Request(new URL("/trends.html", url.origin)));
  if (!tplRes.ok) {
    return new Response("404 Not Found", { status: 404 });
  }

  let html = await tplRes.text();
  const { cfg } = resolveHost(request);
  const hostCfg = cfg || HOSTS["hot.myinfostream.com"] || HOSTS[MAIN_HOST];

  const yearParam = url.searchParams.get("year");
  const catParam = url.searchParams.get("category");
  const isYear = yearParam && /^\d{4}$/.test(yearParam);

  const CAT_NAMES = {
    tech: "科技突破",
    sports: "体育盛典",
    society: "社会民生",
    ent: "影视文娱",
    biz: "商业经济",
  };

  // 动态注入 Canonical 规范链接与标题
  let canonicalUrl = `https://${hostCfg.host}/history`;
  if (isYear) {
    canonicalUrl = `https://${hostCfg.host}/history?year=${yearParam}`;
    const yearTitle = `${yearParam} 年度互联网破圈大事件全纪录 · 热搜历史通鉴 | ${hostCfg.title}`;
    html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${yearTitle}</title>`);
    const yearDesc = `全面回顾 ${yearParam} 年度中国互联网现象级破圈热搜、科技大突破、文娱高光与时代民生纪实。`;
    html = html.replace(/<meta name="description" content="[^"]*"/i, `<meta name="description" content="${yearDesc}"`);
  } else if (catParam && CAT_NAMES[catParam]) {
    canonicalUrl = `https://${hostCfg.host}/history?category=${catParam}`;
    const catTitle = `${CAT_NAMES[catParam]}领域历年破圈大事件全景档案 | ${hostCfg.title}`;
    html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${catTitle}</title>`);
  }

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

