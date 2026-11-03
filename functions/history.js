// functions/history.js
// ---------------------------------------------------------------------------
// /history 历史落地页智能调度：
// - hot.myinfostream.com 调度给 trends.js (互联网破圈大事件历史通鉴)
// - game.myinfostream.com 调度给 games.js (Epic 喜加一历史总账本)
// ---------------------------------------------------------------------------

import { resolveHost } from "./_lib/hosts.js";
import { onRequest as onGamesRequest } from "./games.js";
import { onRequest as onTrendsRequest } from "./trends.js";

export async function onRequest(context) {
  const { request } = context;
  const { cfg } = resolveHost(request);
  if (cfg && cfg.key === "hot") {
    return onTrendsRequest(context);
  }
  return onGamesRequest(context);
}
