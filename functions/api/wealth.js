// functions/api/wealth.js
// ---------------------------------------------------------------------------
// 人类商业变现与财富杠杆演进通鉴 API
// 支持按时代纪元(era)、底层杠杆(leverage)、普通人友好(solo)、关键词(q)与排序查询
// ---------------------------------------------------------------------------

import { WEALTH_SEED, WEALTH_ERAS, WEALTH_LEVERAGES } from "../_lib/wealth_seed.js";

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  const isOverview = url.searchParams.get("overview") === "1";
  if (isOverview) {
    const eraCounts = WEALTH_ERAS.map((e) => ({
      ...e,
      count: WEALTH_SEED.filter((x) => x.era === e.id).length,
    }));
    const leverageCounts = WEALTH_LEVERAGES.map((l) => ({
      ...l,
      count: WEALTH_SEED.filter((x) => x.leverage === l.id).length,
    }));
    return new Response(
      JSON.stringify({
        success: true,
        total_methods: WEALTH_SEED.length,
        solo_count: WEALTH_SEED.filter((x) => x.solo_friendly).length,
        max_scalability_count: WEALTH_SEED.filter((x) => x.scalability === 5).length,
        eras: eraCounts,
        leverages: leverageCounts,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "public, max-age=300, s-maxage=600",
        },
      }
    );
  }

  const era = (url.searchParams.get("era") || "").trim();
  const leverage = (url.searchParams.get("leverage") || "").trim();
  const solo = url.searchParams.get("solo") === "1";
  const q = (url.searchParams.get("q") || "").trim().toLowerCase();
  const sort = (url.searchParams.get("sort") || "era_desc").trim();

  let list = [...WEALTH_SEED];
  if (era) list = list.filter((x) => x.era === era);
  if (leverage) list = list.filter((x) => x.leverage === leverage);
  if (solo) list = list.filter((x) => x.solo_friendly === true);
  if (q) {
    list = list.filter(
      (x) =>
        x.title.toLowerCase().includes(q) ||
        x.essence.toLowerCase().includes(q) ||
        x.formula.toLowerCase().includes(q) ||
        x.examples.some((ex) => ex.toLowerCase().includes(q))
    );
  }

  const eraOrder = { recent3: 4, decade: 3, century: 2, ancient: 1 };
  if (sort === "era_desc") {
    list.sort((a, b) => (eraOrder[b.era] || 0) - (eraOrder[a.era] || 0) || b.scalability - a.scalability);
  } else if (sort === "era_asc") {
    list.sort((a, b) => (eraOrder[a.era] || 0) - (eraOrder[b.era] || 0) || b.scalability - a.scalability);
  } else if (sort === "scale") {
    list.sort((a, b) => b.scalability - a.scalability || (eraOrder[b.era] || 0) - (eraOrder[a.era] || 0));
  }

  return new Response(
    JSON.stringify({
      success: true,
      total: list.length,
      items: list,
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=300, s-maxage=600",
      },
    }
  );
}
