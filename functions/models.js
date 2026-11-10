// functions/models.js
// ---------------------------------------------------------------------------
// AI 大模型演进编年史与跑分评测档案 Clean URL 落地页路由处理 (支持 SSR 首屏卡片直出)
// 响应 /models 请求
// ---------------------------------------------------------------------------

import { resolveHost, MAIN_HOST, HOSTS } from "./_lib/hosts.js";
import { MODELS_SEED } from "./_lib/models_seed.js";
import { escapeXml } from "./_lib/util.js";

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

  // ---------- SSR 首屏模型卡片与分页文本直出 ----------
  const models = MODELS_SEED || [];
  const displayModels = models.slice(0, 12);

  if (displayModels.length) {
    const ssrCards = displayModels.map((m) => {
      const isReasoning = m.is_reasoning ? `<span class="badge-reasoning">🧠 深度思考</span>` : "";
      const isFrontier = m.is_frontier ? `<span class="badge-frontier">⭐ 旗舰</span>` : "";
      const eloVal = m.arena_elo ? `${m.arena_elo} 分` : "评测中";
      const ctxVal = m.context_window >= 1000000 ? `${(m.context_window / 1000000).toFixed(0)}M` : `${Math.round(m.context_window / 1000)}K`;
      const isOpen = m.is_open_weights ? "open" : "closed";
      const openText = m.is_open_weights ? "开源与开放权重" : "闭源商用 API";

      return `
        <article class="model-card">
          <div class="card-header">
            <div class="model-meta">
              <span class="org-badge">${escapeXml(m.org)}</span>
              ${isReasoning}
              ${isFrontier}
            </div>
            <span class="model-date">${escapeXml(m.release_date)}</span>
          </div>
          <h3 class="model-title">${escapeXml(m.name)}</h3>
          <p class="model-orig">${escapeXml(m.family || m.name)}</p>
          <div class="specs-grid">
            <div class="spec-item"><span class="spec-k">LMSYS Arena ELO</span><span class="spec-v elo">${eloVal}</span></div>
            <div class="spec-item"><span class="spec-k">上下文窗口</span><span class="spec-v context">${ctxVal} Tokens</span></div>
            <div class="spec-item"><span class="spec-k">模态能力</span><span class="spec-v">${escapeXml(m.modality || '全模态')}</span></div>
            <div class="spec-item"><span class="spec-k">开源形态</span><span class="spec-v">${openText}</span></div>
          </div>
          <p class="model-desc">${escapeXml(m.description || '')}</p>
          <div class="card-footer">
            <span class="license-tag"><span class="license-dot ${isOpen}"></span>${escapeXml(m.license || 'Proprietary')}</span>
            <div class="card-links">
              <a href="${escapeXml(m.report_url || '#')}" target="_blank" rel="noopener" class="card-link">技术报告 ↗</a>
            </div>
          </div>
        </article>
      `;
    }).join("\n");

    html = html.replace(
      /<section class="models-grid" id="modelsList">[\s\S]*?<\/section>/i,
      `<section class="models-grid" id="modelsList">\n${ssrCards}\n    </section>`
    );

    html = html.replace(
      /<span class="page-info" id="pageInfo">第 1 \/ 1 页 \(共 0 款\)<\/span>/,
      `<span class="page-info" id="pageInfo">第 1 / 4 页 (共 ${models.length} 款划时代大模型)</span>`
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
