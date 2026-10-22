// gametest.mjs —— Epic 免费游戏源 + 三态徽章渲染回归测试
// ---------------------------------------------------------------------------
// 这个源改过一次「把打折说成免费」的错误（见 sources.js epicOfferState 上方注释），
// 那种 bug 靠肉眼看卡片是看不出来的：20% off 和 100% free 渲染出来长得一样，
// 都是「🎮 免费领取」。只有断言 discountPercentage 的行为才抓得住。
//
// 所以这里的夹具刻意混进打折款、过期款、缺字段款，看它们是不是真的被剔掉。
//
// 测两层：
//   A 服务端  —— mock globalThis.fetch 打桩，真调 SOURCES.games()
//   B 前端    —— 从 assets/app.js 里原样抽出 UI_I18N / fillTpl / gameBadgeMeta 执行，
//                 不重写一遍逻辑（重写就等于测了个假的）
// 全程不联网，纯本地，秒级。
import { readFileSync } from "node:fs";
import { SOURCES } from "./functions/_lib/sources.js";

let pass = 0, fail = 0;
const ok = (c, msg, extra) => {
  console.log((c ? "  OK   " : "  FAIL ") + msg + (extra ? "  " + extra : ""));
  c ? pass++ : fail++;
};
const eq = (a, b, msg) => ok(a === b, msg, `实际=${JSON.stringify(a)} 期望=${JSON.stringify(b)}`);
const has = (s, sub, msg) => ok(String(s).includes(sub), msg, `「${sub}」 not in ${JSON.stringify(String(s).slice(0, 90))}`);
const hasNot = (s, sub, msg) => ok(!String(s).includes(sub), msg, `不该出现「${sub}」: ${JSON.stringify(String(s).slice(0, 90))}`);

// ---------------------------------------------------------------- 夹具
const NOW = Date.now();
const D = 86400000;
const iso = (ms) => new Date(ms).toISOString();

const offer = (pct, startMs, endMs) => ({
  promotionalOffers: [{
    discountSetting: pct === undefined ? {} : { discountPercentage: pct },
    startDate: iso(startMs),
    endDate: iso(endMs),
  }],
});

function el(o) {
  return {
    title: "Fixture",
    description: "",
    keyImages: [],
    price: {},
    promotions: null,
    ...o,
  };
}

const ELEMENTS = [
  // 1) 正在免费 + 有原价 + 含全部 DLC + 完全版 —— 主用例
  el({
    title: "本周免费游戏",
    description: "<p>Base game and all currently available DLCs included. Complete Edition.</p>",
    catalogNs: { mappings: [{ pageSlug: "live-game" }] },
    productSlug: "abc/live-game",
    keyImages: [{ type: "Thumbnail", url: "https://img/thumb.jpg" }, { type: "OfferImageWide", url: "https://img/wide.jpg" }],
    price: { fmtPrice: { originalPrice: "$19.99" } },
    customAttributes: [{ key: "developerName", value: "Fixture Studio" }],
    promotions: { promotionalOffers: [offer(0, NOW - 2 * D, NOW + 3 * D)], upcomingPromotionalOffers: [] },
    effectiveDate: iso(NOW - 30 * D),
  }),
  // 2) 正在打折 40% —— 必须被剔除
  el({
    title: "打折四折游戏",
    catalogNs: { mappings: [{ pageSlug: "sale-40" }] },
    promotions: { promotionalOffers: [offer(40, NOW - D, NOW + 5 * D)], upcomingPromotionalOffers: [] },
  }),
  // 3) 即将免费（upcoming，0 折）
  el({
    title: "下周免费游戏",
    catalogNs: { mappings: [{ pageSlug: "soon-game" }] },
    promotions: { promotionalOffers: [], upcomingPromotionalOffers: [offer(0, NOW + 5 * D, NOW + 8 * D)] },
  }),
  // 4) 即将打折 20% —— 必须被剔除
  el({
    title: "下周打折游戏",
    catalogNs: { mappings: [{ pageSlug: "soon-sale" }] },
    promotions: { promotionalOffers: [], upcomingPromotionalOffers: [offer(20, NOW + 5 * D, NOW + 8 * D)] },
  }),
  // 5) promotions 为 null —— 长期免费区
  el({
    title: "长期免费游戏",
    catalogNs: { mappings: [{ pageSlug: "perma-game" }] },
    price: { totalPrice: { originalPrice: 1499 } },
    promotions: null,
    effectiveDate: iso(NOW - 900 * D),
  }),
  // 6) 过期（0 折但 endDate 已过）—— 必须被剔除
  el({
    title: "已过期游戏",
    catalogNs: { mappings: [{ pageSlug: "expired-game" }] },
    promotions: { promotionalOffers: [offer(0, NOW - 10 * D, NOW - 1 * D)], upcomingPromotionalOffers: [] },
  }),
  // 7) discountPercentage 字段整个缺失 —— 折扣不明，不能当免费
  el({
    title: "折扣不明游戏",
    catalogNs: { mappings: [{ pageSlug: "unknown-disc" }] },
    promotions: { promotionalOffers: [offer(undefined, NOW - D, NOW + 5 * D)], upcomingPromotionalOffers: [] },
  }),
  // 8) 只有 productSlug（无 pageSlug）—— URL 回退路径
  el({
    title: "只有 productSlug",
    productSlug: "xyz/only-product/game",
    keyImages: [{ type: "Thumbnail", url: "https://img/t.jpg" }],
    categories: [{ path: "bundles" }],
    description: "<p>Includes 5 DLCs. Deluxe Edition.</p>",
    promotions: { promotionalOffers: [offer(0, NOW - D, NOW + 2 * D)], upcomingPromotionalOffers: [] },
  }),
  // 9) 既无 pageSlug 也无 productSlug —— 回落到商店首页，不能是 /p/undefined
  el({
    title: "无 slug 游戏",
    promotions: null,
    effectiveDate: iso(NOW - 10 * D),
  }),
];

