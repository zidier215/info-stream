// functions/api/prompt.js
// ---------------------------------------------------------------------------
// 高阶提示词模式与自主 Agent 架构通鉴数据接口 (/api/prompt)
// ---------------------------------------------------------------------------

import {
  PROMPT_PATTERNS,
  AGENT_WORKFLOWS,
  SYSTEM_PROMPTS
} from "../_lib/prompt_seed.js";

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
          patterns_count: PROMPT_PATTERNS.length,
          agents_count: AGENT_WORKFLOWS.length,
          prompts_count: SYSTEM_PROMPTS.length,
          total_items: PROMPT_PATTERNS.length + AGENT_WORKFLOWS.length + SYSTEM_PROMPTS.length,
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
    patterns: PROMPT_PATTERNS,
    agents: AGENT_WORKFLOWS,
    prompts: SYSTEM_PROMPTS,
  };

  if (tab !== "all") {
    if (tab === "patterns") result = { patterns: PROMPT_PATTERNS };
    else if (tab === "agents") result = { agents: AGENT_WORKFLOWS };
    else if (tab === "prompts") result = { prompts: SYSTEM_PROMPTS };
  }

  if (q) {
    const filterList = (list, keys) =>
      list.filter((it) =>
        keys.some((k) => (String(it[k] || "")).toLowerCase().includes(q))
      );

    if (result.patterns) result.patterns = filterList(result.patterns, ["name", "name_en", "paper", "description", "best_for"]);
    if (result.agents) result.agents = filterList(result.agents, ["name", "name_en", "desc", "pros", "best_stack"]);
    if (result.prompts) result.prompts = filterList(result.prompts, ["title", "title_en", "prompt", "best_match"]);
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

