// hotshot.mjs —— 热搜站三榜分榜对照的视觉验证（截图 + 分榜链路断言）
// 用法：先 node localsim.mjs 8788，再 node hotshot.mjs
//
// 存在的理由：
//   hosttest 断言的是「HOSTS 字典里 hot 配了三个 tab」，这属于配置自证。
//   真正要保证的是另一件事：**用户看到的每一张卡，都确实来自当前 tab 那一榜**。
//   这是「分榜对照」这个产品承诺的全部内容，也恰好是最容易悄悄失效的地方——
//   resolveHost 匹配失败会静默回落到主站，于是三个 tab 打出同一批混合源，
//   页面照常渲染、没有报错，只是「对照」变成了「复读」。
//
// 为什么**不**拦截 /api/feed 注入夹具（与 gameshot 相反）：
//   gameshot 必须用夹具，是因为它要断言的是「客户端按 badge.k 收窄」这个纯前端逻辑，
//   而 Epic 每周换货会让 img URL 漂移、没法跨轮对比。
//   hot 站断言的是 host→tab→source 这条**贯穿服务端的链路**，一夹具就把
//   最容易坏的那一环（取数路由）屏蔽掉了。hot 三榜的「源名不变」语义很稳
//   （微博/百度/抖音 永远是这三个），用真数据反而更可靠。
//   顺带说：这个脚本是 localsim.mjs 的 `/api/` 分支漏做 `.test → .com`
//   还原这个 latent bug 的发现者。gameshot 用 route.fulfill 把它绕过去了，
//   所以那处漏还原一直没人看见——症状是所有断言全绿，实际打的是主站 brief 源。
//
// 为什么核心断言挑「源名字段」而不是「类目」：
//   .tag（类目标签）走 i18n，en 下是 Trending、ja 下はトレンド，换语言就对不上；
//   --accent 虽然语言无关，但微博和百度**同为境内热搜、同一枚红**，无法区分两榜。
//   .meta 的第一个 span 是 it.source，服务端硬编码的中文，从不经过 translateText ——
//   这是唯一能同时做到「语言无关 + 三榜互不相同」的锚点。

import { loadPlaywright } from "./pwpath.mjs";
import { simArgs, simURL } from "./simhosts.mjs";

const { chromium } = await loadPlaywright();

// 打的是**热搜站自己**，不是主站。
const BASE = simURL("hot");

const TABS = ["weibo", "baidu", "douyin"];

// 卡面 .meta 里第一个 span 的文字。服务端 sources.js 硬编码，不走 i18n。
const SRC = { weibo: "微博", baidu: "百度", douyin: "抖音" };
// 微博/百度同为「境内热搜」共用一枚红，抖音是「娱乐」用橙 —— 与 sources.js 的 category 对应。
const ACCENT = { weibo: "#e8553b", baidu: "#e8553b", douyin: "#f0902a" };
// 只有百度榜带 img（sources.js 里 baidu 有 desc + img，另两个没有）。
const HAS_IMG = { weibo: false, baidu: true, douyin: false };
// tab 按钮文案走 UI_I18N，zh 和 ja 都保留中文品牌名，只有 en 拉丁化。
const LABEL = {
  zh: { weibo: "微博", baidu: "百度", douyin: "抖音" },
  en: { weibo: "Weibo", baidu: "Baidu", douyin: "Douyin" },
  ja: { weibo: "微博", baidu: "百度", douyin: "抖音" },
};
// .tag 走 I18N，是本地化的 —— 与源名字段正好相反。
const TAG = {
  zh: { weibo: "热搜", baidu: "热搜", douyin: "娱乐" },
  en: { weibo: "Trending", baidu: "Trending", douyin: "Entertainment" },
  ja: { weibo: "トレンド", baidu: "トレンド", douyin: "エンタメ" },
};
const LANGS = ["zh", "en", "ja"];

let fail = 0, pass = 0;
const ok = (c, m, x = "") => { if (c) { pass++; console.log(`  OK   ${m}`); } else { fail++; console.log(`  FAIL ${m}  ${x}`); } };

const b = await chromium.launch({ args: simArgs() });
const p = await b.newPage({ viewport: { width: 900, height: 1180 }, deviceScaleFactor: 2 });