function stubFetch(payload) {
  globalThis.fetch = async () =>
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
}
const epicResp = (els) => ({ data: { Catalog: { searchStore: { elements: els } } } });

const titles = (arr) => arr.map((x) => x.title);

// ================================================================ A. 服务端
console.log("\n===== A. 服务端 SOURCES.games() =====");
stubFetch(epicResp(ELEMENTS));
let cards = await SOURCES.games();

eq(cards.length, 5, "打折/过期/折扣不明 4 条被剔除，剩 5 条");
const T = titles(cards);
hasNot(T.join("|"), "打折四折", "40% 打折款已剔除");
hasNot(T.join("|"), "下周打折", "upcoming 20% 打折款已剔除");
hasNot(T.join("|"), "已过期", "过期款已剔除");
hasNot(T.join("|"), "折扣不明", "缺 discountPercentage 的条目已剔除");
has(T.join("|"), "本周免费游戏", "本周免费在列");
has(T.join("|"), "下周免费游戏", "即将免费在列");
has(T.join("|"), "长期免费游戏", "长期免费在列");

// 排序：本周 → 即将 → 长期。组内 ts 倒序；本周那几款共用同一 startDate，
// 所以次序由标题兜底决定（只有 productSlug 的 start 更近，排第一）。
eq(T.join(" > "), "只有 productSlug > 本周免费游戏 > 下周免费游戏 > 无 slug 游戏 > 长期免费游戏", "排序 本周→即将→长期，组内按 ts 倒序、ts 相同按标题");

const by = (t) => cards.find((c) => c.title === t);

// 类目三态
eq(by("本周免费游戏").category, "游戏·本周", "在档 → 游戏·本周");
eq(by("下周免费游戏").category, "游戏·即将", "upcoming → 游戏·即将");
eq(by("长期免费游戏").category, "游戏·长期", "promotions=null → 游戏·长期");

// URL：pageSlug 优先，productSlug 兜底，都没有则商店首页
eq(by("本周免费游戏").url, "https://store.epicgames.com/p/live-game", "pageSlug 优先");
eq(by("只有 productSlug").url, "https://store.epicgames.com/p/xyz", "pageSlug 缺失时取 productSlug 第一段");
eq(by("无 slug 游戏").url, "https://store.epicgames.com/", "两者都无 → 商店首页");
hasNot(cards.map((c) => c.url).join("|"), "undefined", "URL 里不能出现 undefined");

