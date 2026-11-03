// functions/api/papers.js
// ---------------------------------------------------------------------------
// AI 论文档案库与 Cloudflare D1 持久化存储 API
// 
// 支持功能：
//   1. GET  /api/papers?weeks_overview=1 获取 2026 全年周刊概览列表 (第 01 周至第 44+ 周)
//   2. GET  /api/papers?week=2026-W44   按周精确查询该周论文清单与 7 天统计分布
//   3. GET  /api/papers?days=7          滚动窗口模式查询 (最近 7/14/30 天或全年)
//   4. POST /api/papers?action=batch_insert 批量导入指定周论文数据至 D1
//   5. POST /api/papers?action=init_seed 一键初始化 D1 表结构并写入种子数据
//   6. POST /api/papers?action=sync      全自动从 Hugging Face / arXiv 抓取并持久化
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
 * 计算 ISO-8601 标准年份与周数 (例如 "2026-W44")
 */
export function getYearWeek(dateInput) {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "2026-W01";
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

/**
 * 根据 ISO 周代码解析周一至周日的自然日期起止范围 (YYYY-MM-DD)
 */
export function getWeekDateRange(yearWeek) {
  const match = (yearWeek || "").match(/^(\d{4})-W(\d{2})$/);
  if (!match) return { startDate: "", endDate: "" };
  const year = parseInt(match[1], 10);
  const week = parseInt(match[2], 10);
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = (jan4.getDay() + 6) % 7;
  const monWeek1 = new Date(jan4.getTime() - dayOfWeek * 86400000);
  const targetMon = new Date(monWeek1.getTime() + (week - 1) * 7 * 86400000);
  const targetSun = new Date(targetMon.getTime() + 6 * 86400000);
  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { startDate: fmt(targetMon), endDate: fmt(targetSun) };
}

/**
 * 校验 Cloudflare D1 数据库实例是否有效可用
 */
function hasD1(env) {
  return env && env.DB && typeof env.DB.prepare === "function";
}

/**
 * 初始化并维护 D1 表结构 (支持 year_week 周索引)
 */
async function ensureD1Schema(db) {
  const createTableSql = `CREATE TABLE IF NOT EXISTS ai_papers (
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
    year_week TEXT,
    created_at INTEGER DEFAULT 0
  )`;
  await db.prepare(createTableSql).run();

  try {
    await db.prepare("ALTER TABLE ai_papers ADD COLUMN year_week TEXT").run();
  } catch {}

  try {
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_ai_papers_pub_date ON ai_papers(pub_date)").run();
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_ai_papers_ts ON ai_papers(ts DESC)").run();
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_ai_papers_starred ON ai_papers(is_starred)").run();
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_ai_papers_week ON ai_papers(year_week)").run();
  } catch (idxErr) {
    console.warn("Index creation warning:", idxErr);
  }

  // 自动回填遗漏 year_week 的旧数据
  try {
    const unassigned = await db.prepare("SELECT id, pub_date FROM ai_papers WHERE year_week IS NULL OR year_week = '' LIMIT 100").all();
    if (unassigned?.results?.length) {
      for (const r of unassigned.results) {
        const w = getYearWeek(r.pub_date);
        await db.prepare("UPDATE ai_papers SET year_week = ? WHERE id = ?").bind(w, r.id).run();
      }
    }
  } catch (e) {
    console.warn("Backfill year_week notice:", e);
  }
}

/**
 * 获取 2026 全年周度概览列表
 */
async function handleWeeksOverview(env) {
  if (hasD1(env)) {
    try {
      await ensureD1Schema(env.DB);
      const rows = await env.DB.prepare(`
        SELECT 
          year_week, 
          min(pub_date) as start_date, 
          max(pub_date) as end_date, 
          count(*) as count, 
          sum(is_starred) as starred_count
        FROM ai_papers 
        WHERE year_week IS NOT NULL AND year_week != ''
        GROUP BY year_week 
        ORDER BY year_week DESC
      `).all();

      const weeks = (rows?.results || []).map((r) => {
        const parts = r.year_week.split("-W");
        const y = parseInt(parts[0], 10) || 2026;
        const w = parseInt(parts[1], 10) || 1;
        const range = getWeekDateRange(r.year_week);
        const sDate = r.start_date || range.startDate;
        const eDate = r.end_date || range.endDate;
        const q = w <= 13 ? "Q1" : (w <= 26 ? "Q2" : (w <= 39 ? "Q3" : "Q4"));
        return {
          week: r.year_week,
          weekNum: w,
          year: y,
          quarter: q,
          label: `${y} 年第 ${String(w).padStart(2, "0")} 周 (${sDate.slice(5)} - ${eDate.slice(5)})`,
          shortLabel: `第 ${String(w).padStart(2, "0")} 周 (${sDate.slice(5)} - ${eDate.slice(5)})`,
          startDate: sDate,
          endDate: eDate,
          count: r.count,
          starredCount: r.starred_count || 0,
        };
      });

      return json(200, {
        success: true,
        storage: "d1",
        total_weeks: weeks.length,
        latest_week: weeks[0]?.week || "2026-W44",
        weeks,
      });
    } catch (e) {
      console.error("handleWeeksOverview D1 error:", e);
    }
  }

  // 种子兜底计算
  const weekMap = new Map();
  for (const p of PAPERS_SEED) {
    const w = p.year_week || getYearWeek(p.pub_date);
    if (!weekMap.has(w)) {
      weekMap.set(w, { week: w, count: 0, starredCount: 0, dates: [] });
    }
    const item = weekMap.get(w);
    item.count++;
    if (p.is_starred) item.starredCount++;
    if (p.pub_date) item.dates.push(p.pub_date);
  }

  const sortedKeys = [...weekMap.keys()].sort().reverse();
  const weeks = sortedKeys.map((w) => {
    const it = weekMap.get(w);
    const parts = w.split("-W");
    const y = parseInt(parts[0], 10) || 2026;
    const num = parseInt(parts[1], 10) || 1;
    const range = getWeekDateRange(w);
    const sDate = it.dates.sort()[0] || range.startDate;
    const eDate = it.dates.sort().pop() || range.endDate;
    return {
      week: w,
      weekNum: num,
      year: y,
      quarter: num <= 13 ? "Q1" : (num <= 26 ? "Q2" : (num <= 39 ? "Q3" : "Q4")),
      label: `${y} 年第 ${String(num).padStart(2, "0")} 周 (${sDate.slice(5)} - ${eDate.slice(5)})`,
      shortLabel: `第 ${String(num).padStart(2, "0")} 周 (${sDate.slice(5)} - ${eDate.slice(5)})`,
      startDate: sDate,
      endDate: eDate,
      count: it.count,
      starredCount: it.starredCount,
    };
  });

  return json(200, {
    success: true,
    storage: "seed",
    total_weeks: weeks.length,
    latest_week: weeks[0]?.week || "2026-W44",
    weeks,
  });
}

/**
 * GET /api/papers
 * 支持参数：
 *   - week: 指定周 (例如 "2026-W44" 或 "latest")
 *   - weeks_overview: "1" (获取全年周次目录)
 *   - days: 滚动天数 (默认 7, 支持 14, 30, all)
 *   - page, pageSize, starred, q
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // 1. 周概览清单目录
  if (url.searchParams.get("weeks_overview") === "1" || url.searchParams.get("overview") === "weeks") {
    return handleWeeksOverview(env);
  }

  const reqWeek = url.searchParams.get("week");
  const isWeeklyMode = !!reqWeek;

  const daysParam = url.searchParams.get("days");
  const isAll = daysParam === "all" || daysParam === "365";
  const days = isAll ? 365 : Math.max(1, Math.min(60, parseInt(daysParam || "7", 10)));
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const pageSize = Math.max(1, Math.min(200, parseInt(url.searchParams.get("pageSize") || "60", 10)));
  const starredOnly = url.searchParams.get("starred") === "1" || url.searchParams.get("starred") === "true";
  const kw = (url.searchParams.get("q") || "").trim().toLowerCase();

  // -------------------------------------------------------------------------
  // A. Cloudflare D1 数据库执行模式
  // -------------------------------------------------------------------------
  if (hasD1(env)) {
    try {
      await ensureD1Schema(env.DB);

      let targetWeek = reqWeek;
      if (reqWeek === "latest") {
        const latestRow = await env.DB.prepare("SELECT year_week FROM ai_papers WHERE year_week IS NOT NULL ORDER BY year_week DESC LIMIT 1").first();
        targetWeek = latestRow?.year_week || "2026-W44";
      }

      const conds = [];
      const params = [];

      if (isWeeklyMode && targetWeek) {
        conds.push("year_week = ?");
        params.push(targetWeek);
      } else {
        // 滚动天数窗口
        const seedLatest = PAPERS_SEED.length ? PAPERS_SEED[0].ts : Date.now();
        const isFresh = Math.abs(Date.now() - seedLatest) < 86400 * 1000;
        const anchorTs = isFresh ? Date.now() : seedLatest;
        const cutoffTs = isAll ? 0 : (anchorTs - (days * 86400 * 1000 + 3600 * 1000));
        conds.push("ts >= ?");
        params.push(cutoffTs);
      }

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

      // 分页查询论文列表
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
        FROM ai_papers WHERE ${whereClause}
      `).bind(...params).first();

      let daily = [];
      let coverage = "";

      if (isWeeklyMode && targetWeek) {
        // 按周展示时，固定呈现当周 7 天的每日发文走势
        const range = getWeekDateRange(targetWeek);
        const startD = new Date(range.startDate);
        const dayNames = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

        // 查出该周每日的真实篇数
        const dailyDbRes = await env.DB.prepare(`
          SELECT pub_date, count(*) as count 
          FROM ai_papers 
          WHERE year_week = ? 
          GROUP BY pub_date
        `).bind(targetWeek).all();

        const countMap = new Map();
        for (const r of dailyDbRes?.results || []) {
          countMap.set(r.pub_date, r.count);
        }

        daily = [];
        for (let i = 0; i < 7; i++) {
          const curD = new Date(startD.getTime() + i * 86400000);
          const fDate = `${curD.getFullYear()}-${String(curD.getMonth() + 1).padStart(2, "0")}-${String(curD.getDate()).padStart(2, "0")}`;
          daily.push({
            date: fDate.slice(5),
            fullDate: fDate,
            dayName: dayNames[i],
            count: countMap.get(fDate) || 0,
          });
        }
        coverage = `${range.startDate.slice(5)} → ${range.endDate.slice(5)}`;
      } else {
        // 滚动天数模式
        const dailyDbRes = await env.DB.prepare(`
          SELECT pub_date, count(*) as count 
          FROM ai_papers 
          WHERE ${whereClause} 
          GROUP BY pub_date 
          ORDER BY pub_date ASC
        `).bind(...params).all();

        const minDate = statsRes?.min_date || "";
        const maxDate = statsRes?.max_date || "";
        coverage = minDate && maxDate ? `${minDate.slice(5)} → ${maxDate.slice(5)}` : `${days} 天窗口`;

        daily = (dailyDbRes?.results || []).map((r) => ({
          date: r.pub_date ? r.pub_date.slice(5) : "",
          fullDate: r.pub_date,
          count: r.count,
        }));
      }

      return json(200, {
        items,
        total,
        page,
        pageSize,
        hasMore: offset + items.length < total,
        stats: {
          mode: isWeeklyMode ? "week" : "days",
          week: targetWeek,
          days: isWeeklyMode ? undefined : days,
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
    }
  }

  // -------------------------------------------------------------------------
  // B. 优雅回退：使用内置种子快照在内存中完成过滤、分页与统计
  // -------------------------------------------------------------------------
  let targetWeek = reqWeek;
  if (reqWeek === "latest") targetWeek = "2026-W44";

  let filtered = PAPERS_SEED.slice();
  if (isWeeklyMode && targetWeek) {
    filtered = filtered.filter((p) => (p.year_week || getYearWeek(p.pub_date)) === targetWeek);
  } else {
    const seedLatest = PAPERS_SEED.length ? PAPERS_SEED[0].ts : Date.now();
    const cutoffTs = isAll ? 0 : (seedLatest - (days * 86400 * 1000 + 3600 * 1000));
    filtered = filtered.filter((p) => p.ts >= cutoffTs);
  }

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

  const sourceSet = new Set(filtered.map((p) => p.source));
  const starredTotal = filtered.filter((p) => p.is_starred).length;

  let daily = [];
  let coverage = "";

  if (isWeeklyMode && targetWeek) {
    const range = getWeekDateRange(targetWeek);
    const startD = new Date(range.startDate);
    const dayNames = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
    const countMap = new Map();
    for (const p of filtered) {
      countMap.set(p.pub_date, (countMap.get(p.pub_date) || 0) + 1);
    }
    for (let i = 0; i < 7; i++) {
      const curD = new Date(startD.getTime() + i * 86400000);
      const fDate = `${curD.getFullYear()}-${String(curD.getMonth() + 1).padStart(2, "0")}-${String(curD.getDate()).padStart(2, "0")}`;
      daily.push({
        date: fDate.slice(5),
        fullDate: fDate,
        dayName: dayNames[i],
        count: countMap.get(fDate) || 0,
      });
    }
    coverage = `${range.startDate.slice(5)} → ${range.endDate.slice(5)}`;
  } else {
    const dayMap = new Map();
    for (const p of filtered) {
      const d = p.pub_date;
      dayMap.set(d, (dayMap.get(d) || 0) + 1);
    }
    const sortedDates = [...dayMap.keys()].sort();
    daily = sortedDates.map((d) => ({
      date: d.slice(5),
      fullDate: d,
      count: dayMap.get(d),
    }));
    const minDate = sortedDates[0] || "";
    const maxDate = sortedDates[sortedDates.length - 1] || "";
    coverage = minDate && maxDate ? `${minDate.slice(5)} → ${maxDate.slice(5)}` : `${days} 天窗口`;
  }

  return json(200, {
    items,
    total,
    page,
    pageSize,
    hasMore: offset + items.length < total,
    stats: {
      mode: isWeeklyMode ? "week" : "days",
      week: targetWeek,
      days: isWeeklyMode ? undefined : days,
      total,
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
 * 支持全自动抓取更新、D1 数据批量写入与种子初始化
 */
export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const url = new URL(request.url);
    const action = url.searchParams.get("action") || "sync";

    // 1. 批量导入论文数据至 D1 (支持 2026 全年周刊大批量入库)
    if (action === "batch_insert") {
      if (!hasD1(env)) {
        return json(400, { error: "D1 database binding 'DB' not configured" });
      }
      await ensureD1Schema(env.DB);

      let body = {};
      try {
        body = await request.json();
      } catch (e) {
        return json(400, { error: "Invalid JSON body" });
      }

      const papers = Array.isArray(body.papers) ? body.papers : [];
      if (!papers.length) {
        return json(400, { error: "Empty papers array" });
      }

      const stmts = [];
      for (const p of papers) {
        const pubDate = (p.pub_date || "").slice(0, 10);
        const yearWeek = p.year_week || getYearWeek(pubDate);
        const ts = p.ts || toTs(pubDate) || Date.now();
        const stamp = p.stamp || `${pubDate.slice(5)} · ${p.source}`;

        stmts.push(
          env.DB.prepare(`
            INSERT OR IGNORE INTO ai_papers (id, title, orig_title, url, summary, source, badge_type, is_starred, pub_date, stamp, ts, year_week, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            p.id,
            p.title,
            p.orig_title || "",
            p.url,
            p.summary || "",
            p.source || "AI Research",
            p.badge_type || "lab",
            p.is_starred ? 1 : 0,
            pubDate,
            stamp,
            ts,
            yearWeek,
            Date.now()
          )
        );
      }

      const chunkSize = 25;
      let insertedBatches = 0;
      for (let i = 0; i < stmts.length; i += chunkSize) {
        await env.DB.batch(stmts.slice(i, i + chunkSize));
        insertedBatches++;
      }

      return json(200, {
        success: true,
        total: papers.length,
        batches: insertedBatches,
        message: `Batch insert complete: ${papers.length} papers processed into D1`,
      });
    }

    // 2. 初始化种子数据到 D1
    if (action === "init_seed") {
      if (!hasD1(env)) {
        return json(400, { error: "D1 database binding 'DB' not found in Cloudflare environment" });
      }
      await ensureD1Schema(env.DB);

      const stmts = [];
      for (const p of PAPERS_SEED) {
        const pubDate = (p.pub_date || "").slice(0, 10);
        const yearWeek = p.year_week || getYearWeek(pubDate);
        stmts.push(
          env.DB.prepare(`
            INSERT OR IGNORE INTO ai_papers (id, title, orig_title, url, summary, source, badge_type, is_starred, pub_date, stamp, ts, year_week, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            p.id,
            p.title,
            p.orig_title || "",
            p.url,
            p.summary || "",
            p.source,
            p.badge_type || "media",
            p.is_starred ? 1 : 0,
            pubDate,
            p.stamp || "",
            p.ts,
            yearWeek,
            p.ts
          )
        );
      }
      const chunkSize = 25;
      for (let i = 0; i < stmts.length; i += chunkSize) {
        await env.DB.batch(stmts.slice(i, i + chunkSize));
      }

      return json(200, { success: true, count: stmts.length, message: "D1 database initialized with seed papers" });
    }

    // 3. 全自动从 Hugging Face / arXiv 抓取并持久化新论文
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
            const yearWeek = getYearWeek(pubDate);

            const res = await env.DB.prepare(`
              INSERT OR IGNORE INTO ai_papers (id, title, orig_title, url, summary, source, badge_type, is_starred, pub_date, stamp, ts, year_week, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(paperId, p.title, p.title, paperUrl, summary, "Hugging Face", "lab", 0, pubDate, stamp, ts, yearWeek, Date.now()).run();

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
          const yearWeek = getYearWeek(pubDate);

          const res = await env.DB.prepare(`
            INSERT OR IGNORE INTO ai_papers (id, title, orig_title, url, summary, source, badge_type, is_starred, pub_date, stamp, ts, year_week, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(paperId, title, title, rawId, summary, "arXiv", "lab", 0, pubDate, stamp, ts, yearWeek, Date.now()).run();

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
  } catch (err) {
    console.error("POST /api/papers error:", err);
    return json(500, {
      success: false,
      error: err.message || String(err),
      stack: err.stack,
    });
  }
}
