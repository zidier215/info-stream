// functions/api/fire.js
// ---------------------------------------------------------------------------
// 全球指数化投资与经典资产配置模型数据接口 (/api/fire)
// ---------------------------------------------------------------------------

import {
  PORTFOLIO_MODELS,
  ETF_TAX_EFFICIENCY,
  FIRE_METHODOLOGY
} from "../_lib/fire_seed.js";

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  // 跨域预检
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (request.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const overview = url.searchParams.get("overview") === "1";
  const tab = url.searchParams.get("tab") || "all";
  const q = (url.searchParams.get("q") || "").trim().toLowerCase();

  if (overview) {
    return new Response(
      JSON.stringify({
        success: true,
        stats: {
          models_count: PORTFOLIO_MODELS.length,
          etfs_count: ETF_TAX_EFFICIENCY.length,
          rules_count: FIRE_METHODOLOGY.length,
          total_items: PORTFOLIO_MODELS.length + ETF_TAX_EFFICIENCY.length + FIRE_METHODOLOGY.length,
        },
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "public, max-age=1800, s-maxage=86400, stale-while-revalidate=604800",
        },
      }
    );
  }

  let result = {
    models: PORTFOLIO_MODELS,
    etfs: ETF_TAX_EFFICIENCY,
    methodology: FIRE_METHODOLOGY,
  };

  if (tab !== "all") {
    if (tab === "models") result = { models: PORTFOLIO_MODELS };
    else if (tab === "etfs") result = { etfs: ETF_TAX_EFFICIENCY };
    else if (tab === "methodology") result = { methodology: FIRE_METHODOLOGY };
  }

  if (q) {
    const filterList = (list, keys) =>
      list.filter((it) =>
        keys.some((k) => (String(it[k] || "")).toLowerCase().includes(q))
      );

    if (result.models) result.models = filterList(result.models, ["name", "name_en", "author", "thesis", "best_for"]);
    if (result.etfs) result.etfs = filterList(result.etfs, ["category", "us_etf", "ucits_etf", "ucits_advantage"]);
    if (result.methodology) result.methodology = filterList(result.methodology, ["rule", "desc"]);
  }

  return new Response(
    JSON.stringify({
      success: true,
      data: result,
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=1800, s-maxage=86400, stale-while-revalidate=604800",
      },
    }
  );
}