// 缩略图：OfferImageWide 优先于 Thumbnail
eq(by("本周免费游戏").img, "https://img/wide.jpg", "OfferImageWide 优先");
eq(by("只有 productSlug").img, "https://img/t.jpg", "无 Wide 时回退 Thumbnail");

// 价格：fmtPrice 优先，分转兜底
has(by("本周免费游戏").meta, "$19.99", "fmtPrice.originalPrice");
has(by("长期免费游戏").meta, "$14.99", "totalPrice 分转兜底");

// 剩余天数
const left = by("本周免费游戏").badge.left;
ok(left >= 2 && left <= 4, "本周免费剩余天数在 2–4 之间", `left=${left}`);
has(by("本周免费游戏").meta, "剩", "中文 meta 带剩余天数");

// bundle 结构化抽取
eq(JSON.stringify(by("本周免费游戏").badge.bundle), JSON.stringify([{ c: "allDlc" }, { c: "edition" }]), "allDlc + edition");
eq(JSON.stringify(by("只有 productSlug").badge.bundle), JSON.stringify([{ c: "dlcN", n: 5 }, { c: "deluxe" }, { c: "bundle" }]), "dlcN(5) + deluxe + bundle");
eq(JSON.stringify(by("下周免费游戏").badge.bundle), "[]", "无 bundle 信息时为空数组");

// badge 三态齐全
eq(by("本周免费游戏").badge.k, "live", "badge.k=live");
eq(by("下周免费游戏").badge.k, "soon", "badge.k=soon");
eq(by("长期免费游戏").badge.k, "perma", "badge.k=perma");
ok(by("长期免费游戏").badge.date === undefined, "长期免费不编造截止日期");

// 长期免费不能抢「新鲜度」：ts 用 effectiveDate
ok(by("长期免费游戏").ts < NOW - 100 * D, "长期免费 ts 取 effectiveDate（不是 now）", `ts=${new Date(by("长期免费游戏").ts).toISOString().slice(0, 10)}`);

// desc 含开发商
has(by("本周免费游戏").desc, "Fixture Studio", "desc 带上 developerName");

// 异常输入
console.log("\n----- 异常输入 -----");
stubFetch({ data: { Catalog: { searchStore: { elements: [] } } } });
eq((await SOURCES.games()).length, 0, "空 elements → 空数组");
stubFetch({ data: {} });
eq((await SOURCES.games()).length, 0, "缺 Catalog → 空数组");
stubFetch({ nope: 1 });
eq((await SOURCES.games()).length, 0, "结构完全不符 → 空数组");
globalThis.fetch = async () => { throw new TypeError("fetch failed"); };
eq((await SOURCES.games()).length, 0, "上游 5xx/断网 → 空数组（不抛）");
stubFetch(epicResp([el({ title: "无 promotions 键", promotions: undefined })]));
eq((await SOURCES.games()).length, 1, "promotions 字段缺失也按长期免费兜底");

// 排序确定性：两款游戏共用同一个 startDate（真实周更就是这样），
// 次序必须由标题决定，不能跟着接口返回顺序漂移。
console.log("\n----- 排序确定性 -----");
const shared = NOW - D;
stubFetch(epicResp([
  el({ title: "Zeta Game", catalogNs: { mappings: [{ pageSlug: "zeta" }] }, promotions: { promotionalOffers: [offer(0, shared, shared + 5 * D)], upcomingPromotionalOffers: [] } }),
  el({ title: "Alpha Game", catalogNs: { mappings: [{ pageSlug: "alpha" }] }, promotions: { promotionalOffers: [offer(0, shared, shared + 5 * D)], upcomingPromotionalOffers: [] } }),
]));
const tied = await SOURCES.games();
eq(titles(tied).join(" > "), "Alpha Game > Zeta Game", "startDate 相同时按标题排（不随接口顺序抖动）");
stubFetch(epicResp([
  el({ title: "Alpha Game", catalogNs: { mappings: [{ pageSlug: "alpha" }] }, promotions: { promotionalOffers: [offer(0, shared, shared + 5 * D)], upcomingPromotionalOffers: [] } }),
  el({ title: "Zeta Game", catalogNs: { mappings: [{ pageSlug: "zeta" }] }, promotions: { promotionalOffers: [offer(0, shared, shared + 5 * D)], upcomingPromotionalOffers: [] } }),
]));
eq(titles(await SOURCES.games()).join(" > "), "Alpha Game > Zeta Game", "打乱输入顺序，输出不变（幂等）");

