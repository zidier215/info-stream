// functions/robots.txt.js
// ---------------------------------------------------------------------------
// 动态 robots.txt —— 每个域名一份，指向自己的 sitemap。
//
// 为什么要动态：静态 robots.txt 只有一份，三个域名共用会导致
// ai.myinfostream.com 的 sitemap 声明指向 myinfostream.com，
// 搜索引擎会认为子站没有自己的 sitemap，独立的子站 SEO 优势直接作废。
//
// 规则要点：
//   /api/     —— 全站禁止索引。API 返回的是 JSON，被索引毫无价值，
//                而且还会暴露接口结构给爬虫。
//   /assets/  —— 允许索引但没意义，Google 索引不了 CSS/JS 正文。
//   预览域名 —— 整站 Disallow，避免 pages.dev 与正式域争权重。
// ---------------------------------------------------------------------------

import { resolveHost } from "./_lib/hosts.js";

export async function onRequest(context) {
  const { request, env } = context;
  const { host, cfg, isPreview } = resolveHost(request);

  const lines = [];
  if (isPreview || !cfg) {
    lines.push("# 预览环境：不索引");
    lines.push("User-agent: *");
    lines.push("Disallow: /");
  } else {
    lines.push(`# ${cfg.title} / ${cfg.titleEn}`);
    lines.push("User-agent: Mediapartners-Google");
    lines.push("Allow: /");
    lines.push("");
    lines.push("User-agent: Googlebot");
    lines.push("Allow: /");
    lines.push("");
    lines.push("User-agent: *");
    lines.push("Disallow: /api/");       // JSON 接口，无索引价值且暴露结构
    lines.push("Disallow: /*?key=");     // 私有工具的密钥参数，别让爬虫捡走
    lines.push("Allow: /");
    lines.push("");
    lines.push(`Sitemap: https://${cfg.host}/sitemap.xml`);
  }

  return new Response(lines.join("\n") + "\n", {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}