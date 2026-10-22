// gameshot.mjs —— 游戏站三态 tab 的视觉验证（截图 + 渲染管线断言）
// 用法：先 node localsim.mjs 8788，再 node gameshot.mjs
//
// 为什么截图单独一个脚本：gametest 断言的是「拼出来的字符串对不对」，
// 但用户抱怨的是「卡片看起来没用」。中间隔着一层渲染与样式，
// 字符串对了、卡片还是丑的情况 gametest 抓不到。这里出图给人眼过一遍，
// 顺带断言只有跑真实 DOM 才暴露得了的问题（下面那条「不许重复」）。
//
// 为什么断言结构是「逐 tab」而不是「同屏三态」：
//   游戏站三个 tab 共用一次上游请求，靠客户端按 badge.k 收窄。
//   过滤生效后**任何单个 tab 都不可能同时出现三态** —— 这正是设计意图。
//   所以「三态标签都在」必须改成跨 tab 验证：
//   ① 每个 tab 只出现自己那一种状态（过滤正确）
//   ② 三个 tab 合起来恰好三种状态、三个配色（覆盖完整）
//   上一个版本把这版脚本打的是主站（myinfostream.test），
//   主站简报 tab 里三种状态同屏，断言「同屏三态」就绿了 ——
//   于是游戏站真正的过滤逻辑一次都没被跑过。这是本脚本改成打游戏站的原因。
//
// 拦截 /api/feed 注入固定夹具，保证三种状态都出现在同一批响应里，
// 并且不被 Epic 每周换货影响（换一次货就换一张图，没法对比）。
import { loadPlaywright } from "./pwpath.mjs";
import { ITEMS } from "./gamefixture.mjs";
import { simArgs, simURL } from "./simhosts.mjs";

const { chromium } = await loadPlaywright();
// 打的是**游戏站自己**，不是主站。
const BASE = simURL("game");

const TABS = ["live", "soon", "perma"];
const byK = (k) => ITEMS.filter((x) => x.badge.k === k).length;

let fail = 0, pass = 0;
const ok = (c, m, x = "") => { if (c) { pass++; console.log(`  OK   ${m}`); } else { fail++; console.log(`  FAIL ${m}  ${x}`); } };

const b = await chromium.launch({ args: simArgs() });
const p = await b.newPage({ viewport: { width: 900, height: 1180 }, deviceScaleFactor: 2 });

const errs = [];
p.on("pageerror", (e) => errs.push("pageerror: " + e.message));
p.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text()); });

let fetchCount = 0;
await p.route("**/api/feed*", async (route) => {
  fetchCount++;
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ items: ITEMS, stale: false }),
  });
});

// 等入场动画跑完再截图：.card 有 animation: rise .35s，中途拍会拍到半透明的鬼影。
async function settle() {
  await p.waitForTimeout(1200);
  await p.evaluate(() => Promise.all(
    document.getAnimations().map((a) => a.finished.catch(() => {})),
  ));
  await p.waitForTimeout(150);
}

// 读当前 DOM 里的卡片视觉信息
const readCards = () => p.locator("#feed .card").evaluateAll((els) =>
  els.map((e) => {
    // 判「视觉溢出」不能看 scrollWidth：.card 上有 overflow:hidden（血满宽
    // 的缩略图靠它裁圆角），而 scrollWidth 照样把被裁掉的溢出算进去——
    // .thumb 的 margin 左右各 -15px 会让每张带图卡都虚报「超 15px」。
    // 真正要抓的是文字/内容有没有越过卡片边框，也就是子元素的
    // boundingClientRect 是否超出卡片自身的可视矩形。
    const cb = e.getBoundingClientRect();
    const bleed = [];
    for (const n of e.querySelectorAll(".title, .desc, .meta, .tag")) {
      const b = n.getBoundingClientRect();
      const over = Math.max(cb.left - b.left, b.right - cb.right);
      if (over > 1) bleed.push(`${n.className}(+${Math.round(over)}px)`);
    }
    const cat = (e.querySelector(".tag") || {}).textContent || "";
    return {
      tag: cat,
      title: (e.querySelector(".title") || {}).textContent || "",
      meta: (e.querySelector(".meta") || {}).textContent || "",
      accent: getComputedStyle(e).getPropertyValue("--accent").trim(),
      thumbH: e.querySelector(".thumb") ? Math.round(e.querySelector(".thumb").getBoundingClientRect().height) : 0,
      // 徽章被 clamp 截断时，行数不应超过 2（CSS 里 -webkit-line-clamp:2）
      metaLines: Math.round((e.querySelector(".meta span:last-child") || { getBoundingClientRect: () => ({ height: 0 }) })
        .getBoundingClientRect().height / 18),
      bleed,
    };
  })
);

