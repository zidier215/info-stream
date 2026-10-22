// brandtest.mjs —— 多语言品牌名 / RTL / 标题 / 繁体 支持测试
// 用法：node localsim.mjs 8788 然后 node brandtest.mjs
//
// 走 SIM 假域名而不是 file://index.html：
//   品牌名是 functions/index.js 按 Host 注入 __HOST_CONFIG__ 决定的，
//   直接开本地 index.html 注入不了，测到的会是 FALLBACK_HOST 的默认值 ——
//   那只能证明「兜底文案没坏」，证明不了「真实站点标识是对的」。
import { loadPlaywright } from "./pwpath.mjs";
import { simArgs, simURL } from "./simhosts.mjs";

const url = simURL("main");
const { chromium } = await loadPlaywright();
const b = await chromium.launch({ args: simArgs() });
const p = await b.newPage({ viewport: { width: 1360, height: 940 } });

const errs = [];
p.on("pageerror", (e) => errs.push(e.message));
p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });

await p.goto(url);
await p.waitForTimeout(800);

const rows = [];
for (const lang of ["zh", "zh-Hant", "en", "es", "ar", "ja", "cy", "eo"]) {
  await p.selectOption("#lang", lang);
  await p.waitForTimeout(350);
  rows.push({
    lang,
    main: (await p.locator("[data-brand='main']").textContent()).trim(),
    sub: (await p.locator("[data-brand='sub']").textContent()).trim(),
    htmlLang: await p.getAttribute("html", "lang"),
    dir: await p.getAttribute("html", "dir"),
    title: await p.title(),
    横幅: ((await p.locator("#banner").count()) ? (await p.locator("#banner").textContent()).slice(0, 12) : "-"),
  });
}
console.table(rows);

// 期望值校验
const EXPECT = {
  zh: ["信息河", "InfoStream"],
  "zh-Hant": ["資訊河", "InfoStream"],
  en: ["InfoStream", "信息河"],
  es: ["Flujo de Información", "InfoStream"],
  ar: ["تيار المعلومات", "InfoStream"],
  ja: ["情報の川", "InfoStream"],
  cy: ["Llif Gwybodaeth", "InfoStream"],
  eo: ["Informa Fluo", "InfoStream"],
};
let bad = 0;
for (const r of rows) {
  const e = EXPECT[r.lang];
  if (!e) continue;
  if (r.main !== e[0] || r.sub !== e[1]) { console.log(`✗ ${r.lang}: 期望 ${e[0]}/${e[1]}，实际 ${r.main}/${r.sub}`); bad++; }
}
console.log(bad === 0 ? "✓ 8 种语言品牌名全部符合预期" : `✗ ${bad} 种语言不符合预期`);
console.log("控制台错误 =", errs.length, errs.slice(0, 3).join(" | "));

// 两张对照图：繁体与英文的品牌区。命名带 brand 前缀，避免和 shot-game-* /
// shot-hot-* 混在一起分不清是谁产的（之前叫 shot-en.png / shot-hant.png，
// 每跑一次就往根目录丢两个无归属的图）。
await p.selectOption("#lang", "zh-Hant"); await p.waitForTimeout(400);
await p.screenshot({ path: "shot-brand-hant.png" });
await p.selectOption("#lang", "en"); await p.waitForTimeout(400);
await p.screenshot({ path: "shot-brand-en.png" });

await b.close();
process.exit(bad === 0 && errs.length === 0 ? 0 : 1);