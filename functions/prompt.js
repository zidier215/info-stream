// functions/prompt.js
// ---------------------------------------------------------------------------
// 高阶提示词模式与自主 Agent 架构通鉴 Clean URL 落地页路由处理 (/prompt)
// 支持服务端 SSR 完整卡片直出、动态 Canonical 与 SEO 结构化数据
// ---------------------------------------------------------------------------

import { resolveHost, MAIN_HOST, HOSTS } from "./_lib/hosts.js";
import {
  PROMPT_PATTERNS,
  AGENT_WORKFLOWS,
  SYSTEM_PROMPTS
} from "./_lib/prompt_seed.js";
import { escapeXml } from "./_lib/util.js";

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // 1. 规范化重定向：若访问带有尾部斜杠 (/prompt/)，301 重定向至 /prompt 保持唯一 Canonical
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

  const tplRes = await env.ASSETS.fetch(new Request(new URL("/prompt.html", url.origin)));
  if (!tplRes.ok) {
    return new Response("404 Not Found", { status: 404 });
  }

  let html = await tplRes.text();

  const canonicalUrl = `https://${hostCfg.host}/prompt`;
  html = html.replace(/<link rel="canonical" href="[^"]*"/i, `<link rel="canonical" href="${canonicalUrl}"`);

  // SSR 直出全量 Prompt 架构范式
  const ssrPatterns = PROMPT_PATTERNS.map((p) => `
    <article class="prompt-card" id="${escapeXml(p.id)}">
      <div class="card-head">
        <span class="badge badge-accent">${escapeXml(p.badge)}</span>
        <h3>${escapeXml(p.name)}</h3>
        <div class="card-subtitle"><b>学术论证：</b>${escapeXml(p.paper)}</div>
      </div>
      <p class="card-desc">${escapeXml(p.description)}</p>
      <div class="structure-box"><b>架构推导流：</b>${escapeXml(p.structure)}</div>
      <div class="info-row"><b>最佳适用场景：</b>${escapeXml(p.best_for)}</div>
      <div class="info-row"><b>推荐主力模型：</b>${escapeXml(p.best_models.join(", "))} · <b>Token 消耗系数：</b>${escapeXml(p.token_multiplier)}</div>
      <div class="code-header">
        <span>Prompt 架构模板</span>
        <button class="btn-copy" onclick="copySnippet(this, 'tmpl-${escapeXml(p.id)}')">复制模板</button>
      </div>
      <pre class="code-box"><code id="tmpl-${escapeXml(p.id)}">${escapeXml(p.template)}</code></pre>
    </article>
  `).join("");

  html = html.replace(
    /<!-- SSR_PATTERNS_MOUNT -->[\s\S]*?<!-- \/SSR_PATTERNS_MOUNT -->/,
    `<!-- SSR_PATTERNS_MOUNT -->${ssrPatterns}<!-- /SSR_PATTERNS_MOUNT -->`
  );

  // 内联初始数据，消除客户端首屏二次 API 请求
  const seedJson = JSON.stringify({
    patterns: PROMPT_PATTERNS,
    agents: AGENT_WORKFLOWS,
    prompts: SYSTEM_PROMPTS,
  })
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
  html = html.replace(/<\/head>/i, `<script>window.__PROMPT_DATA__ = ${seedJson};</script>\n</head>`);

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

