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
  const tplRes = await env.ASSETS.fetch(new Request(new URL("/papers.html", url.origin)));
  if (!tplRes.ok) {
    return new Response("404 Not Found", { status: 404 });
  }

  let html = await tplRes.text();
  const { cfg } = resolveHost(request);
  const hostCfg = cfg || HOSTS[MAIN_HOST];

  const weekParam = url.searchParams.get("week");
  const isWeek = weekParam && /^2026-W\d{2}$/.test(weekParam);

  // 按实际访问的主机与周次动态注入 Canonical 规范链接
  const canonicalUrl = isWeek
    ? `https://${hostCfg.host}/papers?week=${weekParam}`
    : `https://${hostCfg.host}/papers`;
  html = html.replace(/<link rel="canonical" href="[^"]*"/i, `<link rel="canonical" href="${canonicalUrl}"`);

  // 若带特定周次，动态优化 title 与 meta 描述，赋能 Googlebot 精准索引
  if (isWeek) {
    const weekTitle = `AI 论文档案周刊 (${weekParam}) · 深度学术归档 | ${hostCfg.title}`;
    html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${weekTitle}</title>`);
    const weekDesc = `AI 论文档案库 ${weekParam} 周刊收录本周前沿大模型、强化学习与智能体架构论文，提供一手 ArXiv / Hugging Face 解读、实验指标与每日分布走势。`;
    html = html.replace(/<meta name="description" content="[^"]*"/i, `<meta name="description" content="${weekDesc}"`);
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