const errs = [];
p.on("pageerror", (e) => errs.push("pageerror: " + e.message));
p.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text()); });

// 等入场动画跑完再截图：.card 有 animation: rise .35s，中途拍会拍到半透明的鬼影。
async function settle() {
  await p.waitForTimeout(1200);
  await p.evaluate(() => Promise.all(
    document.getAnimations().map((a) => a.finished.catch(() => {})),
  ));
  await p.waitForTimeout(150);
}

// 读当前 DOM 里的卡片视觉信息。
// 关键：.meta 的第一个 span 必须单独读出来当 source —— 直接读 .meta 的
// textContent 会把源名和热度值粘在一起（"微博🔥 1234"），做不了精确相等断言。
const readCards = () => p.locator("#feed .card").evaluateAll((els) =>
  els.map((e) => {
    // 判「视觉溢出」不能看 scrollWidth：.card 上有 overflow:hidden（血满宽
    // 的缩略图靠它裁圆角），而 scrollWidth 照样把被裁掉的溢出算进去。
    const cb = e.getBoundingClientRect();
    const bleed = [];
    for (const n of e.querySelectorAll(".title, .desc, .meta, .tag")) {
      const b = n.getBoundingClientRect();
      const over = Math.max(cb.left - b.left, b.right - cb.right);
      if (over > 1) bleed.push(`${n.className}(+${Math.round(over)}px)`);
    }
    const spans = e.querySelectorAll(".meta span");
    return {
      // it.source：服务端硬编码中文，恒不翻译 —— 语言无关的分榜锚点
      source: (spans[0] || {}).textContent || "",
      // 服务端拼的 meta（"🔥 12.3万"），SIM 模式下 gameBadgeMeta 返回 null 所以走它
      heat: (spans[spans.length - 1] || {}).textContent || "",
      tag: (e.querySelector(".tag") || {}).textContent || "",
      title: (e.querySelector(".title") || {}).textContent || "",
      desc: (e.querySelector(".desc") || {}).textContent || "",
      accent: getComputedStyle(e).getPropertyValue("--accent").trim(),
      // 外网 CDN 图可能加载不出来，但 .thumb 这个 div 只要 img 字段非空就会渲染，
      // 所以用它的高度判断「这条到底带不带图」，不判断图有没有加载成功。
      thumbH: e.querySelector(".thumb") ? Math.round(e.querySelector(".thumb").getBoundingClientRect().height) : 0,
      href: (e.querySelector(".title") || {}).getAttribute?.("href") || "",
      bleed,
    };
  })
);

const tabLabel = async () =>
  (await p.locator("#tabs .tab.active").first().textContent() || "").trim();

