// functions/api/games.js
// ---------------------------------------------------------------------------
// Epic 喜加一历史总账本 · 历年免费大作数据接口 (Serverless API)
// 包含 Cloudflare D1 持久化存储与内置种子兜底机制
// ---------------------------------------------------------------------------

import { GAMES_SEED } from "../_lib/games_seed.js";

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

async function ensureD1GamesSchema(db) {
  try {
    await db.prepare(`CREATE TABLE IF NOT EXISTS epic_games_history (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      title_cn TEXT,
      developer TEXT,
      publisher TEXT,
      price_usd REAL DEFAULT 0,
      price_rmb REAL DEFAULT 0,
      giveaway_start TEXT NOT NULL,
      giveaway_end TEXT NOT NULL,
      giveaway_year INTEGER NOT NULL,
      is_aaa INTEGER DEFAULT 0,
      is_mystery INTEGER DEFAULT 0,
      has_dlc INTEGER DEFAULT 0,
      tags TEXT,
      rating TEXT,
      cover_url TEXT,
      store_url TEXT,
      brief TEXT,
      created_at INTEGER DEFAULT 0
    )`).run();

    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_epic_games_year ON epic_games_history(giveaway_year)`).run();
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_epic_games_price ON epic_games_history(price_usd DESC)`).run();
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_epic_games_start ON epic_games_history(giveaway_start DESC)`).run();
  } catch (e) {
    console.warn("ensureD1GamesSchema warning:", e.message);
  }
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  // 1. 批量插入接口 POST /api/games?action=batch_insert
  if (request.method === "POST" && url.searchParams.get("action") === "batch_insert") {
    return handleBatchInsert(request, env);
  }

  // 2. 概览统计接口 GET /api/games?overview=1
  if (url.searchParams.get("overview") === "1") {
    return handleOverview(env);
  }

  // 3. 游戏列表查询 GET /api/games
  return handleList(url, env);
}

// ---------------- 概览与看板统计 ----------------
async function handleOverview(env) {
  if (hasD1(env)) {
    try {
      await ensureD1GamesSchema(env.DB);
      const statsRow = await env.DB.prepare(`
        SELECT 
          count(*) as total_games,
          sum(price_usd) as total_usd,
          sum(price_rmb) as total_rmb,
          sum(is_aaa) as aaa_count,
          sum(is_mystery) as mystery_count,
          sum(has_dlc) as dlc_count
        FROM epic_games_history
      `).first();

      const yearRows = await env.DB.prepare(`
        SELECT 
          giveaway_year as year,
          count(*) as count,
          sum(price_usd) as total_usd,
          sum(price_rmb) as total_rmb,
          sum(is_aaa) as aaa_count
        FROM epic_games_history
        GROUP BY giveaway_year
        ORDER BY giveaway_year DESC
      `).all();

      if (statsRow && statsRow.total_games > 0) {
        return json(200, {
          success: true,
          storage: "d1",
          total_games: statsRow.total_games,
          total_value_usd: Math.round((statsRow.total_usd || 0) * 100) / 100,
          total_value_rmb: Math.round(statsRow.total_rmb || 0),
          aaa_count: statsRow.aaa_count || 0,
          mystery_count: statsRow.mystery_count || 0,
          dlc_count: statsRow.dlc_count || 0,
          years: (yearRows?.results || []).map(r => ({
            year: r.year,
            count: r.count,
            total_usd: Math.round((r.total_usd || 0) * 100) / 100,
            total_rmb: Math.round(r.total_rmb || 0),
            aaa_count: r.aaa_count || 0,
          })),
        });
      }
    } catch (e) {
      console.warn("handleOverview D1 fallback:", e.message);
    }
  }

  // 静态种子数据兜底计算
  const total = GAMES_SEED.length;
  const totalUsd = GAMES_SEED.reduce((acc, g) => acc + (g.price_usd || 0), 0);
  const totalRmb = GAMES_SEED.reduce((acc, g) => acc + (g.price_rmb || 0), 0);
  const aaaCount = GAMES_SEED.filter(g => g.is_aaa === 1).length;
  const mysteryCount = GAMES_SEED.filter(g => g.is_mystery === 1).length;
  const dlcCount = GAMES_SEED.filter(g => g.has_dlc === 1).length;

  const yearMap = new Map();
  for (const g of GAMES_SEED) {
    const y = g.giveaway_year;
    if (!yearMap.has(y)) {
      yearMap.set(y, { year: y, count: 0, total_usd: 0, total_rmb: 0, aaa_count: 0 });
    }
    const it = yearMap.get(y);
    it.count++;
    it.total_usd += g.price_usd || 0;
    it.total_rmb += g.price_rmb || 0;
    if (g.is_aaa === 1) it.aaa_count++;
  }

  const years = [...yearMap.values()].sort((a, b) => b.year - a.year).map(y => ({
    ...y,
    total_usd: Math.round(y.total_usd * 100) / 100,
    total_rmb: Math.round(y.total_rmb),
  }));

  return json(200, {
    success: true,
    storage: "seed",
    total_games: total,
    total_value_usd: Math.round(totalUsd * 100) / 100,
    total_value_rmb: Math.round(totalRmb),
    aaa_count: aaaCount,
    mystery_count: mysteryCount,
    dlc_count: dlcCount,
    years,
  });
}

// ---------------- 游戏列表查询与筛选 ----------------
async function handleList(url, env) {
  const yearParam = url.searchParams.get("year") || "all";
  const tagParam = url.searchParams.get("tag") || "all";
  const searchKeyword = (url.searchParams.get("q") || "").trim().toLowerCase();
  const sortParam = url.searchParams.get("sort") || "date"; // date | price | rating
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const pageSize = Math.min(50, Math.max(1, parseInt(url.searchParams.get("pageSize") || "20", 10)));
  const offset = (page - 1) * pageSize;

  if (hasD1(env)) {
    try {
      await ensureD1GamesSchema(env.DB);
      let whereClauses = [];
      let params = [];

      if (yearParam !== "all" && /^\d{4}$/.test(yearParam)) {
        whereClauses.push("giveaway_year = ?");
        params.push(parseInt(yearParam, 10));
      }

      if (tagParam === "aaa") {
        whereClauses.push("is_aaa = 1");
      } else if (tagParam === "mystery") {
        whereClauses.push("is_mystery = 1");
      } else if (tagParam === "dlc") {
        whereClauses.push("has_dlc = 1");
      }

      if (searchKeyword) {
        whereClauses.push("(lower(title) LIKE ? OR lower(title_cn) LIKE ? OR lower(developer) LIKE ? OR lower(tags) LIKE ?)");
        const kw = `%${searchKeyword}%`;
        params.push(kw, kw, kw, kw);
      }

      const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";

      let orderSql = "ORDER BY giveaway_start DESC";
      if (sortParam === "price") {
        orderSql = "ORDER BY price_usd DESC, giveaway_start DESC";
      } else if (sortParam === "date_asc") {
        orderSql = "ORDER BY giveaway_start ASC";
      }

      const countRow = await env.DB.prepare(`SELECT count(*) as total FROM epic_games_history ${whereSql}`).bind(...params).first();
      const total = countRow?.total || 0;

      const itemsRows = await env.DB.prepare(`
        SELECT * FROM epic_games_history 
        ${whereSql} 
        ${orderSql} 
        LIMIT ? OFFSET ?
      `).bind(...params, pageSize, offset).all();

      const items = (itemsRows?.results || []).map(formatGameRow);

      return json(200, {
        success: true,
        storage: "d1",
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
        hasMore: offset + items.length < total,
        filter: { year: yearParam, tag: tagParam, q: searchKeyword, sort: sortParam },
        items,
      });
    } catch (e) {
      console.warn("handleList D1 fallback:", e.message);
    }
  }

  // 种子兜底过滤
  let filtered = [...GAMES_SEED];

  if (yearParam !== "all" && /^\d{4}$/.test(yearParam)) {
    const y = parseInt(yearParam, 10);
    filtered = filtered.filter(g => g.giveaway_year === y);
  }

  if (tagParam === "aaa") {
    filtered = filtered.filter(g => g.is_aaa === 1);
  } else if (tagParam === "mystery") {
    filtered = filtered.filter(g => g.is_mystery === 1);
  } else if (tagParam === "dlc") {
    filtered = filtered.filter(g => g.has_dlc === 1);
  }

  if (searchKeyword) {
    filtered = filtered.filter(g => {
      const matchTitle = (g.title || "").toLowerCase().includes(searchKeyword);
      const matchCn = (g.title_cn || "").toLowerCase().includes(searchKeyword);
      const matchDev = (g.developer || "").toLowerCase().includes(searchKeyword);
      const matchTags = Array.isArray(g.tags) && g.tags.some(t => t.toLowerCase().includes(searchKeyword));
      return matchTitle || matchCn || matchDev || matchTags;
    });
  }

  if (sortParam === "price") {
    filtered.sort((a, b) => (b.price_usd || 0) - (a.price_usd || 0));
  } else if (sortParam === "date_asc") {
    filtered.sort((a, b) => String(a.giveaway_start).localeCompare(String(b.giveaway_start)));
  } else {
    // 默认 date 倒序
    filtered.sort((a, b) => String(b.giveaway_start).localeCompare(String(a.giveaway_start)));
  }

  const total = filtered.length;
  const pagedItems = filtered.slice(offset, offset + pageSize).map(formatGameRow);

  return json(200, {
    success: true,
    storage: "seed",
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
    hasMore: offset + pagedItems.length < total,
    filter: { year: yearParam, tag: tagParam, q: searchKeyword, sort: sortParam },
    items: pagedItems,
  });
}

function formatGameRow(g) {
  let tags = g.tags;
  if (typeof tags === "string") {
    try { tags = JSON.parse(tags); } catch { tags = []; }
  }
  return {
    id: g.id,
    title: g.title,
    title_cn: g.title_cn || g.title,
    developer: g.developer || "",
    publisher: g.publisher || "",
    price_usd: g.price_usd || 0,
    price_rmb: g.price_rmb || 0,
    giveaway_start: g.giveaway_start,
    giveaway_end: g.giveaway_end,
    giveaway_year: g.giveaway_year,
    is_aaa: g.is_aaa === 1,
    is_mystery: g.is_mystery === 1,
    has_dlc: g.has_dlc === 1,
    tags: Array.isArray(tags) ? tags : [],
    rating: g.rating || "",
    cover_url: g.cover_url || "",
    store_url: g.store_url || "https://store.epicgames.com/",
    brief: g.brief || "",
  };
}

// ---------------- 批量安全落库 ----------------
async function handleBatchInsert(request, env) {
  if (!hasD1(env)) {
    return json(503, { error: "Cloudflare D1 is not configured" });
  }

  try {
    const body = await request.json();
    const games = Array.isArray(body?.games) ? body.games : [];
    if (!games.length) {
      return json(400, { error: "No games provided in payload" });
    }

    await ensureD1GamesSchema(env.DB);
    let inserted = 0;
    const chunkSize = 25;

    for (let i = 0; i < games.length; i += chunkSize) {
      const chunk = games.slice(i, i + chunkSize);
      const stmts = chunk.map(g => {
        const tagsJson = Array.isArray(g.tags) ? JSON.stringify(g.tags) : (typeof g.tags === "string" ? g.tags : "[]");
        return env.DB.prepare(`
          INSERT INTO epic_games_history (
            id, title, title_cn, developer, publisher, 
            price_usd, price_rmb, giveaway_start, giveaway_end, giveaway_year, 
            is_aaa, is_mystery, has_dlc, tags, rating, 
            cover_url, store_url, brief, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            title_cn = excluded.title_cn,
            price_usd = excluded.price_usd,
            price_rmb = excluded.price_rmb,
            giveaway_start = excluded.giveaway_start,
            giveaway_end = excluded.giveaway_end,
            giveaway_year = excluded.giveaway_year,
            is_aaa = excluded.is_aaa,
            is_mystery = excluded.is_mystery,
            has_dlc = excluded.has_dlc,
            tags = excluded.tags,
            rating = excluded.rating,
            cover_url = excluded.cover_url,
            store_url = excluded.store_url,
            brief = excluded.brief
        `).bind(
          g.id,
          g.title,
          g.title_cn || g.title,
          g.developer || "",
          g.publisher || "",
          g.price_usd || 0,
          g.price_rmb || 0,
          g.giveaway_start,
          g.giveaway_end,
          g.giveaway_year || parseInt(String(g.giveaway_start).slice(0, 4), 10) || 2026,
          g.is_aaa ? 1 : 0,
          g.is_mystery ? 1 : 0,
          g.has_dlc ? 1 : 0,
          tagsJson,
          g.rating || "",
          g.cover_url || "",
          g.store_url || "https://store.epicgames.com/",
          g.brief || "",
          Date.now()
        );
      });

      await env.DB.batch(stmts);
      inserted += chunk.length;
    }

    return json(200, { success: true, inserted, total_in_payload: games.length });
  } catch (e) {
    console.error("handleBatchInsert error:", e);
    return json(500, { error: e.message });
  }
}