// ================================================================ B. 前端渲染
console.log("\n===== B. 前端徽章渲染（抽 assets/app.js 真代码） =====");
const APP = readFileSync(new URL("./assets/app.js", import.meta.url), "utf8");

// 从 app.js 源码里按锚点整段抽出，末端是顶格的 }; 或 }。
// 不重写逻辑 —— 重写一遍就等于在测一份副本，生产代码改了它不会红。
function grab(anchor) {
  const lines = APP.split("\n");
  const i = lines.findIndex((l) => l.includes(anchor));
  if (i < 0) throw new Error("app.js 里找不到锚点: " + anchor);
  for (let j = i + 1; j < lines.length; j++) {
    if (/^\};?$/.test(lines[j])) return lines.slice(i, j + 1).join("\n");
  }
  throw new Error("锚点没有闭合: " + anchor);
}

const UI = new Function([
  "let currentLang = 'zh';",
  // catName 会去主 I18N 表找类目名；游戏三态只登记在 UI_I18N 里，
  // 这里给个空壳，正好验证 catName 的回落链走通。
  "const I18N = { zh: {}, 'zh-Hant': {}, en: {} };",
  grab("const UI_I18N = {"),
  grab("const CAT_KEY = {"),
  grab("const CAT_COLOR = {"),
  grab("function uiText(key) {"),
  grab("function catName(cat) {"),
  grab("function fillTpl(tpl, vars) {"),
  grab("const GAME_BD_KEY = {"),
  grab("function gameBadgeMeta(b) {"),
  "return { UI_I18N, uiText, catName, fillTpl, gameBadgeMeta, CAT_COLOR, setLang(l){ currentLang = l; } };",
].join("\n"))();

// 类目显示名
eq(UI.catName("游戏·本周"), "本周免费", "catName 游戏·本周");
eq(UI.catName("游戏·即将"), "即将免费", "catName 游戏·即将");
eq(UI.catName("游戏·长期"), "长期免费", "catName 游戏·长期");
eq(UI.catName("某个没登记的类目"), "某个没登记的类目", "未登记类目原样返回（宁显示原文也不显示错译）");

// 颜色登记齐全（漏登记会退回默认橙，肉眼在深色底上很难发现）
for (const c of ["游戏·本周", "游戏·即将", "游戏·长期"]) {
  ok(!!UI.CAT_COLOR[c], `${c} 已登记强调色`, UI.CAT_COLOR[c] || "");
}

// 徽章：本周免费
const live = { k: "live", price: "$19.99", date: "11/2", left: 3, bundle: [{ c: "allDlc" }, { c: "edition" }] };
UI.setLang("zh");
eq(UI.gameBadgeMeta(live), "💰 $19.99 · 至 11/2（剩 3 天） · 含全部 DLC · 完全版", "zh 本周免费徽章");
UI.setLang("en");
eq(UI.gameBadgeMeta(live), "💰 $19.99 · free until 11/2 (3d left) · All DLCs included · Complete Edition", "en 本周免费徽章");
UI.setLang("ja");
eq(UI.gameBadgeMeta(live), "💰 $19.99 · 11/2 まで無料（残り 3 日） · 全DLC同梱 · コンプリート版", "ja 本周免费徽章");
UI.setLang("ar");
ok(UI.gameBadgeMeta(live).includes("حتى"), "ar 本周免费徽章已本地化", UI.gameBadgeMeta(live));