for (const lang of LANGS) {
  console.log(`\n===== ${lang} =====`);

  const seenSrc = new Set();
  const titlesByTab = {};

  for (const tab of TABS) {
    await p.goto(`${BASE}?tab=${tab}&lang=${lang}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    for (let i = 0; i < 60 && (await p.locator("#feed .card").count()) === 0; i++) {
      await p.waitForTimeout(250);
    }
    await settle();

    console.log(`\n  --- tab=${tab} (${await tabLabel()}) ---`);

    let rows = await readCards();

    // ---- ① 分榜对照成立：本榜只出本榜的源 ----
    ok(rows.length > 0, `${lang}/${tab} 卡片数 > 0`, `实际 ${rows.length}`);
    const wrong = rows.filter((r) => r.source !== SRC[tab]);
    ok(wrong.length === 0, `${lang}/${tab} 每张卡的源都是「${SRC[tab]}」`,
      wrong.length ? [...new Set(wrong.map((r) => r.source))].join("/") + `（${wrong.length} 张）` : "");
    ok(rows.every((r) => r.accent === ACCENT[tab]), `${lang}/${tab} --accent = ${ACCENT[tab]}`,
      [...new Set(rows.filter((r) => r.accent !== ACCENT[tab]).map((r) => r.accent))].join("/"));
    ok(rows.every((r) => r.tag === TAG[lang][tab]), `${lang}/${tab} .tag = ${TAG[lang][tab]}`,
      [...new Set(rows.filter((r) => r.tag !== TAG[lang][tab]).map((r) => r.tag))].join("/"));

    // ---- 内容语种：榜单一律中文，界面语言切到 en/ja 也不许变 ----
    const nonCJK = rows.filter((r) => !/[\u4e00-\u9fff]/.test(r.title || ""));
    ok(nonCJK.length === 0, `${lang}/${tab} 标题恒含中文（内容不随界面语言变）`,
      nonCJK.slice(0, 3).map((r) => r.title).join(" | "));

    // ---- 热度值：三榜都带 🔥 前缀（sources.js 里逐源拼的）----
    const noHeat = rows.filter((r) => !r.heat.includes("🔥"));
    ok(noHeat.length === 0, `${lang}/${tab} 每张卡带 🔥 热度值`,
      noHeat.slice(0, 3).map((r) => `${r.title.slice(0, 12)}=[${r.heat}]`).join(" | "));

    // ---- 链接：热榜条目必须可点回原站 ----
    const badLink = rows.filter((r) => !r.href || r.href === "#");
    ok(badLink.length === 0, `${lang}/${tab} 每张卡都有跳转链接`, `${badLink.length} 张缺 href`);

    // ---- 缩略图：只有百度榜带图 ----
    const hasThumb = rows.some((r) => r.thumbH > 0);
    ok(hasThumb === HAS_IMG[tab], `${lang}/${tab} 缩略图期望 ${HAS_IMG[tab] ? "有" : "无"}`,
      `实际 ${hasThumb ? "有" : "无"}（${rows.filter((r) => r.thumbH > 0).length}/${rows.length} 张）`);

    // ---- 视觉：无横向溢出 ----
    ok(rows.every((r) => !r.bleed.length), `${lang}/${tab} 卡片内容无横向溢出`,
      rows.flatMap((r) => r.bleed.map((x) => `${r.title.slice(0, 16)}:${x}`)).join(" "));

    // ---- 渲染管线：滚到底不许把同一批内容再追加一遍 ----
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

    for (const r of rows.slice(0, 4)) console.log(`    [${r.accent}] ${r.source} / ${r.tag} | ${r.heat} | ${r.title.slice(0, 26)}`);
    rows.forEach((r) => seenSrc.add(r.source));
    titlesByTab[tab] = titles;

    // ---- ② 界面文案：tab 按钮 + <html lang>/dir ----
    ok((await tabLabel()) === LABEL[lang][tab], `${lang}/${tab} tab 文字 = ${LABEL[lang][tab]}`,
      `实际「${await tabLabel()}」`);
    const doc = await p.evaluate(() => ({
      lang: document.documentElement.lang, dir: document.documentElement.dir,
    }));
    ok(doc.lang === lang && doc.dir === "ltr", `${lang}/${tab} <html lang=${lang} dir=ltr>`,
      `实际 lang=${doc.lang} dir=${doc.dir}`);

    // ---- ③ 子站定位纯化：热搜站不该有主站的小组件和条目区 ----
    ok(await p.locator("#widgetsWrap").isHidden(), `${lang}/${tab} #widgetsWrap 已隐藏`);
    ok(await p.locator("#entries").isHidden(), `${lang}/${tab} #entries 已隐藏`);

    // 只截首屏一屏，不截整列长图。
    //   上面刚滚到底 4 次做过重复检测，此时 #feed 已经被加载到很后面：
    //   百度榜会撑到 15000+ px / 11 MB，比另两榜高 2.4 倍——不是渲染问题，
    //   是长图既没法看也没法传。排版对不对首屏就能看出来，而首屏正是用户第一眼。
    await p.evaluate(() => {
      const f = document.querySelector("#feed");
      if (f) window.scrollTo(0, f.getBoundingClientRect().top + window.scrollY - 72);
    });
    await p.waitForTimeout(400);
    const fb = await p.locator("#feed").boundingBox();
    const vh = p.viewportSize().height;
    await p.screenshot({
      path: `shot-hot-${lang}-${tab}.png`,
      clip: { x: fb.x, y: Math.max(0, fb.y), width: fb.width, height: Math.min(fb.height, vh - Math.max(0, fb.y)) },
    });
  }

  // ---- ④ 跨 tab：三榜互不相同，且内容真的不一样 ----
  // 光「源名不同」不够：万一是同一批条目换了个 label 渲染，三张截图看着像三榜，
  // 实际是复读。这里用标题集合的 Jaccard 相似度兜底。
  ok(seenSrc.size === 3, `${lang} 三榜源名互不相同`, [...seenSrc].join(" / "));

  const jac = (a, b) => {
    const A = new Set(a), B = new Set(b);
    const inter = [...A].filter((x) => B.has(x)).length;
    const uni = new Set([...A, ...B]).size;
    return uni ? inter / uni : 0;
  };
  const pairs = [["weibo", "baidu"], ["weibo", "douyin"], ["baidu", "douyin"]];
  for (const [x, y] of pairs) {
    const s = jac(titlesByTab[x], titlesByTab[y]);
    ok(s < 0.6, `${lang} ${x}∩${y} 内容重合度 < 0.6`, `Jaccard=${s.toFixed(3)}（${titlesByTab[x].length} vs ${titlesByTab[y].length} 条）`);
  }

  // 首屏截图。必须先滚回顶部：上面刚做完「滚到底」测试，页面停在末尾，
  // 直接拍只会拍到最后一屏的尾巴 —— 顶栏、tab 栏、页面首屏的排版全看不到，
  // 而那恰恰是出图给人眼过一遍最该看的部分。
  // 名字用 -top- 而不是 -full-：这是视口首屏，不是整页长图，
  // 而且此时停在上一个 tab（douyin）上，叫 full 会让人以为三榜都在里面。
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(600);
  await p.screenshot({ path: `shot-hot-top-${lang}.png`, fullPage: false });

  // ---- ⑤ 站点标识的语言现状（诊断，不判定）----
  // 顶栏三段各自的语言来源是三条独立的路径，混起来看才知道问题在哪：
  //   站名 siteName    app.js:489  `code === "en" ? titleEn : title`  ← 只认 en
  //   副标 bSub        走 I18N，19 语齐全
  //   标语 tagline     app.js:506  cn(zh+zh-Hant) ? tagline : taglineEn  ← 认繁简
  // 结果：ja 下是「中文站名 + 日文副标 + 英文标语」三语混搭，
  //       按钮/分类/tab 全是日文，只有标语没跟上。
  // 这是**已知取舍**（app.js:496 注释明说子站只有中英两句，非中英回落英文），
  // 四个子站 ai/news/game/hot 全都这样，不是 hot 独有。
  // 这里只打出来不判 fail：补齐 17 种语言的 slogan 是内容决策，
  // 不该由测试脚本替产品拍板。但让它每轮都显形，避免无声漂移。
  const brand = await p.evaluate(() => ({
    site: (document.querySelector('[data-brand="main"]') || {}).textContent || "",
    sub: (document.querySelector('[data-brand="sub"]') || {}).textContent || "",
    tag: (document.querySelector(".tagline") || {}).textContent || "",
  }));
  // 判断「这段标语是不是当前界面语言」：按语言的**书写系统**判定，而不是按语言码。
  // 拉丁字母系（en/es/fr/de/pt/vi/id…）在脚本上无法区分本地化与否，
  // 那几种语言一律不判 —— 报个「无法判定」比给个假绿/假红诚实。
  const SCRIPT = {
    zh: /[\u4e00-\u9fff]/, "zh-Hant": /[\u4e00-\u9fff]/,
    ja: /[\u3040-\u30ff\u4e00-\u9fff]/,     // 假名（允许夹汉字，标语常这么写）
    ru: /[\u0400-\u04ff]/, ar: /[\u0600-\u06ff]/, th: /[\u0e00-\u0e7f]/,
  };
  const re = SCRIPT[lang];
  const tagOK = !re ? null : re.test(brand.tag);
  const flag = tagOK === null ? "" : tagOK ? "" : "  ← 标语未本地化（沿用英文文案）";
  console.log(`    标识: 站名「${brand.site.trim()}」副标「${brand.sub.trim()}」标语「${brand.tag.trim()}」${flag}`);
}

console.log("");
ok(errs.length === 0, "无页面错误", errs.join(" | "));
console.log(`\n${fail ? "✗" : "✓"} hotshot: ${pass} 通过 / ${fail} 失败`);
await b.close();
process.exit(fail ? 1 : 0);