// functions/api/ship.js
// ---------------------------------------------------------------------------
// 出海造筏与一人公司出海全景数据接口 (/api/ship)
// ---------------------------------------------------------------------------

import {
  PAYMENTS_DATA,
  INCORPORATION_DATA,
  DISTRIBUTION_DATA,
  STACK_DATA,
  SHIP_RULES
} from "../_lib/ship_seed.js";

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
    return new Response(JSON.stringify({ success: false, error: "Method Not Allowed" }), {
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
          payments_count: PAYMENTS_DATA.length,
          incorporation_count: INCORPORATION_DATA.length,
          distribution_count: DISTRIBUTION_DATA.length,
          stack_count: STACK_DATA.length,
          rules_count: SHIP_RULES.length,
          total_items: PAYMENTS_DATA.length + INCORPORATION_DATA.length + DISTRIBUTION_DATA.length + STACK_DATA.length,
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
    payments: PAYMENTS_DATA,
    incorporation: INCORPORATION_DATA,
    distribution: DISTRIBUTION_DATA,
    stack: STACK_DATA,
    rules: SHIP_RULES,
  };

  if (tab !== "all") {
    if (tab === "payments") result = { payments: PAYMENTS_DATA };
    else if (tab === "incorporation") result = { incorporation: INCORPORATION_DATA };
    else if (tab === "distribution") result = { distribution: DISTRIBUTION_DATA };
    else if (tab === "stack") result = { stack: STACK_DATA };
    else if (tab === "rules") result = { rules: SHIP_RULES };
  }

  if (q) {
    const filterList = (list, keys) =>
      list.filter((it) =>
        keys.some((k) => (String(it[k] || "")).toLowerCase().includes(q))
      );

    if (result.payments) result.payments = filterList(result.payments, ["name", "type", "best_for", "verdict"]);
    if (result.incorporation) result.incorporation = filterList(result.incorporation, ["region", "summary", "best_for"]);
    if (result.distribution) result.distribution = filterList(result.distribution, ["name", "tactics", "mistakes"]);
    if (result.stack) result.stack = filterList(result.stack, ["category", "chosen", "advantage"]);
    if (result.rules) result.rules = filterList(result.rules, ["title", "desc"]);
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

