// functions/ship.js
// ---------------------------------------------------------------------------
// 出海造筏与一人公司出海全景 Clean URL 落地页路由处理 (/ship)
// 支持服务端 SSR 完整卡片直出、动态 Canonical 与 SEO 结构化数据
// ---------------------------------------------------------------------------

import { resolveHost, MAIN_HOST, HOSTS } from "./_lib/hosts.js";
import {
  PAYMENTS_DATA,
  INCORPORATION_DATA,
  DISTRIBUTION_DATA,
  STACK_DATA,
  SHIP_RULES
} from "./_lib/ship_seed.js";
import { escapeXml } from "./_lib/util.js";

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // 1. 规范化重定向：若访问带有尾部斜杠 (/ship/)，301 重定向至 /ship 保持唯一 Canonical
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

  const tplRes = await env.ASSETS.fetch(new Request(new URL("/ship.html", url.origin)));
  if (!tplRes.ok) {
    return new Response("404 Not Found", { status: 404 });
  }

  let html = await tplRes.text();

  const canonicalUrl = `https://${hostCfg.host}/ship`;
  html = html.replace(/<link rel="canonical" href="[^"]*"/i, `<link rel="canonical" href="${canonicalUrl}"`);

  // SSR 直出全量支付通道
  const ssrPayments = PAYMENTS_DATA.map((p) => `
    <article class="ship-card" id="${escapeXml(p.id)}">
      <div class="card-head">
        <div>
          <span class="badge badge-accent">${escapeXml(p.type)}</span>
          <h3>${escapeXml(p.name)}</h3>
          <div class="card-subtitle"><b>模式：</b>${escapeXml(p.model)} · <b>费率：</b>${escapeXml(p.rate_desc)}</div>
        </div>
      </div>
      <div class="info-row"><b>结算周期：</b>${escapeXml(p.payout_cycle)}</div>
      <div class="info-row"><b>开户门槛：</b>${escapeXml(p.setup_barrier)}</div>
      <div class="info-row"><b>税收合规：</b>${escapeXml(p.tax_vat_support)}</div>
      <div class="info-row danger"><b>风控红线：</b>${escapeXml(p.chargeback_risk)}</div>
      <div class="card-box">
        <b>适用人群：</b>${escapeXml(p.best_for)}<br/>
        <b>实战总结：</b>${escapeXml(p.verdict)}
      </div>
    </article>
  `).join("\n");

  html = html.replace(/<div id="paymentsContainer">[\s\S]*?<\/div>/i, `<div id="paymentsContainer">${ssrPayments}</div>`);

  // 内联初始数据
  const seedJson = JSON.stringify({
    payments: PAYMENTS_DATA,
    incorporation: INCORPORATION_DATA,
    distribution: DISTRIBUTION_DATA,
    stack: STACK_DATA,
    rules: SHIP_RULES,
  })
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
  html = html.replace(/<\/head>/i, `<script>window.__SHIP_DATA__ = ${seedJson};</script>\n</head>`);

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
