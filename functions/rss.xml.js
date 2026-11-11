// functions/rss.xml.js
// ---------------------------------------------------------------------------
// 别名重定向：/rss.xml 转发至 feed.xml.js 处理
// ---------------------------------------------------------------------------
import { onRequest as feedRequest } from "./feed.xml.js";

export async function onRequest(context) {
  return feedRequest(context);
}

