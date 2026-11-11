// functions/opensource.js
// ---------------------------------------------------------------------------
// 开源替代 & 大模型降维重构商业软件全景图谱 Clean URL 落地页路由处理 (/opensource)
// 支持服务端 SSR 知识卡片首屏直出、动态 Canonical 与 SEO 结构化数据
// ---------------------------------------------------------------------------

import { resolveHost, MAIN_HOST, HOSTS } from "./_lib/hosts.js";
import { OPENSOURCE_SEED } from "./_lib/opensource_seed.js";
import { escapeXml } from "./_lib/util.js";

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // 1. 规范化重定向：若访问带有尾部斜杠 (/opensource/)，301 重定向至 /opensource 保持唯一 Canonical
  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    const cleanUrl = new URL(url.toString());
    cleanUrl.pathname = cleanUrl.pathname.replace(/\/+$/, "");
    return Response.redirect(cleanUrl.toString(), 301);
  }

  // 2. 跨子域访问重定向：开源与AI替代为 InfoStream 全球主站核心数据库，子域访问 301 回归主站
  const { host, cfg } = resolveHost(request);
  const hostCfg = cfg || HOSTS[MAIN_HOST];
  if (host !== MAIN_HOST && host !== `www.${MAIN_HOST}` && !host.endsWith(".pages.dev") && host !== "localhost" && host !== "127.0.0.1") {
    const mainUrl = new URL(url.toString());
    mainUrl.hostname = MAIN_HOST;
    return Response.redirect(mainUrl.toString(), 301);
  }

  const tplRes = await env.ASSETS.fetch(new Request(new URL("/opensource.html", url.origin)));
  if (!tplRes.ok) {
    return new Response("404 Not Found", { status: 404 });
  }

  let html = await tplRes.text();

  const canonicalUrl = `https://${hostCfg.host}/opensource`;
  html = html.replace(/<link rel="canonical" href="[^"]*"/i, `<link rel="canonical" href="${canonicalUrl}"`);

  // SSR 首屏直出全量知识卡片，确保搜索引擎与用户 0ms 获取完整内容
  const ssrCards = OPENSOURCE_SEED
    .map((it) => {
      const typeBadge =
        it.disruption_type === "ai"
          ? `<span class="badge badge-ai">🔥 大模型降维颠覆</span>`
          : it.disruption_type === "hybrid"
          ? `<span class="badge badge-hybrid">⚡ 开源 + AI 双重重构</span>`
          : `<span class="badge badge-oss">🔓 纯开源自建替代</span>`;

      const altsHtml = (it.alternatives || [])
        .map(
          (a) => `
        <div class="alt-pill">
          <div class="alt-top">
            <span class="alt-name">${escapeXml(a.name)}</span>
            <span class="alt-stars">★ ${escapeXml(a.stars || "")}</span>
            <span class="alt-license">${escapeXml(a.license || "")}</span>
          </div>
          <p class="alt-desc">${escapeXml(a.desc || "")}</p>
          ${a.one_click_cmd ? `<code class="alt-code">${escapeXml(a.one_click_cmd)}</code>` : ""}
        </div>
      `
        )
        .join("");

      return `
        <article class="oss-card" id="${escapeXml(it.id)}">
          <div class="card-header">
            <div class="target-info">
              <span class="category-tag">${escapeXml(it.category_cn)}</span>
              <h3>${escapeXml(it.name_cn)}</h3>
              <div class="target-sub">
                <span class="strike-price">原商业版: <s>${escapeXml(it.pricing_desc || "")}</s></span>
                <span class="saving-tag">年省约 $${it.estimated_yearly_saving_usd || 0}</span>
              </div>
            </div>
            ${typeBadge}
          </div>

          <div class="pain-box">
            <b>传统商业痛点：</b>${escapeXml(it.pain_points || "")}
          </div>

          <div class="section-title">🌟 推荐开源自托管替代方案：</div>
          <div class="alts-grid">
            ${altsHtml}
          </div>

          ${
            it.llm_disruption?.is_disrupted
              ? `
            <div class="disruption-box">
              <div class="disruption-header">
                <span class="disruption-icon">🤖</span>
                <b>大模型对该类 SaaS 的降维打击机制剖析：</b>
                <span class="disruption-stars">${"★".repeat(it.llm_disruption.level || 5)}</span>
              </div>
              <p class="disruption-thesis">${escapeXml(it.llm_disruption.thesis || "")}</p>
              <div class="disruption-solution">
                <b>💡 极客推荐实操落地：</b>${escapeXml(it.llm_disruption.ai_alternative_solution || "")}
              </div>
            </div>
          `
              : ""
          }
        </article>
      `;
    })
    .join("\n");

  html = html.replace(/<div id="ossList" class="oss-list">[\s\S]*?<\/div>/i, `<div id="ossList" class="oss-list">${ssrCards}</div>`);

  // 内联初始数据
  const seedJson = JSON.stringify(OPENSOURCE_SEED)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
  html = html.replace(/<\/head>/i, `<script>window.__OPENSOURCE_DATA__ = ${seedJson};</script>\n</head>`);

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

