// functions/trends.js
// ---------------------------------------------------------------------------
// 互联网破圈大事件与年度热搜历史通鉴 Clean URL 落地页路由处理 (支持 SSR 首屏卡片直出)
// 响应 /trends 与 hot 域下的 /history 请求
// ---------------------------------------------------------------------------

import { resolveHost, MAIN_HOST, HOSTS } from "./_lib/hosts.js";
import { TRENDS_SEED } from "./_lib/trends_seed.js";
import { escapeXml } from "./_lib/util.js";

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
  const canonicalPath = url.pathname.startsWith("/trends") ? "/trends" : "/history";
  let canonicalUrl = `https://${hostCfg.host}${canonicalPath}`;
  if (isYear) {
    canonicalUrl = `https://${hostCfg.host}${canonicalPath}?year=${yearParam}`;
    const yearTitle = `${yearParam} 年度互联网破圈大事件全纪录 · 热搜历史通鉴 | ${hostCfg.title}`;
    html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${yearTitle}</title>`);
    const yearDesc = `全面回顾 ${yearParam} 年度中国互联网现象级破圈热搜、科技大突破、文娱高光与时代民生纪实。`;
    html = html.replace(/<meta name="description" content="[^"]*"/i, `<meta name="description" content="${yearDesc}"`);
  } else if (catParam && CAT_NAMES[catParam]) {
    canonicalUrl = `https://${hostCfg.host}${canonicalPath}?category=${catParam}`;
    const catTitle = `${CAT_NAMES[catParam]}领域历年破圈大事件全景档案 | ${hostCfg.title}`;
    html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${catTitle}</title>`);
  }

  html = html.replace(/<link rel="canonical" href="[^"]*"/i, `<link rel="canonical" href="${canonicalUrl}"`);

  // ---------- SSR 首屏大事件卡片与分页文本直出 ----------
  const events = TRENDS_SEED || [];
  const displayEvents = events.slice(0, 12);

  if (displayEvents.length) {
    const ssrCards = displayEvents.map((e) => {
      const isEpoch = e.is_epoch ? `<span class="badge-epoch">★ 时代印记</span>` : "";
      const catLabel = CAT_NAMES[e.category] || "综合事件";
      const heatText = e.peak_heat >= 10000000 ? `${(e.peak_heat / 100000000).toFixed(2)} 亿` : `${Math.round(e.peak_heat / 10000)} 万`;

      return `
        <article class="event-card">
          <div class="card-top">
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="cat-pill">${escapeXml(catLabel)}</span>
              ${isEpoch}
            </div>
            <span class="event-date">${escapeXml(e.date)}</span>
          </div>
          <h3 class="event-title">${escapeXml(e.title)}</h3>
          <div class="meta-box">
            <span class="heat-val">🔥 全网峰值热度：${heatText}</span>
            <span class="platforms-val">${escapeXml(e.platforms || '全网沸腾')}</span>
          </div>
          <p class="event-summary">${escapeXml(e.summary || '')}</p>
          <div class="card-footer">
            <div class="event-tags">
              <span class="e-tag">#${escapeXml(e.year)}年度</span>
              <span class="e-tag">#${escapeXml(catLabel)}</span>
            </div>
            <a href="${escapeXml(e.ref_url || '#')}" target="_blank" rel="noopener" class="card-link">事件溯源 ↗</a>
          </div>
        </article>
      `;
    }).join("\n");

    html = html.replace(
      /<section class="events-grid" id="eventsList">[\s\S]*?<\/section>/i,
      `<section class="events-grid" id="eventsList">\n${ssrCards}\n    </section>`
    );

    html = html.replace(
      /<span class="page-info" id="pageInfo">第 1 \/ 1 页 \(共 0 件\)<\/span>/,
      `<span class="page-info" id="pageInfo">第 1 / 4 页 (共 ${events.length} 件破圈大事件)</span>`
    );
  }

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-InfoStream-Site": hostCfg.key,
    },
  });
}
