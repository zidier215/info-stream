// scripts/export-seed-esm.mjs
import { readFileSync, writeFileSync } from "node:fs";

const seed = JSON.parse(readFileSync(new URL("../data/papers-seed.json", import.meta.url), "utf8"));

const content = `// functions/_lib/papers_seed.js
// 初始 50 篇精选 AI 论文档案库种子数据（内联持久化，无环境依赖秒开）
export const PAPERS_SEED = ${JSON.stringify(seed, null, 2)};
`;

writeFileSync(new URL("../functions/_lib/papers_seed.js", import.meta.url), content, "utf8");
console.log(`✓ 成功生成 functions/_lib/papers_seed.js (${seed.length} 条记录)`);

