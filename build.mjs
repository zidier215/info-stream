// build.mjs —— 构建静态产物到 public/
// ---------------------------------------------------------------------------
// 为什么需要这一步（v2.4 修掉的真实问题）：
//   原来 wrangler.toml 里 pages_build_output_dir = "."，也就是把整个项目目录
//   当作静态资源上传。后果是 https://<domain>/functions/_lib/sources.js
//   和 https://<domain>/apitest.mjs 都能被直接下载 —— 源码、接口结构、
//   测试脚本全部对外公开。_routes.json 里的 "/*.js" 只匹配根目录一层，
//   挡不住子目录。
//
// 现在改成：源码留在仓库根，public/ 只放真正要给用户看的文件。
//   public/index.html   静态模板（三个域名共用，运行时由 functions/index.js 改写）
//   public/assets/      前端 js / css
//   public/favicon.svg
//   public/_routes.json Cloudflare Pages 路由规则（见下面「为什么 _routes.json 必须在白名单里」）
//
// 无依赖，纯 node:fs，任何机器上 node build.mjs 都能跑。
// ---------------------------------------------------------------------------

import { cpSync, mkdirSync, rmSync, existsSync, readdirSync, statSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = join(ROOT, "public");

// 要拷进 public/ 的条目。白名单而非黑名单 —— 新加一个测试脚本时
// 不会顺手把源码带上去，这是这类构建最容易出的事故。
//
// _routes.json 必须在白名单里（2026-10-22 修）：
//   本文件开头就是 rmSync(OUT, {recursive:true})，public/ 是先删干净再重建的。
//   _routes.json 原本不在白名单里，于是每次 build 都会把它删掉且不重建，
//   而构建照样打印「✓ 构建完成」—— 静默失败，最坏的一种。
//   后果不是报错，是配额：这份文件里的 exclude 列表（/assets/*、/*.css、/*.js…）
//   是 Cloudflare Pages「静态资源走 CDN、不进 Functions」的唯一开关。
//   丢了它，默认行为变成**所有**请求都走一次 Function 调用，
//   于是每次加载页面都要为 app.js / styles.css 各付一次 Pages Functions 调用，
//   10 万次/天的免费额度被静态文件吃光 —— 正好是 _guard.js 头部
//   「不做防护会被人当免费 API 白嫖」担心的同一件事，从另一个方向发生。
const ENTRIES = ["index.html", "assets", "favicon.svg", "_routes.json"];

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

let files = 0;
let bytes = 0;
function walk(dir, base = "") {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    const rel = base ? `${base}/${name}` : name;
    if (st.isDirectory()) {
      mkdirSync(join(OUT, rel), { recursive: true });
      walk(full, rel);
    } else {
      files++;
      bytes += st.size;
    }
  }
}

for (const e of ENTRIES) {
  const src = join(ROOT, e);
  if (!existsSync(src)) {
    console.error(`✗ 缺少构建输入: ${e}`);
    process.exit(1);
  }
  cpSync(src, join(OUT, e), { recursive: true });
}

walk(OUT);
console.log(`✓ 构建完成 -> public/`);
console.log(`  ${files} 个文件, ${(bytes / 1024).toFixed(1)} KB`);

// 自检 1：_routes.json 必须真的落到 public/ 里，且是合法 JSON。
// 少了它不会报错，只会让所有静态资源都走 Functions 调用 ——
// 这种「构建成功但部署后变慢/变贵」的故障，等线上发现就晚了，所以在这里拦。
{
  const rp = join(OUT, "_routes.json");
  if (!existsSync(rp)) {
    console.error("✗ public/_routes.json 缺失：静态资源会全部改走 Functions 调用");
    process.exit(1);
  }
  try {
    const routes = JSON.parse(readFileSync(rp, "utf8"));
    // exclude 是这份文件的价值所在，缺了就等于没生效
    if (!Array.isArray(routes.exclude) || !routes.exclude.length) {
      console.error("✗ public/_routes.json 缺少 exclude 列表，静态资源会全部改走 Functions 调用");
      process.exit(1);
    }
  } catch (e) {
    console.error("✗ public/_routes.json 不是合法 JSON: " + e.message);
    process.exit(1);
  }
}

// 自检 2：public/ 里绝不能出现源码与函数
const leaked = [];
(function scan(dir, base = "") {
  for (const name of readdirSync(dir)) {
    const rel = base ? `${base}/${name}` : name;
    const st = statSync(join(dir, name));
    if (st.isDirectory()) { scan(join(dir, name), rel); continue; }
    if (/^(functions|_lib)\//.test(rel) || /\.mjs$/.test(rel)) leaked.push(rel);
  }
})(OUT);
if (leaked.length) {
  console.error("✗ public/ 里混进了不该发布的文件: " + leaked.join(", "));
  process.exit(1);
}
console.log("  ✓ 未泄漏源码/测试脚本");