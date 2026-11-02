// functions/api/papers.js
// ---------------------------------------------------------------------------
// AI 论文档案库与 Cloudflare D1 持久化存储 API
// 
// 支持功能：
//   1. GET  /api/papers            查询论文历史时间轴、指标看板与每日统计分布
//   2. POST /api/papers?action=init_seed 一键初始化 D1 表结构并写入种子数据
//   3. POST /api/papers?action=sync      全自动从 Hugging Face / arXiv 抓取并持久化
// ---------------------------------------------------------------------------

import { PAPERS_SEED } from "../_lib/papers_seed.js";
import { fetchJSON, fetchText, parseAtomEntries, xmlPick, stripTags, toTs, ago } from "../_lib/util.js";
import { guard, apiHeaders } from "./_guard.js";

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": status === 200 ? "public, max-age=60, s-maxage=300" : "no-store",
      "X-Content-Type-Options": "nosniff",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

/**
 * 校验 Cloudflare D1 数据库实例是否有效可用
 */
function hasD1(env) {
  return env && env.DB && typeof env.DB.prepare === "function";
}

/**
 * 初始化 D1 表结构
 */
async function ensureD1Schema(db) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS ai_papers (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      orig_title TEXT,
      url TEXT NOT NULL UNIQUE,
      summary TEXT,
      source TEXT NOT NULL,
      badge_type TEXT DEFAULT 'media',
      is_starred INTEGER DEFAULT 0,
      pub_date TEXT NOT NULL,
      stamp TEXT,
      ts INTEGER NOT NULL,
      created_at INTEGER DEFAULT (unixepoch() * 1000)
    );
    CREATE INDEX IF NOT EXISTS idx_ai_papers_pub_date ON ai_papers(pub_date);
    CREATE INDEX IF NOT EXISTS idx_ai_papers_ts ON ai_papers(ts DESC);
    CREATE INDEX IF NOT EXISTS idx_ai_papers_starred ON ai_papers(is_starred);
  `);
}

/**
 * GET /api/papers
 * 支持参数：days(默认7), page(默认1), pageSize(默认20), starred(0/1), q(搜索词)
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const days = Math.max(1, Math.min(60, parseInt(url.searchParams.get("days") || "7", 10)));
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const pageSize = Math.max(1, Math.min(100, parseInt(url.searchParams.get("pageSize") || "20", 10)));
  const starredOnly = url.searchParams.get("starred") === "1" || url.searchParams.get("starred") === "true";
  const kw = (url.searchParams.get("q") || "").trim().toLowerCase();

  // 锚定时间窗口：如果最新记录距今超过 1 天，以最新记录时间为锚点，保证历史种子归档完整显示
  const seedLatest = PAPERS_SEED.length ? PAPERS_SEED[0].ts : Date.now();
  const isFresh = Math.abs(Date.now() - seedLatest) < 86400 * 1000;
  const anchorTs = isFresh ? Date.now() : seedLatest;
  const cutoffTs = (days >= 60) ? 0 : (anchorTs - (days * 86400 * 1000 + 3600 * 1000));

  // 1. 若配置了 Cloudflare D1 数据库绑定，走 D1 持久化存储查询
  if (hasD1(env)) {
    try {
      await ensureD1Schema(env.DB);

      // 构建查询条件
      const conds = ["ts >= ?"];
      const params = [cutoffTs];

      if (starredOnly) {
        conds.push("is_starred = 1");
      }
      if (kw) {
        conds.push("(lower(title) LIKE ? OR lower(summary) LIKE ? OR lower(orig_title) LIKE ? OR lower(source) LIKE ?)");
        const like = `%${kw}%`;
        params.push(like, like, like, like);
      }

      const whereClause = conds.join(" AND ");

      // 查询总数
      const countRes = await env.DB.prepare(`SELECT count(*) as count FROM ai_papers WHERE ${whereClause}`)
        .bind(...params)
        .first();
      const total = countRes ? countRes.count : 0;

      // 分页查询列表
      const offset = (page - 1) * pageSize;
      const listParams = [...params, pageSize, offset];
      const listRes = await env.DB.prepare(`SELECT * FROM ai_papers WHERE ${whereClause} ORDER BY ts DESC LIMIT ? OFFSET ?`)
        .bind(...listParams)
        .all();
      const items = (listRes && listRes.results) || [];

      // 查询全局概览指标看板 (Stats)
      const statsRes = await env.DB.prepare(`
        SELECT 
          count(*) as total, 
          sum(is_starred) as starred, 
          count(DISTINCT source) as sources, 
          min(pub_date) as min_date, 
          max(pub_date) as max_date 
        FROM ai_papers WHERE ts >= ?
      `).bind(cutoffTs).first();

      // 查询最近 N 天的每日统计分布 (Daily Sparkbar)
      const dailyRes = await env.DB.prepare(`
        SELECT pub_date, count(*) as count 
        FROM ai_papers 
        WHERE ts >= ? 
        GROUP BY pub_date 
        ORDER BY pub_date ASC
      `).bind(cutoffTs).all();

      const minDate = statsRes?.min_date || "";
      const maxDate = statsRes?.max_date || "";
      const coverage = minDate && maxDate ? `${minDate.slice(5)} → ${maxDate.slice(5)}` : `${days} 天窗口`;

      const daily = (dailyRes?.results || []).map((r) => ({
        date: r.pub_date ? r.pub_date.slice(5) : "",
        fullDate: r.pub_date,
        count: r.count,
      }));

      return json(200, {
        items,
        total,
        page,
        pageSize,
        hasMore: offset + items.length < total,
        stats: {
          days,
          total: statsRes?.total || 0,
          starred: statsRes?.starred || 0,
          sources: statsRes?.sources || 0,
          coverage,
        },
        daily,
        storage: "d1",
      });
    } catch (e) {
      console.error("D1 query error, falling back to seed:", e);
      // 数据库异常时安全回退至种子快照
    }
  }

  // 2. 优雅回退：使用内置种子数据 (PAPERS_SEED) 在内存中完成过滤、分页与统计
  let filtered = PAPERS_SEED.filter((p) => p.ts >= cutoffTs);
  if (starredOnly) filtered = filtered.filter((p) => p.is_starred);
  if (kw) {
    filtered = filtered.filter((p) =>
      (p.title && p.title.toLowerCase().includes(kw)) ||
      (p.orig_title && p.orig_title.toLowerCase().includes(kw)) ||
      (p.summary && p.summary.toLowerCase().includes(kw)) ||
      (p.source && p.source.toLowerCase().includes(kw))
    );
  }

  const total = filtered.length;
  const offset = (page - 1) * pageSize;
  const items = filtered.slice(offset, offset + pageSize);

  // 计算每日统计分布
  const dayMap = new Map();
  for (const p of PAPERS_SEED.filter((p) => p.ts >= cutoffTs)) {
    const d = p.pub_date;
    dayMap.set(d, (dayMap.get(d) || 0) + 1);
  }
  const sortedDates = [...dayMap.keys()].sort();
  const daily = sortedDates.map((d) => ({
    date: d.slice(5),
    fullDate: d,
    count: dayMap.get(d),
  }));

  const allFilteredInWindow = PAPERS_SEED.filter((p) => p.ts >= cutoffTs);
  const sourceSet = new Set(allFilteredInWindow.map((p) => p.source));
  const starredTotal = allFilteredInWindow.filter((p) => p.is_starred).length;
  const minDate = sortedDates[0] || "";
  const maxDate = sortedDates[sortedDates.length - 1] || "";
  const coverage = minDate && maxDate ? `${minDate.slice(5)} → ${maxDate.slice(5)}` : `${days} 天窗口`;

  return json(200, {
    items,
    total,
    page,
    pageSize,
    hasMore: offset + items.length < total,
    stats: {
      days,
      total: allFilteredInWindow.length,
      starred: starredTotal,
      sources: sourceSet.size,
      coverage,
    },
    daily,
    storage: "seed",
  });
}

/**
 * POST /api/papers
 * 支持全自动抓取更新与 D1 数据初始化
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const action = url.searchParams.get("action") || "sync";

  // 1. 初始化种子数据到 D1
  if (action === "init_seed") {
    if (!hasD1(env)) {
      return json(400, { error: "D1 database binding 'DB' not found in Cloudflare environment" });
    }
    await ensureD1Schema(env.DB);

    const stmts = [];
    for (const p of PAPERS_SEED) {
      stmts.push(
        env.DB.prepare(`
          INSERT OR IGNORE INTO ai_papers (id, title, orig_title, url, summary, source, badge_type, is_starred, pub_date, stamp, ts)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          p.id,
          p.title,
          p.orig_title || "",
          p.url,
          p.summary || "",
          p.source,
          p.badge_type || "media",
          p.is_starred ? 1 : 0,
          p.pub_date,
          p.stamp || "",
          p.ts
        )
      );
    }
    // 批量执行
    await env.DB.batch(stmts);
    return json(200, { success: true, count: stmts.length, message: "D1 database initialized with seed papers" });
  }

  // 2. 全自动从 Hugging Face / arXiv 抓取并持久化新论文
  if (action === "sync") {
    if (!hasD1(env)) {
      return json(400, { error: "D1 database binding 'DB' not configured" });
    }
    await ensureD1Schema(env.DB);

    let inserted = 0;
    const errors = [];

    // 抓取 Hugging Face Daily Papers
    try {
      const hfData = await fetchJSON("https://huggingface.co/api/daily_papers?limit=15");
      if (Array.isArray(hfData)) {
        for (const item of hfData) {
          const p = item.paper || {};
          if (!p.id || !p.title) continue;
          const paperId = `hf_${p.id}`;
          const paperUrl = `https://huggingface.co/papers/${p.id}`;
          const summary = (p.summary || p.abstract || "").replace(/\s+/g, " ").slice(0, 260);
          const pubDate = (p.publishedAt || "").slice(0, 10) || new Date().toISOString().slice(0, 10);
          const ts = toTs(p.publishedAt) || Date.now();
          const stamp = `${pubDate.slice(5)} · Hugging Face`;

          const res = await env.DB.prepare(`
            INSERT OR IGNORE INTO ai_papers (id, title, orig_title, url, summary, source, badge_type, is_starred, pub_date, stamp, ts)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(paperId, p.title, p.title, paperUrl, summary, "Hugging Face", "lab", 0, pubDate, stamp, ts).run();

          if (res?.meta?.changes > 0) inserted++;
        }
      }
    } catch (e) {
      errors.push("Hugging Face: " + e.message);
    }

    // 抓取 arXiv cs.AI 最新论文
    try {
      const q = "cat:cs.AI+OR+cat:cs.LG";
      const u = `https://export.arxiv.org/api/query?search_query=${q}&sortBy=submittedDate&sortOrder=descending&max_results=15`;
      const xml = await fetchText(u, {}, 8000);
      const blocks = parseAtomEntries(xml);
      for (const b of blocks) {
        const title = xmlPick(b, "title").replace(/\s+/g, " ").trim();
        const rawId = xmlPick(b, "id").trim();
        const summary = stripTags(xmlPick(b, "summary"), 260);
        const published = xmlPick(b, "published");
        if (!title || !rawId) continue;
        const arxivNum = rawId.split("/abs/").pop() || "";
        const paperId = `arxiv_${arxivNum || title.slice(0, 16)}`;
        const pubDate = (published || "").slice(0, 10) || new Date().toISOString().slice(0, 10);
        const ts = toTs(published) || Date.now();
        const stamp = `${pubDate.slice(5)} · arXiv`;

        const res = await env.DB.prepare(`
          INSERT OR IGNORE INTO ai_papers (id, title, orig_title, url, summary, source, badge_type, is_starred, pub_date, stamp, ts)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(paperId, title, title, rawId, summary, "arXiv", "lab", 0, pubDate, stamp, ts).run();

        if (res?.meta?.changes > 0) inserted++;
      }
    } catch (e) {
      errors.push("arXiv: " + e.message);
    }

    return json(200, {
      success: true,
      inserted,
      errors: errors.length ? errors : undefined,
      message: `Sync completed, ${inserted} new papers stored into Cloudflare D1`,
    });
  }

  return json(400, { error: `Unsupported action: ${action}` });
}
