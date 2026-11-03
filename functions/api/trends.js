// functions/api/trends.js
// ---------------------------------------------------------------------------
// 互联网破圈大事件与年度热搜历史通鉴 · 接口 (Serverless API)
// 包含 Cloudflare D1 持久化存储与内置种子兜底机制
// ---------------------------------------------------------------------------

import { TRENDS_SEED } from "../_lib/trends_seed.js";

function json(status, data, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      ...extraHeaders,
    },
  });
}

function hasD1(env) {
  return env && env.DB && typeof env.DB.prepare === "function";
}

async function ensureD1TrendsSchema(db) {
  try {
    await db.prepare(`CREATE TABLE IF NOT EXISTS hot_events_history (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      event_date TEXT NOT NULL,
      event_year INTEGER NOT NULL,
      month_day TEXT NOT NULL,
      peak_heat INTEGER DEFAULT 0,
      peak_heat_display TEXT,
      platforms TEXT,
      summary TEXT NOT NULL,
      impact_level INTEGER DEFAULT 1,
      tags TEXT,
      ref_url TEXT,
      created_at INTEGER DEFAULT 0
    )`).run();

    await db.prepare("CREATE INDEX IF NOT EXISTS idx_hot_events_year ON hot_events_history(event_year)").run();
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_hot_events_cat ON hot_events_history(category)").run();
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_hot_events_date ON hot_events_history(event_date DESC)").run();
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_hot_events_md ON hot_events_history(month_day)").run();
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_hot_events_impact ON hot_events_history(impact_level DESC)").run();
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_hot_events_heat ON hot_events_history(peak_heat DESC)").run();
  } catch (err) {
    console.error("ensureD1TrendsSchema error:", err.message);
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  if (!hasD1(env)) {
    return json(503, { error: "Cloudflare D1 is not bound or configured (env.DB missing)" });
  }

  await ensureD1TrendsSchema(env.DB);

  if (action === "batch_insert") {
    try {
      const body = await request.json();
      const list = Array.isArray(body) ? body : body.events;
      if (!Array.isArray(list) || list.length === 0) {
        return json(400, { error: "Body must contain a non-empty 'events' array" });
      }

      const stmt = env.DB.prepare(`
        INSERT OR REPLACE INTO hot_events_history (
          id, title, category, event_date, event_year, month_day,
          peak_heat, peak_heat_display, platforms, summary, impact_level,
          tags, ref_url, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const batch = list.map((e) =>
        stmt.bind(
          e.id,
          e.title,
          e.category,
          e.event_date,
          e.event_year,
          e.month_day || e.event_date.slice(5),
          e.peak_heat || 0,
          e.peak_heat_display || "",
          e.platforms || "",
          e.summary,
          e.impact_level || 1,
          e.tags || "",
          e.ref_url || "",
          Date.now()
        )
      );

      await env.DB.batch(batch);
      return json(200, { success: true, inserted: list.length });
    } catch (e) {
      return json(500, { error: e.message });
    }
  }

  return json(400, { error: "Unknown action" });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const isOverview = url.searchParams.get("overview") === "1";
  const yearParam = url.searchParams.get("year");
  const categoryParam = url.searchParams.get("category");
  const isToday = url.searchParams.get("today") === "1";
  const impactParam = url.searchParams.get("impact");
  const q = (url.searchParams.get("q") || "").trim().toLowerCase();
  const sort = url.searchParams.get("sort") || "date"; // date, heat, impact
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("pageSize") || "12", 10)));

  const now = new Date();
  const todayMD = `${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  // 1. D1 数据库优先
  if (hasD1(env)) {
    try {
      await ensureD1TrendsSchema(env.DB);

      if (isOverview) {
        const totalRow = await env.DB.prepare(
          "SELECT COUNT(*) AS total, MAX(peak_heat) AS max_heat FROM hot_events_history"
        ).first();

        if (!totalRow || totalRow.total === 0) {
          return fallbackOverview(todayMD);
        }

        const epochRow = await env.DB.prepare(
          "SELECT COUNT(*) AS c FROM hot_events_history WHERE impact_level = 3"
        ).first();

        const catRows = await env.DB.prepare(
          "SELECT category, COUNT(*) AS count FROM hot_events_history GROUP BY category ORDER BY count DESC"
        ).all();

        const yearRows = await env.DB.prepare(
          "SELECT event_year AS year, COUNT(*) AS count FROM hot_events_history GROUP BY event_year ORDER BY event_year DESC"
        ).all();

        // 历史上的今天
        const todayRows = await env.DB.prepare(
          "SELECT * FROM hot_events_history WHERE month_day = ? ORDER BY event_year DESC"
        ).bind(todayMD).all();

        return json(200, {
          success: true,
          storage: "d1",
          total_events: totalRow.total,
          epoch_count: epochRow?.c || 0,
          peak_heat_max: totalRow.max_heat || 0,
          categories: catRows.results || [],
          years: yearRows.results || [],
          today_md: todayMD,
          today_events: todayRows.results || [],
        });
      }

      // 列表查询构建
      const whereClauses = [];
      const bindings = [];

      if (yearParam) {
        const y = parseInt(yearParam, 10);
        if (!isNaN(y)) {
          whereClauses.push("event_year = ?");
          bindings.push(y);
        }
      }
      if (categoryParam) {
        whereClauses.push("category = ?");
        bindings.push(categoryParam);
      }
      if (isToday) {
        whereClauses.push("month_day = ?");
        bindings.push(todayMD);
      }
      if (impactParam) {
        const imp = parseInt(impactParam, 10);
        if (!isNaN(imp)) {
          whereClauses.push("impact_level >= ?");
          bindings.push(imp);
        }
      }
      if (q) {
        whereClauses.push("(LOWER(title) LIKE ? OR LOWER(summary) LIKE ? OR LOWER(tags) LIKE ? OR LOWER(platforms) LIKE ?)");
        const like = `%${q}%`;
        bindings.push(like, like, like, like);
      }

      const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

      let orderBy = "event_date DESC";
      if (sort === "heat") orderBy = "peak_heat DESC, event_date DESC";
      else if (sort === "impact") orderBy = "impact_level DESC, peak_heat DESC";

      const countRow = await env.DB.prepare(`SELECT COUNT(*) AS total FROM hot_events_history ${whereSql}`).bind(...bindings).first();
      const total = countRow ? countRow.total : 0;

      const offset = (page - 1) * pageSize;
      const listSql = `SELECT * FROM hot_events_history ${whereSql} ORDER BY ${orderBy} LIMIT ? OFFSET ?`;
      const queryBindings = [...bindings, pageSize, offset];
      const { results } = await env.DB.prepare(listSql).bind(...queryBindings).all();

      return json(200, {
        success: true,
        storage: "d1",
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
        items: results || [],
      });
    } catch (e) {
      console.error("D1 trends query error, fallback to seed:", e.message);
    }
  }

  // 2. 种子数据集兜底逻辑
  if (isOverview) {
    return fallbackOverview(todayMD);
  }

  return fallbackQuery({ yearParam, categoryParam, isToday, impactParam, q, sort, page, pageSize, todayMD });
}

function fallbackOverview(todayMD) {
  const total = TRENDS_SEED.length;
  const epochCount = TRENDS_SEED.filter((e) => e.impact_level === 3).length;
  const peakHeatMax = Math.max(...TRENDS_SEED.map((e) => e.peak_heat || 0));

  const catMap = {};
  for (const e of TRENDS_SEED) {
    catMap[e.category] = (catMap[e.category] || 0) + 1;
  }
  const categories = Object.keys(catMap).map((c) => ({ category: c, count: catMap[c] }));

  const yearMap = {};
  for (const e of TRENDS_SEED) {
    yearMap[e.event_year] = (yearMap[e.event_year] || 0) + 1;
  }
  const years = Object.keys(yearMap)
    .sort((a, b) => b - a)
    .map((y) => ({ year: parseInt(y, 10), count: yearMap[y] }));

  const todayEvents = TRENDS_SEED.filter((e) => e.month_day === todayMD);

  return json(200, {
    success: true,
    storage: "seed",
    total_events: total,
    epoch_count: epochCount,
    peak_heat_max: peakHeatMax,
    categories,
    years,
    today_md: todayMD,
    today_events: todayEvents,
  });
}

function fallbackQuery({ yearParam, categoryParam, isToday, impactParam, q, sort, page, pageSize, todayMD }) {
  let list = [...TRENDS_SEED];

  if (yearParam) {
    const y = parseInt(yearParam, 10);
    if (!isNaN(y)) list = list.filter((e) => e.event_year === y);
  }
  if (categoryParam) {
    list = list.filter((e) => e.category === categoryParam);
  }
  if (isToday) {
    list = list.filter((e) => e.month_day === todayMD);
  }
  if (impactParam) {
    const imp = parseInt(impactParam, 10);
    if (!isNaN(imp)) list = list.filter((e) => e.impact_level >= imp);
  }
  if (q) {
    list = list.filter(
      (e) =>
        (e.title && e.title.toLowerCase().includes(q)) ||
        (e.summary && e.summary.toLowerCase().includes(q)) ||
        (e.tags && e.tags.toLowerCase().includes(q)) ||
        (e.platforms && e.platforms.toLowerCase().includes(q))
    );
  }

  if (sort === "heat") {
    list.sort((a, b) => (b.peak_heat || 0) - (a.peak_heat || 0));
  } else if (sort === "impact") {
    list.sort((a, b) => (b.impact_level || 1) - (a.impact_level || 1) || (b.peak_heat || 0) - (a.peak_heat || 0));
  } else {
    // date
    list.sort((a, b) => (b.event_date || "").localeCompare(a.event_date || ""));
  }

  const total = list.length;
  const offset = (page - 1) * pageSize;
  const paged = list.slice(offset, offset + pageSize);

  return json(200, {
    success: true,
    storage: "seed",
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
    items: paged,
  });
}
