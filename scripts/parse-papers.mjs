// scripts/parse-papers.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const html = readFileSync(new URL("./raw_papers.html", import.meta.url), "utf8");

const entryRegex = /<article class="entry" data-ts="(\d+)">([\s\S]*?)<\/article>/g;
let m;
const papers = [];

while ((m = entryRegex.exec(html)) !== null) {
  const ts = parseInt(m[1], 10);
  const block = m[2];

  const idxM = block.match(/<span class="idx">(\d+)<\/span>/);
  const idx = idxM ? idxM[1] : "";

  const badgeM = block.match(/<span class="badge\s+b-([^"]+)">([^<]+)<\/span>/);
  const badgeType = badgeM ? badgeM[1] : "media";
  const source = badgeM ? badgeM[2].trim() : "Unknown";

  const isStarred = block.includes('class="star"');

  const titleM = block.match(/<h2 class="ctitle"><a href="([^"]+)"[^>]*>([\s\S]*?)<\/a><\/h2>/);
  const url = titleM ? titleM[1] : "";
  const title = titleM ? titleM[2].replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').trim() : "";

  const origM = block.match(/<p class="orig"[^>]*>([\s\S]*?)<\/p>/);
  const origTitle = origM ? origM[1].replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').trim() : "";

  const csumM = block.match(/<p class="csum">([\s\S]*?)<\/p>/);
  const summary = csumM ? csumM[1].replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').trim() : "";

  const stampM = block.match(/<span class="stamp">([^<]+)<\/span>/);
  const stamp = stampM ? stampM[1].trim() : "";

  // 派生发布日期 YYYY-MM-DD
  const d = new Date(ts);
  // 北京时间 UTC+8
  const bj = new Date(ts + 8 * 3600 * 1000);
  const pubDate = bj.toISOString().slice(0, 10);

  const hashId = "paper_" + createHash("md5").update(url || title).digest("hex").slice(0, 12);

  papers.push({
    id: hashId,
    idx: parseInt(idx, 10) || (papers.length + 1),
    title,
    orig_title: origTitle,
    url,
    summary,
    source,
    badge_type: badgeType,
    is_starred: isStarred ? 1 : 0,
    pub_date: pubDate,
    stamp,
    ts,
  });
}

console.log(`✓ 成功解析 ${papers.length} 篇论文条目`);
writeFileSync(new URL("../data/papers-seed.json", import.meta.url), JSON.stringify(papers, null, 2), "utf8");

// 生成 SQLite / Cloudflare D1 建表语句和初始化 SQL
let sql = `-- Cloudflare D1 Schema for AI Papers (AI 论文档案与持久化存储)
CREATE TABLE IF NOT EXISTS ai_papers (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  orig_title TEXT,
  url TEXT NOT NULL UNIQUE,
  summary TEXT,
  source TEXT NOT NULL,
  badge_type TEXT DEFAULT 'media',
  is_starred INTEGER DEFAULT 0,
  pub_date TEXT NOT NULL,
  ts INTEGER NOT NULL,
  created_at INTEGER DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_ai_papers_pub_date ON ai_papers(pub_date);
CREATE INDEX IF NOT EXISTS idx_ai_papers_ts ON ai_papers(ts DESC);
CREATE INDEX IF NOT EXISTS idx_ai_papers_starred ON ai_papers(is_starred);

-- 初始 50 篇高质量精选论文种子数据 (Seed Data)
`;

for (const p of papers) {
  const esc = (s) => (s ? `'${s.replace(/'/g, "''")}'` : "NULL");
  sql += `INSERT OR IGNORE INTO ai_papers (id, title, orig_title, url, summary, source, badge_type, is_starred, pub_date, ts) VALUES (${esc(p.id)}, ${esc(p.title)}, ${esc(p.orig_title)}, ${esc(p.url)}, ${esc(p.summary)}, ${esc(p.source)}, ${esc(p.badge_type)}, ${p.is_starred}, ${esc(p.pub_date)}, ${p.ts});\n`;
}

writeFileSync(new URL("../data/schema.sql", import.meta.url), sql, "utf8");
console.log(`✓ 生成 data/papers-seed.json 与 data/schema.sql`);

