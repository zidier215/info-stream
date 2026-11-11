// functions/fire.js
// ---------------------------------------------------------------------------
// 全球指数化投资与经典资产配置模型 Clean URL 落地页路由处理 (/fire)
// 支持服务端 SSR 完整卡片直出、动态 Canonical 与 SEO 结构化数据
// ---------------------------------------------------------------------------

import { resolveHost, MAIN_HOST, HOSTS } from "./_lib/hosts.js";
import {
  PORTFOLIO_MODELS,
  ETF_TAX_EFFICIENCY,
  FIRE_METHODOLOGY
} from "./_lib/fire_seed.js";
import { escapeXml } from "./_lib/util.js";

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // 1. 规范化重定向：若访问带有尾部斜杠 (/fire/)，301 重定向至 /fire 保持唯一 Canonical
  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    const cleanUrl = new URL(url.toString());
    cleanUrl.pathname = cleanUrl.pathname.replace(/\/+$/, "");
    return Response.redirect(cleanUrl.toString(), 301);
  }

  // 2. 跨子域访问重定向：主站核心数据库，子域访问 301 回归主站
  const { host, cfg } = resolveHost(request);
  const hostCfg = cfg || HOSTS[MAIN_HOST];
  if (host !== MAIN_HOST && host !== `www.${MAIN_HOST}` && !host.endsWith(".pages.dev") && host !== "localhost" && host !== "127.0.0.1") {
    const mainUrl = new URL(url.toString());
    mainUrl.hostname = MAIN_HOST;
    return Response.redirect(mainUrl.toString(), 301);
  }

  const tplRes = await env.ASSETS.fetch(new Request(new URL("/fire.html", url.origin)));
  if (!tplRes.ok) {
    return new Response("404 Not Found", { status: 404 });
  }

  let html = await tplRes.text();

  const canonicalUrl = `https://${hostCfg.host}/fire`;
  html = html.replace(/<link rel="canonical" href="[^"]*"/i, `<link rel="canonical" href="${canonicalUrl}"`);

  // SSR 直出全量资产配置模型
  const ssrModels = PORTFOLIO_MODELS.map((m) => `
    <article class="portfolio-card" id="${escapeXml(m.id)}">
      <div class="card-head">
        <span class="badge badge-accent">${escapeXml(m.badge)}</span>
        <h3>${escapeXml(m.name)}</h3>
        <div class="card-subtitle"><b>创立者：</b>${escapeXml(m.author)} · <b>历史年化：</b><span class="highlight-green">${escapeXml(m.cagr_historical)}</span> · <b>最大回撤：</b><span class="highlight-red">${escapeXml(m.max_drawdown)}</span></div>
      </div>
      <p class="card-desc">${escapeXml(m.thesis)}</p>
      <div class="alloc-list">
        <b>标准权重配置矩阵：</b>
        <ul>
          ${m.allocations.map(a => `<li><span class="alloc-weight">${escapeXml(String(a.weight))}%</span> <b>${escapeXml(a.asset)}</b> — <span class="alloc-role">${escapeXml(a.role)}</span></li>`).join("")}
        </ul>
      </div>
      <div class="info-row"><b>再平衡机制：</b>${escapeXml(m.rebalance_rule)}</div>
      <div class="info-row"><b>适合人群：</b>${escapeXml(m.best_for)}</div>
    </article>
  `).join("");

  html = html.replace(
    /<!-- SSR_MODELS_MOUNT -->[\s\S]*?<!-- \/SSR_MODELS_MOUNT -->/,
    `<!-- SSR_MODELS_MOUNT -->${ssrModels}<!-- /SSR_MODELS_MOUNT -->`
  );

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=1800, s-maxage=86400, stale-while-revalidate=604800",
      "X-InfoStream-Site": "main",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    },
  });
}