// 徽章：即将 / 长期
const soon = { k: "soon", price: "$7.99", date: "11/9", bundle: [] };
const perma = { k: "perma", price: "$14.99", bundle: [{ c: "dlcN", n: 5 }] };
UI.setLang("zh");
eq(UI.gameBadgeMeta(soon), "🔔 11/9 起免费 · 价值 $7.99", "zh 即将免费徽章");
eq(UI.gameBadgeMeta(perma), "♾ 长期免费 · 原价 $14.99 · 含 5 个 DLC", "zh 长期免费徽章");
UI.setLang("en");
eq(UI.gameBadgeMeta(soon), "🔔 free from 11/9 · worth $7.99", "en 即将免费徽章");
eq(UI.gameBadgeMeta(perma), "♾ free to keep · normally $14.99 · 5 DLCs included", "en 长期免费徽章");

// 缺值容错：不能让徽章露出空洞或半句话
UI.setLang("zh");
eq(UI.gameBadgeMeta({ k: "live", price: "", date: "11/2", left: 3 }), "至 11/2（剩 3 天）", "价格缺失 → 整段丢掉，不留「💰  ·」");
eq(UI.gameBadgeMeta({ k: "soon", price: "", date: "11/9" }), "🔔 11/9 起免费", "即将免费无价格 → 丢掉「价值」段");
eq(UI.gameBadgeMeta({ k: "live", price: "$9.99", date: "11/2", left: 0 }), "💰 $9.99 · 至 11/2（剩 0 天）", "剩 0 天是合法值，不能当成空值丢段");
eq(UI.gameBadgeMeta({ k: "live" }), "", "只有 k 没有其余字段 → 空串（前端回落到 meta）");
eq(UI.gameBadgeMeta(null), "", "badge 为 null → 空串");
eq(UI.gameBadgeMeta({ k: "???", price: "$1" }), "", "未知 k → 空串");
eq(UI.gameBadgeMeta({ k: "live", price: "$1", date: "1/1", left: 1, bundle: [{ c: "????" }] }), "💰 $1 · 至 1/1（剩 1 天）", "未知 bundle code 被忽略");

// 每个游戏文案 key 都得有全部 10 种语言，缺了就静默回落英文（要有意识地知道）
const GAME_KEYS = ["catThisWeek", "catUpcoming", "catForever", "gmLive", "gmSoon", "gmPerma",
  "bdAllDlc", "bdDlcN", "bdEdition", "bdDeluxe", "bdBundle"];
const LANGS10 = ["zh", "zh-Hant", "en", "es", "fr", "ja", "pt", "de", "ru", "ar"];
for (const k of GAME_KEYS) {
  const row = UI.UI_I18N[k];
  ok(!!row, `UI_I18N 有 ${k}`);
  if (!row) continue;
  const miss = LANGS10.filter((l) => !row[l]);
  eq(miss.length, 0, `${k} 十种语言齐全`, miss.join(","));
}

// 模板占位符必须闭合：残留 {x} 说明文案漏了变量
for (const k of ["gmLive", "gmSoon", "gmPerma", "bdDlcN"]) {
  for (const l of LANGS10) {
    const tpl = UI.UI_I18N[k][l];
    const leftover = UI.fillTpl(tpl, { p: "$1", d: "1/1", n: 1 }).match(/\{\w+\}/g);
    ok(!leftover, `${k}.${l} 占位符全部被替换`, leftover ? leftover.join(",") : "");
  }
}

// 三态各自必须以 emoji 起头，十个语种一视同仁。
// 这条是被截图审出来的：gmSoon 十语种全带 🔔、gmPerma 全带 ♾，
// 但 gmLive 只有中/繁中带 💰，另外 8 个语种是光秃秃的 "$19.99 · free until…" ——
// 偏偏「本周免费」是三态里唯一带截止、最该一眼认出来的那个。
// 纯文案约定很容易在下一次补语种时再次破功，所以钉成断言。
for (const k of ["gmLive", "gmSoon", "gmPerma"]) {
  const noEmoji = LANGS10.filter((l) => !/^\p{Extended_Pictographic}/u.test(UI.UI_I18N[k][l]));
  eq(noEmoji.length, 0, `${k} 十种语言都以 emoji 起头`, noEmoji.join(","));
}

// ---------------------------------------------------------------- 汇总
console.log("");
if (fail) {
  console.log(`✗ gametest: ${fail} 项失败（共 ${pass + fail} 项）`);
  process.exit(1);
}
console.log(`✓ gametest: ${pass} 项全部通过`);