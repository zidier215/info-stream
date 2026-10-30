// functions/sitemap.xml.js
// ---------------------------------------------------------------------------
// 每个域名一份 sitemap，只收录自己的 URL。
//
// 关键决策：不列 ?tab=xxx 这种带参数的 URL。
//   理由：tab 切换是纯前端行为，同一份内容换参数返回高度重叠的结果页，
//   列进去就是自己制造重复内容（duplicate content），会把主站权重摊薄。
//   真要做多语言，应该用路径（/en/、/fr/）而不是查询参数 —— 但那需要
//   另做静态化与独立 HTML，成本远大于当前收益。v2.4 先把结构留对：
//   每站一个干净的根 URL + 明确的 canonical + 子站互链。
//
// 另外注意 lastmod 用「构建/部署时间」而非内容时间：
//   信息流是实时刷新的，逐条标注 lastmod 没有意义（Google 会忽略
//   频繁变化的 lastmod），标注部署时间才是搜索引擎真正关心的信号。
// ---------------------------------------------------------------------------

import { resolveHost, HOSTS, MAIN_HOST } from "./_lib/hosts.js";

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export async function onRequest(context) {
  const { request, env } = context;
  const { cfg, isPreview } = resolveHost(request);

  // 预览域名不出 sitemap（robots.txt 已经 Disallow 了，这里双保险）
  if (isPreview || !cfg) {
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>\n',
      {
        status: 200,
        headers: {
          "Content-Type": "application/xml; charset=utf-8",
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const now = new Date().toISOString().slice(0, 10);
  const urls = [
    {
      loc: `https://${cfg.host}/`,
      changefreq: "hourly",
      priority: "1.0",
    },
    {
      loc: `https://${cfg.host}/about`,
      changefreq: "monthly",
      priority: "0.5",
    },
    {
      loc: `https://${cfg.host}/privacy`,
      changefreq: "monthly",
      priority: "0.5",
    },
    {
      loc: `https://${cfg.host}/editorial`,
      changefreq: "monthly",
      priority: "0.5",
    },
    {
      loc: `https://${cfg.host}/contact`,
      changefreq: "monthly",
      priority: "0.5",
    },
    {
      loc: `https://${cfg.host}/terms`,
      changefreq: "monthly",
      priority: "0.4",
    },
  ];

  // 主站多列出子站入口，让权重能流过去（子站自己也各有一份）
  if (cfg.isMain) {
    for (const s of cfg.siblings || []) {
      urls.push({ loc: `https://${s}/`, changefreq: "hourly", priority: "0.8" });
    }
  }

  const body = urls
    .map((u) =>
      [
        "  <url>",
        `    <loc>${esc(u.loc)}</loc>`,
        `    <lastmod>${now}</lastmod>`,
        `    <changefreq>${u.changefreq}</changefreq>`,
        `    <priority>${u.priority}</priority>`,
        "  </url>",
      ].join("\n"))
    .join("\n");

  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    body + "\n" +
    "</urlset>\n";

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}