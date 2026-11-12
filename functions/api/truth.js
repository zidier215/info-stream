// functions/api/truth.js
// ---------------------------------------------------------------------------
// 认知求真与毒鸡汤避雷通鉴数据接口 (/api/truth)
// 支持：按区域(region)、按定性(verdict)、按语言(lang)、关键词(q)、毒度排序(sort)
// ---------------------------------------------------------------------------

import {
  TRUTH_I18N,
  VERDICTS,
  REGIONS,
  TRUTH_CASES
} from "../_lib/truth_seed.js";

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
  const lang = url.searchParams.get("lang") || "zh";
  const region = (url.searchParams.get("region") || "all").toLowerCase();
  const verdict = (url.searchParams.get("verdict") || "all").toLowerCase();
  const sort = (url.searchParams.get("sort") || "id").toLowerCase();
  const q = (url.searchParams.get("q") || "").trim().toLowerCase();

  // 概览统计
  if (overview) {
    const regionCounts = {};
    const verdictCounts = {};
    TRUTH_CASES.forEach((c) => {
      regionCounts[c.region] = (regionCounts[c.region] || 0) + 1;
      verdictCounts[c.verdict] = (verdictCounts[c.verdict] || 0) + 1;
    });

    return new Response(
      JSON.stringify({
        success: true,
        stats: {
          total_cases: TRUTH_CASES.length,
          supported_languages: ["zh", "zh-Hant", "en", "ja", "de"],
          supported_regions: REGIONS.map((r) => r.id),
          verdicts: VERDICTS.map((v) => v.id),
          region_counts: regionCounts,
          verdict_counts: verdictCounts,
        },
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=1800, s-maxage=86400, stale-while-revalidate=604800",
        },
      }
    );
  }

  // 筛选案例
  let filtered = TRUTH_CASES.filter((c) => {
    if (region !== "all" && c.region !== region) return false;
    if (verdict !== "all" && c.verdict !== verdict) return false;
    if (q) {
      const matchZh = (c.titles?.zh || "").toLowerCase().includes(q) || (c.quotes?.zh || "").toLowerCase().includes(q);
      const matchEn = (c.titles?.en || "").toLowerCase().includes(q) || (c.quotes?.en || "").toLowerCase().includes(q);
      const matchId = c.id.toLowerCase().includes(q) || c.no.toLowerCase().includes(q);
      if (!matchZh && !matchEn && !matchId) return false;
    }
    return true;
  });

  // 排序
  if (sort === "toxicity") {
    filtered.sort((a, b) => b.toxicity - a.toxicity);
  } else {
    // 默认按 ID / 编号顺序
    filtered.sort((a, b) => a.no.localeCompare(b.no));
  }

  const i18nPack = TRUTH_I18N[lang] || TRUTH_I18N.zh;

  return new Response(
    JSON.stringify({
      success: true,
      lang: lang,
      region: region,
      verdict: verdict,
      sort: sort,
      total: filtered.length,
      i18n: i18nPack,
      cases: filtered,
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=1800, s-maxage=86400, stale-while-revalidate=604800",
      },
    }
  );
}

