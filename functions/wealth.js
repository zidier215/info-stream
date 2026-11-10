// functions/wealth.js
// ---------------------------------------------------------------------------
// 人类商业变现与财富杠杆演进通鉴 Clean URL 落地页路由处理 (/wealth)
// 支持服务端 SSR 全量卡片直出、动态 Canonical 与 SEO 元数据
// ---------------------------------------------------------------------------

import { resolveHost, MAIN_HOST, HOSTS } from "./_lib/hosts.js";
import { WEALTH_SEED } from "./_lib/wealth_seed.js";
import { escapeXml } from "./_lib/util.js";

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // 1. 规范化重定向：若访问带有尾部斜杠 (/wealth/)，301 重定向至 /wealth 保持唯一 Canonical
  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    const cleanUrl = new URL(url.toString());
    cleanUrl.pathname = cleanUrl.pathname.replace(/\/+$/, "");
    return Response.redirect(cleanUrl.toString(), 301);
  }

  // 2. 跨子域访问重定向：商业通鉴为 InfoStream 全球主站核心数据库，子域访问 301 回归主站
  const { host, cfg } = resolveHost(request);
  const hostCfg = cfg || HOSTS[MAIN_HOST];
  if (host !== MAIN_HOST && host !== `www.${MAIN_HOST}` && !host.endsWith(".pages.dev") && host !== "localhost" && host !== "127.0.0.1") {
    const mainUrl = new URL(url.toString());
    mainUrl.hostname = MAIN_HOST;
    return Response.redirect(mainUrl.toString(), 301);
  }

  const tplRes = await env.ASSETS.fetch(new Request(new URL("/wealth.html", url.origin)));
  if (!tplRes.ok) {
    return new Response("404 Not Found", { status: 404 });
  }

  let html = await tplRes.text();

  const eraParam = url.searchParams.get("era");
  const validEras = ["ancient", "century", "decade", "recent3"];
  const isEra = eraParam && validEras.includes(eraParam);

  const canonicalUrl = isEra
    ? `https://${hostCfg.host}/wealth?era=${eraParam}`
    : `https://${hostCfg.host}/wealth`;
  html = html.replace(/<link rel="canonical" href="[^"]*"/i, `<link rel="canonical" href="${canonicalUrl}"`);

  // SSR 首屏直出全部商业变现模式卡片，确保爬虫与用户 0ms 获取完整内容
  const items = isEra ? WEALTH_SEED.filter((x) => x.era === eraParam) : WEALTH_SEED;
  const ssrCards = items
    .map((it) => {
      const stars = "★".repeat(it.scalability) + "☆".repeat(5 - it.scalability);
      const soloBadge = it.solo_friendly
        ? `<span class="w-badge solo">👤 适合个体/一人公司起步</span>`
        : `<span class="w-badge corp">🏢 需机构/重资本/牌照运作</span>`;
      const exHtml = (it.examples || [])
        .map((ex) => `<span class="ex-chip">${escapeXml(ex)}</span>`)
        .join("");
      return `
        <article class="w-card" data-era="${escapeXml(it.era)}" data-lev="${escapeXml(it.leverage)}">
          <div class="w-card-top">
            <span class="w-era-tag era-${escapeXml(it.era)}">${escapeXml(it.era_label)} · ${escapeXml(it.period)}</span>
            <span class="w-lev-tag">${escapeXml(it.leverage_label)}</span>
          </div>
          <h3 class="w-title">${escapeXml(it.title)}</h3>
          <div class="w-formula"><code>📐 盈利公式：${escapeXml(it.formula)}</code></div>
          <p class="w-essence">${escapeXml(it.essence)}</p>
          <div class="w-examples">
            <div class="w-sec-label">📌 典型落地业态与实操载体：</div>
            <div class="ex-wrap">${exHtml}</div>
          </div>
          <div class="w-meta-grid">
            <div><span class="m-k">准入门槛：</span><span class="m-v">${escapeXml(it.barrier)}</span></div>
            <div><span class="m-k">规模复利上限：</span><span class="m-v stars">${stars}</span></div>
          </div>
          <div class="w-risk">⚠️ <strong>周期风险与避坑：</strong>${escapeXml(it.risk_pitfall)}</div>
          <div class="w-foot">${soloBadge}</div>
        </article>`;
    })
    .join("\n");

  html = html.replace(
    /<section class="wealth-grid" id="wealthList">[\s\S]*?<\/section>/i,
    `<section class="wealth-grid" id="wealthList">\n${ssrCards}\n    </section>`
  );

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
