// pwpath.mjs —— 解析 playwright 的安装位置，供所有真实浏览器套件共用
//
// 为什么需要它：
//   项目里没有 package.json / node_modules，playwright 是从 WorkBuddy 自带的
//   二进制目录借的。以前每个脚本各自写死一行：
//     import { chromium } from "file:///C:/Users/ampthon/.workbuddy/binaries/
//                                      node/workspace/node_modules/playwright/index.mjs";
//   这么写有两个问题：
//     1. 用户名写死 —— 换台机器、换个账号，这个包直接访问不到；
//     2. 重复 7 遍 —— 路径一改要同时改 7 个文件，漏一个就有一个套件是坏的。
//
// 解析顺序（先到先得，全都不是就报错并说明怎么修）：
//   1. 环境变量 PW_MODULE —— 显式指定，最优先，方便 CI 里指向自定义安装。
//   2. 项目内 node_modules —— 自己在项目里 npm i playwright 时走这条。
//   3. WorkBuddy 自带目录 —— 用 homedir() 拼，不写死用户名。
//
// 用 homedir() 而不是写死 "C:/Users/ampthon"：Windows 的用户目录可以整个搬走，
// 也可以在别的盘；写死等于假设「所有人都用 C 盘且用户名叫 ampthon」。
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = new URL(".", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

const CANDIDATES = [
  ["环境变量 PW_MODULE", process.env.PW_MODULE],
  ["项目内 node_modules", join(ROOT, "node_modules", "playwright", "index.mjs")],
  [
    "WorkBuddy 自带目录",
    join(
      homedir(),
      ".workbuddy",
      "binaries",
      "node",
      "workspace",
      "node_modules",
      "playwright",
      "index.mjs"
    ),
  ],
].filter(([, p]) => p);

/** 找到 playwright 的入口文件绝对路径。找不到就抛错，并把三条候选路径都打出来。 */
export function playwrightEntry() {
  for (const [label, p] of CANDIDATES) {
    if (existsSync(p)) return p;
  }
  throw new Error(
    "找不到 playwright。任选一种方式解决：\n" +
      "  1) 在项目目录执行  npm i -D playwright\n" +
      "  2) 设环境变量 PW_MODULE 指向 playwright/index.mjs\n" +
      "  3) 用 WorkBuddy 自带的（应位于 ~/.workbuddy/binaries/node/workspace/node_modules/）\n" +
      "试过的路径：\n" +
      CANDIDATES.map(([l, p]) => `  - [${l}] ${p}`).join("\n")
  );
}

/** 动态 import playwright。返回整个命名空间，调用方自己取 chromium。 */
export async function loadPlaywright() {
  const entry = playwrightEntry();
  return import(pathToFileURL(entry).href);
}

/** 把项目内的相对路径转成 file:// URL（Windows 盘符需要这个转换，直接拼会挂）。 */
export const fileURL = (rel) => pathToFileURL(join(ROOT, rel)).href;