// functions/truth.js
// ---------------------------------------------------------------------------
// 认知求真与毒鸡汤避雷通鉴 Clean URL 落地页路由处理 (/truth)
// 支持服务端 SSR 案例卡片与五步核查法直出、动态 Canonical 与 SEO 结构化数据
// 支持分区域（中国/日本/德国/欧美/全球）与分语言（中/繁/英/日/德）
// ---------------------------------------------------------------------------

import { resolveHost, MAIN_HOST, HOSTS } from "./_lib/hosts.js";
import {
  TRUTH_I18N,
  TRUTH_CASES
} from "./_lib/truth_seed.js";
import { escapeXml } from "./_lib/util.js";

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // 1. 规范化重定向：若访问带有尾部斜杠 (/truth/)，301 重定向至 /truth 保持唯一 Canonical
  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    const cleanUrl = new URL(url.toString());
    cleanUrl.pathname = cleanUrl.pathname.replace(/\/+$/, "");
    return Response.redirect(cleanUrl.toString(), 301);
  }

  // 2. 跨子域访问重定向：认知求真数据库为 InfoStream 全球主站核心数据库，子域访问 301 回归主站
  const { host, cfg } = resolveHost(request);
  const hostCfg = cfg || HOSTS[MAIN_HOST];
  if (host !== MAIN_HOST && host !== `www.${MAIN_HOST}` && !host.endsWith(".pages.dev") && host !== "localhost" && host !== "127.0.0.1") {
    const mainUrl = new URL(url.toString());
    mainUrl.hostname = MAIN_HOST;
    return Response.redirect(mainUrl.toString(), 301);
  }

  const tplRes = await env.ASSETS.fetch(new Request(new URL("/truth.html", url.origin)));
  if (!tplRes.ok) {
    return new Response("404 Not Found", { status: 404 });
  }

  let html = await tplRes.text();

  const langParam = url.searchParams.get("lang") || "zh";
  const regionParam = (url.searchParams.get("region") || "all").toLowerCase();
  const verdictParam = (url.searchParams.get("verdict") || "all").toLowerCase();

  const canonicalUrl = `https://${hostCfg.host}/truth`;
  html = html.replace(/<link rel="canonical" href="[^"]*"/i, `<link rel="canonical" href="${canonicalUrl}"`);

  // 选择语言包
  const langKey = ["zh", "zh-Hant", "en", "ja", "de"].includes(langParam) ? langParam : "zh";
  const dict = TRUTH_I18N[langKey] || TRUTH_I18N.zh;

  // SSR 直出案例列表
  let filtered = TRUTH_CASES.filter((c) => {
    if (regionParam !== "all" && c.region !== regionParam) return false;
    if (verdictParam !== "all" && c.verdict !== verdictParam) return false;
    return true;
  });

  const verdictMap = {
    myth: { text: dict.verdictMyth, cls: "badge-myth" },
    "half-truth": { text: dict.verdictHalfTruth, cls: "badge-half" },
    pseudoscience: { text: dict.verdictPseudoscience, cls: "badge-pseudo" },
  };

  const regionNameMap = {
    china: dict.regionChina,
    germany: dict.regionGermany,
    japan: dict.regionJapan,
    americas: dict.regionAmericas,
    global: dict.regionGlobal,
  };

  const ssrCards = filtered.map((c) => {
    const vInfo = verdictMap[c.verdict] || { text: c.verdict, cls: "badge-myth" };
    const regName = regionNameMap[c.region] || c.region;
    const title = escapeXml(c.titles[langKey] || c.titles.zh || "");
    const subtitle = escapeXml(c.subtitles[langKey] || c.subtitles.zh || "");
    const quote = escapeXml(c.quotes[langKey] || c.quotes.zh || "");
    const flaw = escapeXml(c.flaws[langKey] || c.flaws.zh || "");
    const correction = escapeXml(c.corrections[langKey] || c.corrections.zh || "").replace(/\n/g, "<br>");
    const impact = escapeXml(c.impacts[langKey] || c.impacts.zh || "");
    const sourcesHtml = (c.sources || []).map((s) => `<li>${escapeXml(s)}</li>`).join("");

    return `
      <article class="case-card" id="${escapeXml(c.id)}">
        <div class="case-card-header">
          <div class="case-badges">
            <span class="badge badge-no">${escapeXml(c.no)}</span>
            <span class="badge badge-region">${escapeXml(regName)}</span>
            <span class="badge ${vInfo.cls}">${escapeXml(vInfo.text)}</span>
            <span class="badge badge-toxicity">☠ ${dict.toxicityScore}: ${c.toxicity}/10</span>
          </div>
          <span style="font-size: 0.8rem; color: var(--text-muted);">${escapeXml(c.category)}</span>
        </div>

        <h2 class="case-title">${title}</h2>
        <p class="case-subtitle">${subtitle}</p>

        <div class="quote-box">
          “${quote}”
          <span class="quote-meta">📌 最早出处源头：${escapeXml(c.first_appeared)}</span>
        </div>

        <div class="analysis-grid">
          <div class="analysis-box box-flaw">
            <div class="box-head">⚠️ ${dict.flawLabel}</div>
            <div>${flaw}</div>
          </div>

          <div class="analysis-box box-truth">
            <div class="box-head">✓ ${dict.truthLabel}</div>
            <div>${correction}</div>
          </div>

          <div class="analysis-box box-impact">
            <div class="box-head">💥 ${dict.impactLabel}</div>
            <div>${impact}</div>
          </div>
        </div>

        <details class="sources-box">
          <summary>📚 ${dict.sourcesLabel} (${(c.sources || []).length})</summary>
          <ol>${sourcesHtml}</ol>
        </details>

        <div class="card-footer">
          <span>档案编号：${escapeXml(c.no)} · ${escapeXml(c.id)}</span>
          <button class="btn-action" onclick="copyCaseLink(this, '${escapeXml(c.id)}')">🔗 ${dict.shareBtn}</button>
        </div>
      </article>
    `;
  }).join("");

  html = html.replace(
    /<!-- SSR_CASES_MOUNT -->[\s\S]*?<!-- \/SSR_CASES_MOUNT -->/,
    `<!-- SSR_CASES_MOUNT -->${ssrCards}<!-- /SSR_CASES_MOUNT -->`
  );

  // 内联全量数据，确保客户端首屏无额外二次请求
  const seedJson = JSON.stringify({
    i18n: TRUTH_I18N,
    cases: TRUTH_CASES,
  })
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
  html = html.replace(/<\/head>/i, `<script>window.__TRUTH_DATA__ = ${seedJson};</script>\n</head>`);

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

