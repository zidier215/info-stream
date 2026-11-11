// functions/api/opensource.js
// ---------------------------------------------------------------------------
// 开源替代 & 大模型降维重构商业软件全景图谱数据 API
// 支持全局统计看板、多维分类筛选、关键词检索与边缘高速持久化缓存
// ---------------------------------------------------------------------------

import { OPENSOURCE_SEED, CATEGORIES } from "../_lib/opensource_seed.js";

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
  const id = url.searchParams.get("id");
  const category = url.searchParams.get("category") || "all";
  const type = url.searchParams.get("type") || "all"; // all, oss, ai, hybrid
  const difficulty = url.searchParams.get("difficulty") || "all";
  const q = (url.searchParams.get("q") || "").trim().toLowerCase();

  // 1. 若请求单项详情
  if (id) {
    const item = OPENSOURCE_SEED.find((it) => it.id === id);
    if (!item) {
      return new Response(JSON.stringify({ success: false, error: "Not Found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ success: true, item }), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=1800, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  }

  // 2. 统计概览
  if (overview) {
    let totalAnnualSavings = 0;
    let aiDisruptedCount = 0;
    let ossCount = 0;
    let hybridCount = 0;
    const catCounts = {};

    for (const it of OPENSOURCE_SEED) {
      totalAnnualSavings += it.estimated_yearly_saving_usd || 0;
      if (it.llm_disruption?.is_disrupted) aiDisruptedCount++;
      if (it.disruption_type === "oss") ossCount++;
      else if (it.disruption_type === "hybrid") hybridCount++;

      catCounts[it.category] = (catCounts[it.category] || 0) + 1;
    }

    return new Response(
      JSON.stringify({
        success: true,
        stats: {
          total: OPENSOURCE_SEED.length,
          total_annual_saving_usd: totalAnnualSavings,
          average_yearly_saving: Math.round(totalAnnualSavings / OPENSOURCE_SEED.length),
          ai_disrupted_count: aiDisruptedCount,
          oss_count: ossCount,
          hybrid_count: hybridCount,
          ai_disruption_rate: `${Math.round((aiDisruptedCount / OPENSOURCE_SEED.length) * 100)}%`,
          categories: CATEGORIES.map((c) => ({
            ...c,
            count: c.id === "all" ? OPENSOURCE_SEED.length : (catCounts[c.id] || 0),
          })),
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

  // 3. 筛选列表
  let items = OPENSOURCE_SEED;

  if (category && category !== "all") {
    items = items.filter((it) => it.category === category);
  }

  if (type && type !== "all") {
    items = items.filter((it) => {
      if (type === "ai") return it.disruption_type === "ai" || it.disruption_type === "hybrid";
      if (type === "oss") return it.disruption_type === "oss" || it.disruption_type === "hybrid";
      return it.disruption_type === type;
    });
  }

  if (difficulty && difficulty !== "all") {
    items = items.filter((it) => it.difficulty === difficulty);
  }

  if (q) {
    items = items.filter((it) => {
      const matchName = (it.name_cn || "").toLowerCase().includes(q);
      const matchTarget = (it.target_software || "").toLowerCase().includes(q);
      const matchVendor = (it.vendor || "").toLowerCase().includes(q);
      const matchThesis = (it.llm_disruption?.thesis || "").toLowerCase().includes(q);
      const matchAlt = (it.alternatives || []).some(
        (a) => (a.name || "").toLowerCase().includes(q) || (a.desc || "").toLowerCase().includes(q) || (a.tech_stack || "").toLowerCase().includes(q)
      );
      return matchName || matchTarget || matchVendor || matchThesis || matchAlt;
    });
  }

  return new Response(
    JSON.stringify({
      success: true,
      total: items.length,
      items,
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
