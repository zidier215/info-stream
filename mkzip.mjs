// mkzip.mjs —— 打 hao-feed.zip
// 用法：node mkzip.mjs [srcDir] [outZip]
//
// 为什么不用现成工具（两个都试过，都会产出坏包）：
//   1. shell zip —— Git Bash 环境里根本没这个命令。
//   2. PowerShell Compress-Archive —— 能写出结构正确的包，但条目名用的是
//      **反斜杠**（assets\app.js）。Windows 自己解压无感，Linux/macOS 解出来
//      是「一个名字里带反斜杠的单个文件」，目录层级整个塌掉，直接不可用。
//      而且用 -Update 二次追加时还会把顶层文件拍平到包根，部署即失效。
//
// 所以这里手写 ZIP 结构。要点只有一个：**条目名一律正斜杠**。
// 压缩方式选 STORE(0) 不做压缩 —— 源码文本本身已高度压缩，
// DEFLATE 再压一遍收益极小（实测差异 <5%），不值得引入 deflate 的复杂度。
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { crc32 } from "node:zlib";

// 坑（2026-10-22 第一次跑就踩）：这里原本用
//     new URL(".", import.meta.url).pathname
// 取脚本所在目录。在 Windows 上 pathname 返回的是 "/C:/Users/..."（带前导斜杠的
// URL 形式，不是文件系统路径），join 之后拼成 "C:\C:\Users\..." —— scandir 直接
// ENOENT。必须用 fileURLToPath 让 URL 对象自己转成平台原生路径。
const SRC = process.argv[2] || fileURLToPath(new URL(".", import.meta.url)).replace(/[\\/]$/, "");
const OUT = process.argv[3] || join(SRC, "..", "hao-feed.zip");

// 顶层固定收这几个；其余三个目录整棵收；*.mjs 收在根但排除 probe-*
const TOP = ["index.html", "favicon.svg", "wrangler.toml", "_routes.json", "README.md", ".gitignore"];
const DIRS = ["assets", "functions", "public", "data"];

const files = [...TOP];
for (const d of DIRS) {
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else files.push(relative(SRC, p));
    }
  };
  walk(join(SRC, d));
}
for (const e of readdirSync(SRC)) {
  // probe-*.mjs 是一次性诊断探针，不进包（同 .gitignore 的口径）
  if (e.endsWith(".mjs") && !e.startsWith("probe-")) files.push(e);
}

const enc = new TextEncoder();
const parts = [];
const central = [];
let offset = 0;

for (const rel of files) {
  let data;
  try { data = readFileSync(join(SRC, rel)); } catch { continue; }

  // ★ 关键一行：路径分隔符统一成正斜杠。Windows 上 path.sep 是 "\",
  //   不换掉的话这个包只能在 Windows 上解压。
  const nameBuf = enc.encode(rel.split("\\").join("/"));
  const crc = crc32(data);

  const lh = Buffer.alloc(30);
  lh.writeUInt32LE(0x04034b50, 0);   // local file header 签名
  lh.writeUInt16LE(20, 4);           // version needed to extract
  lh.writeUInt16LE(0, 6);            // general purpose flags
  lh.writeUInt16LE(0, 8);            // method: 0 = store
  lh.writeUInt16LE(0, 10);           // mod time（留 0，避免时区带来的不确定性）
  lh.writeUInt16LE(0x21, 12);        // mod date（1980-01-01 最小合法值）
  lh.writeUInt32LE(crc >>> 0, 14);
  lh.writeUInt32LE(data.length, 18); // compressed size
  lh.writeUInt32LE(data.length, 22); // uncompressed size
  lh.writeUInt16LE(nameBuf.length, 26);
  lh.writeUInt16LE(0, 28);           // extra length
  parts.push(lh, nameBuf, data);

  const ch = Buffer.alloc(46);
  ch.writeUInt32LE(0x02014b50, 0);   // central directory 签名
  ch.writeUInt16LE(20, 4);           // version made by
  ch.writeUInt16LE(20, 6);           // version needed
  ch.writeUInt16LE(0, 8);
  ch.writeUInt16LE(0, 10);
  ch.writeUInt16LE(0, 12);
  ch.writeUInt16LE(0x21, 14);
  ch.writeUInt32LE(crc >>> 0, 16);
  ch.writeUInt32LE(data.length, 20);
  ch.writeUInt32LE(data.length, 24);
  ch.writeUInt16LE(nameBuf.length, 28);
  ch.writeUInt16LE(0, 30);           // extra
  ch.writeUInt16LE(0, 32);           // comment
  ch.writeUInt16LE(0, 34);           // disk number
  ch.writeUInt16LE(0, 36);           // internal attrs
  ch.writeUInt32LE(0, 38);           // external attrs
  ch.writeUInt32LE(offset, 42);      // 本地头在包内的偏移
  central.push(ch, nameBuf);

  offset += lh.length + nameBuf.length + data.length;
}

const cd = Buffer.concat(central);
const eocd = Buffer.alloc(22);
eocd.writeUInt32LE(0x06054b50, 0);   // end of central directory 签名
eocd.writeUInt16LE(0, 4);
eocd.writeUInt16LE(0, 6);
eocd.writeUInt16LE(files.length, 8);
eocd.writeUInt16LE(files.length, 10);
eocd.writeUInt32LE(cd.length, 12);
eocd.writeUInt32LE(offset, 16);
eocd.writeUInt16LE(0, 20);

writeFileSync(OUT, Buffer.concat([...parts, cd, eocd]));
console.log(`✓ 写入 ${files.length} 个条目 -> ${OUT}`);