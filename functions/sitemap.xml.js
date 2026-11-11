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
import { getWeekDateRange } from "./api/papers.js";

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
      lastmod: now,
    },
  ];

  // 主站收录 5 大合规落地页及本域四大深度数据库落地页，杜绝混入跨子域 URL
  if (cfg.isMain) {
    urls.push(
      { loc: `https://${cfg.host}/papers`, changefreq: "daily", priority: "0.9", lastmod: now },
      { loc: `https://${cfg.host}/models`, changefreq: "daily", priority: "0.9", lastmod: now },
      { loc: `https://${cfg.host}/games`, changefreq: "daily", priority: "0.9", lastmod: now },
      { loc: `https://${cfg.host}/trends`, changefreq: "daily", priority: "0.9", lastmod: now },
      { loc: `https://${cfg.host}/wealth`, changefreq: "weekly", priority: "0.9", lastmod: now },
      { loc: `https://${cfg.host}/opensource`, changefreq: "weekly", priority: "0.9", lastmod: now },
      { loc: `https://${cfg.host}/ship`, changefreq: "weekly", priority: "0.9", lastmod: now },
      { loc: `https://${cfg.host}/prompt`, changefreq: "weekly", priority: "0.9", lastmod: now },
      { loc: `https://${cfg.host}/fire`, changefreq: "weekly", priority: "0.9", lastmod: now },
      { loc: `https://${cfg.host}/about`, changefreq: "monthly", priority: "0.5", lastmod: now },
      { loc: `https://${cfg.host}/privacy`, changefreq: "monthly", priority: "0.5", lastmod: now },
      { loc: `https://${cfg.host}/editorial`, changefreq: "monthly", priority: "0.5", lastmod: now },
      { loc: `https://${cfg.host}/contact`, changefreq: "monthly", priority: "0.5", lastmod: now },
      { loc: `https://${cfg.host}/terms`, changefreq: "monthly", priority: "0.4", lastmod: now },
    );
  } else if (cfg.key === "ai") {
    // AI 垂直站收录专属于本域的 AI 论文档案专区首页与 2026 全年周刊档案 (W01-W44)
    urls.push(
      { loc: `https://${cfg.host}/papers`, changefreq: "daily", priority: "0.9", lastmod: now },
      { loc: `https://${cfg.host}/models`, changefreq: "daily", priority: "0.9", lastmod: now },
    );

    // AI 大模型编年史历年专区 (2023-2026) 与核心前沿实验室索引
    for (let my = 2026; my >= 2023; my--) {
      urls.push({
        loc: `https://${cfg.host}/models?year=${my}`,
        changefreq: my === 2026 ? "daily" : "monthly",
        priority: my === 2026 ? "0.8" : "0.7",
        lastmod: now,
      });
    }
    for (const org of ["OpenAI", "Anthropic", "DeepSeek", "Google DeepMind", "Meta"]) {
      urls.push({
        loc: `https://${cfg.host}/models?org=${encodeURIComponent(org)}`,
        changefreq: "weekly",
        priority: "0.8",
        lastmod: now,
      });
    }

    // 查询 D1 数据库获取全部已收录周次；若环境无 D1 则回落到 2026-W01~W44 预设周
    let d1Weeks = [];
    if (env && env.DB && typeof env.DB.prepare === "function") {
      try {
        const rows = await env.DB.prepare(`
          SELECT year_week, max(pub_date) as last_date 
          FROM ai_papers 
          WHERE year_week IS NOT NULL AND year_week != ''
          GROUP BY year_week 
          ORDER BY year_week DESC
        `).all();
        if (rows?.results?.length) {
          d1Weeks = rows.results;
        }
      } catch (e) {
        console.warn("sitemap D1 query fallback:", e.message);
      }
    }

    if (d1Weeks.length) {
      for (const r of d1Weeks) {
        urls.push({
          loc: `https://${cfg.host}/papers?week=${r.year_week}`,
          lastmod: r.last_date || now,
          changefreq: r.year_week === "2026-W44" ? "daily" : "monthly",
          priority: r.year_week === "2026-W44" ? "0.8" : "0.7",
        });
      }
    } else {
      // 种子/兜底生成 2026-W44 至 2026-W01
      for (let w = 44; w >= 1; w--) {
        const yw = `2026-W${String(w).padStart(2, "0")}`;
        const range = getWeekDateRange(yw);
        urls.push({
          loc: `https://${cfg.host}/papers?week=${yw}`,
          lastmod: range.endDate || now,
          changefreq: w === 44 ? "daily" : "monthly",
          priority: w === 44 ? "0.8" : "0.7",
        });
      }
    }
  } else if (cfg.key === "game") {
    // 游戏站收录专属的 Epic 喜加一历史总账本与历年年鉴 (2019-2026)
    urls.push(
      { loc: `https://${cfg.host}/history`, changefreq: "daily", priority: "0.9", lastmod: now },
    );
    for (let y = 2026; y >= 2019; y--) {
      urls.push({
        loc: `https://${cfg.host}/history?year=${y}`,
        changefreq: y === 2026 ? "daily" : "monthly",
        priority: y === 2026 ? "0.8" : "0.7",
        lastmod: now,
      });
    }
  } else if (cfg.key === "hot") {
    // 热搜站收录专属的互联网破圈大事件历史通鉴与历年年鉴 (2020-2026) 及分类专区
    urls.push(
      { loc: `https://${cfg.host}/history`, changefreq: "daily", priority: "0.9", lastmod: now },
    );
    for (let hy = 2026; hy >= 2020; hy--) {
      urls.push({
        loc: `https://${cfg.host}/history?year=${hy}`,
        changefreq: hy === 2026 ? "daily" : "monthly",
        priority: hy === 2026 ? "0.8" : "0.7",
        lastmod: now,
      });
    }
    for (const cat of ["tech", "sports", "society", "ent", "biz"]) {
      urls.push({
        loc: `https://${cfg.host}/history?category=${cat}`,
        changefreq: "weekly",
        priority: "0.8",
        lastmod: now,
      });
    }
  }

  const body = urls
    .map((u) =>
      [
        "  <url>",
        `    <loc>${esc(u.loc)}</loc>`,
        `    <lastmod>${u.lastmod || now}</lastmod>`,
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
      "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=600",
    },
  });
}