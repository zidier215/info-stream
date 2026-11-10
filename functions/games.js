// functions/games.js
// ---------------------------------------------------------------------------
// Epic 喜加一历史总账本 Clean URL 落地页路由处理 (支持 SSR 首屏卡片直出)
// 响应 /history 与 /games 请求
// ---------------------------------------------------------------------------

import { resolveHost, MAIN_HOST, HOSTS } from "./_lib/hosts.js";
import { GAMES_SEED } from "./_lib/games_seed.js";
import { escapeXml } from "./_lib/util.js";

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
  const canonicalPath = url.pathname.startsWith("/games") ? "/games" : "/history";
  const canonicalUrl = isYear && yearParam !== "all"
    ? `https://${hostCfg.host}${canonicalPath}?year=${yearParam}`
    : `https://${hostCfg.host}${canonicalPath}`;
  html = html.replace(/<link rel="canonical" href="[^"]*"/i, `<link rel="canonical" href="${canonicalUrl}"`);

  if (isYear && yearParam !== "all") {
    const yearTitle = `Epic ${yearParam} 年免费游戏全记录 · 喜加一通鉴 | ${hostCfg.title}`;
    html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${yearTitle}</title>`);
    const yearDesc = `汇总 Epic Games Store ${yearParam} 年送出的全部免费大作与 3A 经典，涵盖原价、赠送起止时间、DLC 包含情况与特色导读。`;
    html = html.replace(/<meta name="description" content="[^"]*"/i, `<meta name="description" content="${yearDesc}"`);
  }

  // ---------- SSR 首屏游戏卡片与分页文本直出 ----------
  const games = GAMES_SEED || [];
  const displayGames = games.slice(0, 12);

  if (displayGames.length) {
    const ssrCards = displayGames.map((g) => {
      const isAaa = g.is_aaa ? `<span class="badge-aaa">★ 3A 殿堂</span>` : "";
      const isMystery = g.is_mystery ? `<span class="badge-mystery">🎁 圣诞/神秘连送</span>` : "";
      const priceText = g.price_usd > 0 ? `$${g.price_usd} (${g.price_cny ? '¥' + g.price_cny : '免费'})` : "免费入库";

      return `
        <article class="g-card">
          <div class="g-cover-box">
            <img class="g-cover" src="${escapeXml(g.cover_url || '/favicon.svg')}" alt="${escapeXml(g.title)}" loading="lazy" />
            <span class="badge-off">100% OFF</span>
            ${isAaa}
            ${isMystery}
          </div>
          <div class="g-info">
            <h3 class="g-title">${escapeXml(g.title)}</h3>
            <p class="g-orig-title">${escapeXml(g.orig_title || g.title)}</p>
            <div class="g-price-row">
              <span class="g-price-orig">${escapeXml(priceText)}</span>
              <span class="g-price-free">限时免费 $0.00</span>
            </div>
            <p class="g-brief">${escapeXml(g.brief || g.description || '')}</p>
            <div class="g-meta-row">
              <span>发行商：${escapeXml(g.publisher || 'Epic Games')}</span>
              <span>赠送周期：${escapeXml(g.giveaway_start || '历史活动')} ~ ${escapeXml(g.giveaway_end || '已截止')}</span>
            </div>
            <a class="g-action" href="${escapeXml(g.epic_url || 'https://store.epicgames.com/')}" target="_blank" rel="noopener">查阅 Epic 官方详情 ↗</a>
          </div>
        </article>
      `;
    }).join("\n");

    html = html.replace(
      /<div class="games-grid" id="gamesList">[\s\S]*?<\/div>\s*<div class="pagination">/i,
      `<div class="games-grid" id="gamesList">\n${ssrCards}\n    </div>\n    <div class="pagination">`
    );

    html = html.replace(
      /<span class="page-info" id="pageInfo">第 1 \/ 1 页 \(共 0 款\)<\/span>/,
      `<span class="page-info" id="pageInfo">第 1 / 5 页 (共 ${games.length} 款史诗免费游戏)</span>`
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
