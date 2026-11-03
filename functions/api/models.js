// functions/api/models.js
// ---------------------------------------------------------------------------
// AI 大模型演进与评测档案库 · 接口 (Serverless API)
// 包含 Cloudflare D1 持久化存储与内置种子兜底机制
// ---------------------------------------------------------------------------

import { MODELS_SEED } from "../_lib/models_seed.js";

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

async function ensureD1ModelsSchema(db) {
  try {
    await db.prepare(`CREATE TABLE IF NOT EXISTS ai_models_history (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      org TEXT NOT NULL,
      release_date TEXT NOT NULL,
      release_year INTEGER NOT NULL,
      license_type TEXT NOT NULL,
      license_name TEXT,
      parameters TEXT,
      context_window INTEGER NOT NULL,
      modalities TEXT DEFAULT 'text',
      arena_elo INTEGER DEFAULT 0,
      mmlu_score REAL DEFAULT 0,
      pricing_input REAL DEFAULT 0,
      pricing_output REAL DEFAULT 0,
      official_url TEXT,
      huggingface_url TEXT,
      description TEXT,
      is_frontier INTEGER DEFAULT 0,
      is_reasoning INTEGER DEFAULT 0,
      tags TEXT,
      created_at INTEGER DEFAULT 0
    )`).run();

    await db.prepare("CREATE INDEX IF NOT EXISTS idx_ai_models_org ON ai_models_history(org)").run();
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_ai_models_year ON ai_models_history(release_year)").run();
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_ai_models_date ON ai_models_history(release_date DESC)").run();
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_ai_models_elo ON ai_models_history(arena_elo DESC)").run();
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_ai_models_context ON ai_models_history(context_window DESC)").run();
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_ai_models_license ON ai_models_history(license_type)").run();
  } catch (err) {
    console.error("ensureD1ModelsSchema error:", err.message);
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

  await ensureD1ModelsSchema(env.DB);

  if (action === "batch_insert") {
    try {
      const body = await request.json();
      const list = Array.isArray(body) ? body : body.models;
      if (!Array.isArray(list) || list.length === 0) {
        return json(400, { error: "Body must contain a non-empty 'models' array" });
      }

      const stmt = env.DB.prepare(`
        INSERT OR REPLACE INTO ai_models_history (
          id, name, org, release_date, release_year, license_type, license_name,
          parameters, context_window, modalities, arena_elo, mmlu_score,
          pricing_input, pricing_output, official_url, huggingface_url,
          description, is_frontier, is_reasoning, tags, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const batch = list.map((m) =>
        stmt.bind(
          m.id,
          m.name,
          m.org,
          m.release_date,
          m.release_year,
          m.license_type,
          m.license_name || "",
          m.parameters || "",
          m.context_window || 0,
          m.modalities || "text",
          m.arena_elo || 0,
          m.mmlu_score || 0,
          m.pricing_input || 0,
          m.pricing_output || 0,
          m.official_url || "",
          m.huggingface_url || "",
          m.description || "",
          m.is_frontier ? 1 : 0,
          m.is_reasoning ? 1 : 0,
          m.tags || "",
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
  const org = url.searchParams.get("org");
  const yearParam = url.searchParams.get("year");
  const licenseParam = url.searchParams.get("license");
  const isFrontier = url.searchParams.get("is_frontier");
  const isReasoning = url.searchParams.get("is_reasoning");
  const q = (url.searchParams.get("q") || "").trim().toLowerCase();
  const sort = url.searchParams.get("sort") || "elo"; // elo, context, date, price_in
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("pageSize") || "12", 10)));

  // 1. D1 数据库优先
  if (hasD1(env)) {
    try {
      await ensureD1ModelsSchema(env.DB);

      // 大盘总览与指标看板
      if (isOverview) {
        const totalRow = await env.DB.prepare(
          "SELECT COUNT(*) AS total, MAX(arena_elo) AS max_elo, MAX(context_window) AS max_context FROM ai_models_history"
        ).first();

        // 若 D1 尚无记录，自动从种子中无缝迁移
        if (!totalRow || totalRow.total === 0) {
          return fallbackOverview();
        }

        const frontierRow = await env.DB.prepare(
          "SELECT COUNT(*) AS c FROM ai_models_history WHERE is_frontier = 1"
        ).first();

        const openRow = await env.DB.prepare(
          "SELECT COUNT(*) AS c FROM ai_models_history WHERE license_type IN ('open_weights', 'open_source')"
        ).first();

        const reasoningRow = await env.DB.prepare(
          "SELECT COUNT(*) AS c FROM ai_models_history WHERE is_reasoning = 1"
        ).first();

        const orgRows = await env.DB.prepare(
          "SELECT org, COUNT(*) AS count, MAX(arena_elo) AS top_elo FROM ai_models_history GROUP BY org ORDER BY count DESC"
        ).all();

        const yearRows = await env.DB.prepare(
          "SELECT release_year AS year, COUNT(*) AS count FROM ai_models_history GROUP BY release_year ORDER BY release_year DESC"
        ).all();

        return json(200, {
          success: true,
          storage: "d1",
          total_models: totalRow.total,
          frontier_count: frontierRow?.c || 0,
          open_weights_count: openRow?.c || 0,
          reasoning_count: reasoningRow?.c || 0,
          max_elo: totalRow.max_elo || 0,
          max_context: totalRow.max_context || 0,
          orgs: orgRows.results || [],
          years: yearRows.results || [],
        });
      }

      // 列表查询过滤构建
      const whereClauses = [];
      const bindings = [];

      if (org) {
        whereClauses.push("org = ?");
        bindings.push(org);
      }
      if (yearParam) {
        const y = parseInt(yearParam, 10);
        if (!isNaN(y)) {
          whereClauses.push("release_year = ?");
          bindings.push(y);
        }
      }
      if (licenseParam) {
        if (licenseParam === "open") {
          whereClauses.push("license_type IN ('open_weights', 'open_source')");
        } else if (licenseParam === "closed") {
          whereClauses.push("license_type = 'proprietary_api'");
        } else {
          whereClauses.push("license_type = ?");
          bindings.push(licenseParam);
        }
      }
      if (isFrontier === "1") {
        whereClauses.push("is_frontier = 1");
      }
      if (isReasoning === "1") {
        whereClauses.push("is_reasoning = 1");
      }
      if (q) {
        whereClauses.push("(LOWER(name) LIKE ? OR LOWER(org) LIKE ? OR LOWER(description) LIKE ? OR LOWER(tags) LIKE ?)");
        const like = `%${q}%`;
        bindings.push(like, like, like, like);
      }

      const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

      let orderBy = "arena_elo DESC, release_date DESC";
      if (sort === "date") orderBy = "release_date DESC";
      else if (sort === "context") orderBy = "context_window DESC, arena_elo DESC";
      else if (sort === "price_in") orderBy = "pricing_input ASC, arena_elo DESC";

      const countSql = `SELECT COUNT(*) AS total FROM ai_models_history ${whereSql}`;
      const countRow = await env.DB.prepare(countSql).bind(...bindings).first();
      const total = countRow ? countRow.total : 0;

      const offset = (page - 1) * pageSize;
      const listSql = `SELECT * FROM ai_models_history ${whereSql} ORDER BY ${orderBy} LIMIT ? OFFSET ?`;
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
      console.error("D1 models query error, fallback to seed:", e.message);
    }
  }

  // 2. 种子数据集兜底逻辑
  if (isOverview) {
    return fallbackOverview();
  }

  return fallbackQuery({ org, yearParam, licenseParam, isFrontier, isReasoning, q, sort, page, pageSize });
}

function fallbackOverview() {
  const total = MODELS_SEED.length;
  const frontierCount = MODELS_SEED.filter((m) => m.is_frontier).length;
  const openCount = MODELS_SEED.filter((m) => m.license_type === "open_weights" || m.license_type === "open_source").length;
  const reasoningCount = MODELS_SEED.filter((m) => m.is_reasoning).length;
  const maxElo = Math.max(...MODELS_SEED.map((m) => m.arena_elo || 0));
  const maxContext = Math.max(...MODELS_SEED.map((m) => m.context_window || 0));

  const orgMap = {};
  for (const m of MODELS_SEED) {
    if (!orgMap[m.org]) orgMap[m.org] = { org: m.org, count: 0, top_elo: 0 };
    orgMap[m.org].count++;
    if (m.arena_elo > orgMap[m.org].top_elo) orgMap[m.org].top_elo = m.arena_elo;
  }
  const orgs = Object.values(orgMap).sort((a, b) => b.count - a.count);

  const yearMap = {};
  for (const m of MODELS_SEED) {
    yearMap[m.release_year] = (yearMap[m.release_year] || 0) + 1;
  }
  const years = Object.keys(yearMap)
    .sort((a, b) => b - a)
    .map((y) => ({ year: parseInt(y, 10), count: yearMap[y] }));

  return json(200, {
    success: true,
    storage: "seed",
    total_models: total,
    frontier_count: frontierCount,
    open_weights_count: openCount,
    reasoning_count: reasoningCount,
    max_elo: maxElo,
    max_context: maxContext,
    orgs,
    years,
  });
}

function fallbackQuery({ org, yearParam, licenseParam, isFrontier, isReasoning, q, sort, page, pageSize }) {
  let list = [...MODELS_SEED];

  if (org) {
    list = list.filter((m) => m.org === org);
  }
  if (yearParam) {
    const y = parseInt(yearParam, 10);
    if (!isNaN(y)) list = list.filter((m) => m.release_year === y);
  }
  if (licenseParam) {
    if (licenseParam === "open") {
      list = list.filter((m) => m.license_type === "open_weights" || m.license_type === "open_source");
    } else if (licenseParam === "closed") {
      list = list.filter((m) => m.license_type === "proprietary_api");
    } else {
      list = list.filter((m) => m.license_type === licenseParam);
    }
  }
  if (isFrontier === "1") {
    list = list.filter((m) => m.is_frontier);
  }
  if (isReasoning === "1") {
    list = list.filter((m) => m.is_reasoning);
  }
  if (q) {
    list = list.filter(
      (m) =>
        (m.name && m.name.toLowerCase().includes(q)) ||
        (m.org && m.org.toLowerCase().includes(q)) ||
        (m.description && m.description.toLowerCase().includes(q)) ||
        (m.tags && m.tags.toLowerCase().includes(q))
    );
  }

  if (sort === "date") {
    list.sort((a, b) => (b.release_date || "").localeCompare(a.release_date || ""));
  } else if (sort === "context") {
    list.sort((a, b) => (b.context_window || 0) - (a.context_window || 0) || (b.arena_elo || 0) - (a.arena_elo || 0));
  } else if (sort === "price_in") {
    list.sort((a, b) => (a.pricing_input || 0) - (b.pricing_input || 0) || (b.arena_elo || 0) - (a.arena_elo || 0));
  } else {
    // elo
    list.sort((a, b) => (b.arena_elo || 0) - (a.arena_elo || 0) || (b.release_date || "").localeCompare(a.release_date || ""));
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