// 判定「这张卡属于哪一态」：按标题回查夹具。
//
// 不能靠匹配徽章文案（本周/即将/长期）—— 徽章是本地化的，
// en 下是 "Free soon"、ja 下是 "近日無料"，一换语言就全判不出来。
// 卡片标题来自上游原文（Epic 的游戏名），所有语言下都不变，
// 拿它回查夹具是与语言无关的判定方式。
const KIND_BY_TITLE = new Map(ITEMS.map((x) => [x.title, x.badge.k]));
const kindOf = (title) => KIND_BY_TITLE.get(title) || "?";

// 选中态的 class 是 `.active`（app.js buildTabs 里拼的），不是 `.is-on`
const tabLabel = async () =>
  (await p.locator("#tabs .tab.active").first().textContent() || "").trim();

for (const lang of ["zh", "en", "ja"]) {
  console.log(`\n===== ${lang} =====`);

  const seenAccents = new Set();
  const seenKinds = new Set();
  let expectedTitles = 0;

  for (const tab of TABS) {
    fetchCount = 0;
    await p.goto(`${BASE}?tab=${tab}&lang=${lang}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    for (let i = 0; i < 40 && (await p.locator("#feed .card").count()) === 0; i++) {
      await p.waitForTimeout(250);
    }
    await settle();

    console.log(`\n  --- tab=${tab} (${await tabLabel()}) ---`);
    expectedTitles += byK(tab);

    // ---- ① 过滤正确：这个 tab 只该出现自己那一态 ----
    let rows = await readCards();
    ok(rows.length === byK(tab), `${lang}/${tab} 卡片数 = ${byK(tab)}`,
      `实际 ${rows.length}（接口被调用 ${fetchCount} 次）`);
    const wrong = rows.filter((r) => kindOf(r.title) !== tab);
    ok(wrong.length === 0, `${lang}/${tab} 只出现本 tab 的状态，没有混进别的态`,
      wrong.map((r) => `${kindOf(r.title)}:${r.title.slice(0, 16)}`).join(" "));
    ok(rows.every((r) => r.tag), `${lang}/${tab} 每张卡都有状态徽章`);

    // ---- 渲染管线：同一条内容不许出现两次 ----
    // /api/feed 没有分页参数，每次都返回整个 tab。「buffer 见底就再拉一次」
    // 会把同一批内容反复追加：用户滚过第一屏后整页卡片逐屏重复，永不停歇。
    // gametest 靠源码抽取跑不到 loadFeed，只能在这里按真实 DOM 断言。
    let titles = rows.map((r) => r.title);
    ok(new Set(titles).size === titles.length, `${lang}/${tab} 首屏无重复条目`,
      `重复 ${titles.length - new Set(titles).size} 条`);

    for (let i = 0; i < 4; i++) {
      await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await p.waitForTimeout(500);
    }
    await settle();
    rows = await readCards();
    titles = rows.map((r) => r.title);
    ok(new Set(titles).size === titles.length, `${lang}/${tab} 滚到底后仍无重复条目`,
      `共 ${titles.length} 张卡 / ${new Set(titles).size} 个不同标题`);

    for (const r of rows) console.log(`    [${r.accent}] ${r.tag}  |  ${r.meta}`);
    rows.forEach((r) => { seenAccents.add(r.accent); seenKinds.add(kindOf(r.title)); });

    // ---- ② 视觉：溢出 / 行数 / 缩略图 ----
    ok(rows.every((r) => !r.bleed.length), `${lang}/${tab} 卡片内容无横向溢出`,
      rows.flatMap((r) => r.bleed.map((x) => `${r.title.slice(0, 18)}:${x}`)).join(" "));
    ok(rows.every((r) => r.metaLines <= 2), `${lang}/${tab} 徽章最多两行`,
      rows.filter((r) => r.metaLines > 2).map((r) => `${r.title.slice(0, 18)}:${r.metaLines}行`).join(" "));

    // 无图的条目不该留 120px 白洞（soon 的 Ghostrunner、perma 的 Them's Fightin' Herds 特意没给图）
    const noImg = rows.filter((r) => r.thumbH === 0);
    ok(noImg.length === 0 || rows.some((r) => r.thumbH > 0),
      `${lang}/${tab} 无图条目不留空缩略图洞`, `${noImg.length} 张无图`);

    await p.locator("#feed").screenshot({ path: `shot-game-${lang}-${tab}.png` });
  }

  // ---- ③ 跨 tab：三种状态、三种配色，一个不多一个不少 ----
  ok(seenKinds.size === 3 && !seenKinds.has("?"), `${lang} 三个 tab 合起来覆盖全部三态`,
    [...seenKinds].join(" / "));
  ok(seenAccents.size === 3, `${lang} 三态配色互不相同`, [...seenAccents].join(" / "));
  ok(expectedTitles === ITEMS.length, `${lang} 三个 tab 卡片总数 = 夹具总数`, `${expectedTitles}/${ITEMS.length}`);
  await p.screenshot({ path: `shot-game-full-${lang}.png`, fullPage: false });
}

console.log("");
ok(errs.length === 0, "无页面错误", errs.join(" | "));
console.log(`\n${fail ? "✗" : "✓"} gameshot: ${pass} 通过 / ${fail} 失败`);
await b.close();
process.exit(fail ? 1 : 0);