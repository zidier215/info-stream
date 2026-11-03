// functions/models.js
// ---------------------------------------------------------------------------
// AI 大模型演进编年史与跑分评测档案 Clean URL 落地页路由处理
// 响应 /models 请求
// ---------------------------------------------------------------------------

import { resolveHost, MAIN_HOST, HOSTS } from "./_lib/hosts.js";

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // 拉取 models.html 静态模板
  const tplRes = await env.ASSETS.fetch(new Request(new URL("/models.html", url.origin)));
  if (!tplRes.ok) {
    return new Response("404 Not Found", { status: 404 });
  }

  let html = await tplRes.text();
  const { cfg } = resolveHost(request);
  const hostCfg = cfg || HOSTS["ai.myinfostream.com"] || HOSTS[MAIN_HOST];

  const yearParam = url.searchParams.get("year");
  const orgParam = url.searchParams.get("org");
  const isYear = yearParam && /^\d{4}$/.test(yearParam);

  // 动态注入 Canonical 规范链接与标题
  let canonicalUrl = `https://${hostCfg.host}/models`;
  if (isYear) {
    canonicalUrl = `https://${hostCfg.host}/models?year=${yearParam}`;
    const yearTitle = `${yearParam} 年度划时代 AI 大模型发布全记录 · 评测编年史 | ${hostCfg.title}`;
    html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${yearTitle}</title>`);
    const yearDesc = `全面收录 ${yearParam} 年度全球顶尖机构发布的里程碑基座大模型，涵盖 LMSYS Chatbot Arena 跑分、上下文窗口与开源协议对比。`;
    html = html.replace(/<meta name="description" content="[^"]*"/i, `<meta name="description" content="${yearDesc}"`);
  } else if (orgParam) {
    canonicalUrl = `https://${hostCfg.host}/models?org=${encodeURIComponent(orgParam)}`;
    const orgTitle = `${orgParam} 历年 AI 大模型全谱系演进与评测档案 | ${hostCfg.title}`;
    html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${orgTitle}</title>`);
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
