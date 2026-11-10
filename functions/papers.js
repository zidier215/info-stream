// functions/papers.js
// ---------------------------------------------------------------------------
// AI 论文档案专区 Clean URL 落地页路由处理 (支持 SSR 首屏卡片直出与合规元数据)
// 响应 /papers 请求
// ---------------------------------------------------------------------------

import { resolveHost, MAIN_HOST, HOSTS } from "./_lib/hosts.js";
import { PAPERS_SEED } from "./_lib/papers_seed.js";
import { escapeXml } from "./_lib/util.js";

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

  // ---------- SSR 首屏卡片与核心统计直出（解决爬虫获取空白/正在加载问题） ----------
  let papers = PAPERS_SEED || [];
  if (isWeek) {
    const matched = papers.filter((p) => p.year_week === weekParam);
    if (matched.length) papers = matched;
  }
  const displayPapers = papers.slice(0, 20);

  // 1. 直出核心统计指标
  html = html.replace(/<div class="v" id="statTotal">-- <small>篇<\/small><\/div>/, `<div class="v" id="statTotal">${papers.length} <small>篇</small></div>`);
  html = html.replace(/<div class="s" id="statStarredDesc">含 -- 篇编辑精选<\/div>/, `<div class="s" id="statStarredDesc">含 ${papers.filter(p => p.is_starred).length} 篇编辑精选</div>`);
  html = html.replace(/<div class="v" id="statSources">-- <small>所<\/small><\/div>/, `<div class="v" id="statSources">26 <small>所</small></div>`);
  html = html.replace(/<div class="v wide" id="statCoverage">-- → --<\/div>/, `<div class="v wide" id="statCoverage">2026 全年周期</div>`);

  // 2. 直出前 15 篇论文的时间轴卡片 HTML
  if (displayPapers.length) {
    const ssrTimeline = displayPapers.map((p, idx) => {
      const starTag = p.is_starred ? `<span class="star">★ 精选</span>` : "";
      const origHtml = p.orig_title ? `<p class="orig">${escapeXml(p.orig_title)}</p>` : "";
      const dateText = p.pub_date || "2026-11";
      return `
        <article class="entry in" style="opacity:1; transform:none;">
          <div class="rail"><span class="dot"></span><span class="when">${escapeXml(dateText.slice(5))}</span></div>
          <div class="card">
            <header class="chead">
              <span class="idx">#${idx + 1}</span>
              <span class="badge b-${p.badge_type || 'lab'}">${escapeXml(p.source || 'AI Lab')}</span>
              ${starTag}
              <span class="ago">${escapeXml(p.stamp || dateText)}</span>
            </header>
            <h2 class="ctitle"><a href="${escapeXml(p.url)}" target="_blank" rel="noopener">${escapeXml(p.title)}</a></h2>
            ${origHtml}
            <p class="csum">${escapeXml(p.summary || '')}</p>
            <footer class="cfoot">
              <a class="link" href="${escapeXml(p.url)}" target="_blank" rel="noopener">阅读原文 <span class="arw">↗</span></a>
              <span class="stamp">${escapeXml(p.stamp || dateText)}</span>
            </footer>
          </div>
        </article>
      `;
    }).join("\n");

    html = html.replace(
      /<main class="timeline" id="timelineList">[\s\S]*?<\/main>/i,
      `<main class="timeline" id="timelineList">\n${ssrTimeline}\n  </main>`
    );
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
