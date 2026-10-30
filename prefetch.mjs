// prefetch.mjs —— 离线/构建时预生成静态数据快照（方案2）
// ---------------------------------------------------------------------------
// 作用：
//   在构建或定时任务时执行，抓取各核心 tab 的数据并落盘到 data/feed-<tab>.json。
//   前端直接通过 CDN 访问这些纯静态快照，实现首屏 0 毫秒冷启动与故障兜底。
// ---------------------------------------------------------------------------

import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { onRequest as feed } from "./functions/api/feed.js";

const ROOT = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(ROOT, "data");

if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

const TABS = [
  // 主站
  { host: "myinfostream.com", tab: "brief", lang: "zh" },
  { host: "myinfostream.com", tab: "world", lang: "zh" },
  { host: "myinfostream.com", tab: "ai", lang: "zh" },
  { host: "myinfostream.com", tab: "fun", lang: "zh" },
  // AI 站
  { host: "ai.myinfostream.com", tab: "all", lang: "zh" },
  { host: "ai.myinfostream.com", tab: "models", lang: "zh" },
  { host: "ai.myinfostream.com", tab: "chips", lang: "zh" },
  { host: "ai.myinfostream.com", tab: "biz", lang: "zh" },
  { host: "ai.myinfostream.com", tab: "papers", lang: "zh" },
  // 国际新闻站
  { host: "news.myinfostream.com", tab: "top", lang: "en" },
  { host: "news.myinfostream.com", tab: "biz", lang: "en" },
  { host: "news.myinfostream.com", tab: "tech", lang: "en" },
  { host: "news.myinfostream.com", tab: "region", lang: "en" },
  // 游戏站
  { host: "game.myinfostream.com", tab: "live", lang: "zh" },
  { host: "game.myinfostream.com", tab: "soon", lang: "zh" },
  { host: "game.myinfostream.com", tab: "perma", lang: "zh" },
  // 热搜站
  { host: "hot.myinfostream.com", tab: "weibo", lang: "zh" },
  { host: "hot.myinfostream.com", tab: "baidu", lang: "zh" },
  { host: "hot.myinfostream.com", tab: "bilibili", lang: "zh" },
  { host: "hot.myinfostream.com", tab: "douyin", lang: "zh" },
];

console.log("==> 开始预生成静态数据快照 (方案2)...");

for (const item of TABS) {
  const filePath = join(DATA_DIR, `feed-${item.tab}.json`);
  const t0 = Date.now();
  try {
    const req = new Request(`https://${item.host}/api/feed?tab=${item.tab}&lang=${item.lang}`, {
      headers: { host: item.host, origin: `https://${item.host}` },
    });
    const res = await Promise.race([
      feed({ request: req, env: {} }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 14000)),
    ]);
    const body = await res.json();
    if (body && Array.isArray(body.items) && body.items.length > 0) {
      writeFileSync(filePath, JSON.stringify(body, null, 2), "utf8");
      console.log(`  ✓ 生成 feed-${item.tab}.json (${body.items.length}条, ${Date.now() - t0}ms)`);
      continue;
    }
  } catch (err) {
    console.warn(`  ⚠️ 抓取 feed-${item.tab} 失败 (${err.message})`);
  }

  // 兜底策略：若抓取失败但本地已有文件则保留，否则生成基础快照
  if (!existsSync(filePath)) {
    const fallback = {
      ok: true,
      host: item.host,
      site: "main",
      tab: item.tab,
      updated: Date.now(),
      count: 0,
      stale: true,
      items: [],
    };
    writeFileSync(filePath, JSON.stringify(fallback, null, 2), "utf8");
    console.log(`  ✓ 兜底生成空快照 feed-${item.tab}.json`);
  } else {
    console.log(`  ℹ️ 保留已有快照 feed-${item.tab}.json`);
  }
}

console.log("==> 静态快照预生成完成 -> data/\n");
