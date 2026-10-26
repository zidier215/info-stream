// hosttest.mjs —— 验证三站 HTML 外壳：标题/描述/canonical/robots/配置注入
import { readFileSync } from "node:fs";
import { onRequest as indexFn } from "./functions/index.js";
import { onRequest as robotsFn } from "./functions/robots.txt.js";
import { onRequest as sitemapFn } from "./functions/sitemap.xml.js";

const RAW = readFileSync(new URL("./index.html", import.meta.url), "utf8");

// 用真实的 index.html 作为静态资源响应
const env = {
  ASSETS: {
    async fetch(req) {
      const u = new URL(req.url);
      if (u.pathname === "/index.html" || u.pathname === "/") {
        return new Response(RAW, { status: 200, headers: { "Content-Type": "text/html" } });
      }
      return new Response("Not Found", { status: 404 });
    },
  },
};

const req = (host, path = "/") =>
  new Request(`https://${host}${path}`, { headers: { host } });

let fail = 0;
const check = (ok, label, extra = "") => {
  if (!ok) fail++;
  console.log(`  ${ok ? "OK  " : "FAIL"} ${label}${extra ? "  " + extra : ""}`);
};

const HOSTS = [
  ["myinfostream.com", "main", "信息河"],
  ["ai.myinfostream.com", "ai", "AI 情报站"],
  ["news.myinfostream.com", "news", "InfoStream"], // defaultLang=en -> 英文标题
  ["game.myinfostream.com", "game", "游戏站"],
  ["hot.myinfostream.com", "hot", "热搜站"],
];

for (const [host, key, expectName] of HOSTS) {
  console.log(`\n===== ${host} =====`);
  const res = await indexFn({ request: req(host), env });
  const html = await res.text();

  check(res.status === 200, "HTTP 200");
  check(res.headers.get("X-InfoStream-Site") === key, `X-InfoStream-Site=${key}`,
    res.headers.get("X-InfoStream-Site") || "");
  check(res.headers.get("Cache-Control").includes("no-store") === false, "正式域不 no-store");

  // title 必须含站点名，不能是模板里的旧标题
  const title = (html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || "";
  check(title.includes(expectName), `title 含「${expectName}」`, title);

  // canonical 必须指向自己的域名（这是三站不抢权重的前提）
  const canon = (html.match(/<link rel="canonical" href="([^"]+)"/i) || [])[1] || "";
  check(canon === `https://${host}/`, `canonical 指向本域`, canon);

  // description 必须各不相同（重复 description 是最常见的子站 SEO 事故）
  const desc = (html.match(/<meta name="description" content="([^"]*)"/i) || [])[1] || "";
  check(desc.length > 20, "description 非空", desc.slice(0, 40) + "...");

  // robots 正式域应为 index
  const robots = (html.match(/<meta name="robots" content="([^"]*)"/i) || [])[1] || "";
  check(robots.includes("index"), "robots=index", robots);

  // 配置注入
  const cfgM = html.match(/window\.__HOST_CONFIG__ = ([\s\S]*?);<\/script>/);
  check(!!cfgM, "注入 __HOST_CONFIG__");
  if (cfgM) {
    const cfg = JSON.parse(cfgM[1]);
    check(cfg.key === key, `cfg.key=${key}`, cfg.key);
    check(cfg.host === host, `cfg.host=${host}`);
    check(cfg.mode === (key === "main" ? "portal" : "topic"), `cfg.mode=${cfg.mode}`);
    check(Array.isArray(cfg.tabs) && cfg.tabs.length > 0, `tabs ${cfg.tabs.length} 个`,
      cfg.tabs.map((t) => t.id).join(","));
    // tab 必须声明 sources，否则前端无从判断该拉什么
    const noSrc = cfg.tabs.filter((t) => !Array.isArray(t.sources) || !t.sources.length);
    check(noSrc.length === 0, "每个 tab 都带 sources",
      noSrc.map((t) => t.id).join(","));

    // langs 必须是前端真能渲染的子集。这条以前没人守，结果 hosts.js 声明过 ko，
    // 而 I18N 里没有 ko —— ?lang=ko 会过校验、回落简体、<html lang> 却还挂着 ko，
    // 页面语言声明与内容不符。宁可 hosts.js 少写，也别让它写前端不会的。
    check(Array.isArray(cfg.langs) && cfg.langs.length > 0, `langs ${(cfg.langs || []).length} 个`);
    check(cfg.defaultLang && cfg.langs.includes(cfg.defaultLang),
      "defaultLang 在 langs 内", cfg.defaultLang);

    // tagline 必须按站点给。子站共用主站那句「滚动不息·多源聚合」，
    // 用户看不出这个域名是干什么的 —— 这是子域架构最容易漏的一处。
    check(!!cfg.tagline, "注入 tagline(中文)", (cfg.tagline || "").slice(0, 30));
    check(!!cfg.taglineEn, "注入 taglineEn(英文)", (cfg.taglineEn || "").slice(0, 30));
  }

  // ---- 前端 DOM 契约：app.js 按这些 id/属性找元素，对不上就是白屏 ----
  check(/id="tabs"/.test(html), "有 <nav id=tabs>");
  check(/id="entries"/.test(html), "有 <section id=entries>");
  check(/id="widgetsWrap"/.test(html), "有 widgetsWrap（子站要整段 hidden）");
  // app.js 读的是 data-widget；写成 data-cat 会让刷新按钮读出 undefined
  const wRefresh = [...html.matchAll(/class="mini-btn w-refresh" data-(\w+)="([^"]+)"/g)];
  check(wRefresh.length === 2, "2 个 w-refresh 按钮", String(wRefresh.length));
  check(wRefresh.every((m) => m[1] === "widget"), "w-refresh 用 data-widget 而非 data-cat",
    wRefresh.map((m) => `${m[1]}=${m[2]}`).join(" "));
  // 旧的 id="chips" 必须消失，否则 app.js 的 tabsEl 为 null，一行 buildTabs 就崩
  check(!/id="chips"/.test(html), "旧 id=chips 已移除");

  // canonical 必须是本域。注意这里不能简单查 "myinfostream.com/" 字样 ——
  // 兄弟站互链（hreflang="x-sibling"）本来就该指向另外两个域，那是刻意为之。
  // 真正要防的是「rel=canonical 还指向别人」。
  const canonTags = [...html.matchAll(/<link rel="canonical" href="([^"]+)"/gi)].map((m) => m[1]);
  check(canonTags.length === 1 && canonTags[0] === `https://${host}/`,
    "只有一条 canonical 且指向本域", canonTags.join(","));

  // og:image 必须用本域绝对地址，否则社交平台会把子站分享判给主站
  const ogImg = (html.match(/<meta property="og:image" content="([^"]*)"/i) || [])[1] || "";
  check(ogImg === `https://${host}/favicon.svg`, "og:image 指向本域", ogImg);

  // robots.txt
  const rb = await (await robotsFn({ request: req(host, "/robots.txt"), env })).text();
  check(rb.includes(`Sitemap: https://${host}/sitemap.xml`), "robots.txt 指向本站 sitemap");
  check(rb.includes("Disallow: /api/"), "robots.txt 屏蔽 /api/");

  // sitemap
  const sm = await (await sitemapFn({ request: req(host, "/sitemap.xml"), env })).text();
  check(sm.includes(`<loc>https://${host}/</loc>`), "sitemap 含本站根 URL");
  check(!sm.includes("&amp;") || !sm.includes("&"), "sitemap 转义正确");
}

// ---- 预览域名应 noindex ----
console.log(`\n===== xxx.pages.dev（预览） =====`);
const pv = await indexFn({ request: req("hao-feed.pages.dev"), env });
const pvHtml = await pv.text();
check(pv.headers.get("Cache-Control").includes("no-store"), "预览域 no-store");
const pvRobots = (pvHtml.match(/<meta name="robots" content="([^"]*)"/i) || [])[1] || "";
check(pvRobots.includes("noindex"), "预览域 noindex", pvRobots);
check(!pvHtml.includes('rel="sitemap"'), "预览域不出 sitemap 链接");
const pvSitemap = await (await sitemapFn({ request: req("hao-feed.pages.dev", "/sitemap.xml"), env })).text();
check(pvSitemap.includes("<urlset") && !pvSitemap.includes("<url>"), "预览域 sitemap 为空");

// ---- 静态资源应透传 ----
console.log(`\n===== 静态资源透传 =====`);
const asset = await indexFn({ request: req("myinfostream.com", "/assets/app.js"), env });
check(asset.status === 404, "未知静态资源透传给 ASSETS（由 CDN 决定）", "HTTP " + asset.status);

// ---- 各站 description / tagline 去重 ----
// 用词随站点数量走：早先硬编码「三站」，加到五站后这条断言的文案会变成误导。
console.log(`\n===== ${HOSTS.length} 站 description / tagline 去重 =====`);
const descs = [];
const tags = [];
for (const [host] of HOSTS) {
  const h = await (await indexFn({ request: req(host), env })).text();
  descs.push((h.match(/<meta name="description" content="([^"]*)"/i) || [])[1] || "");
  const m = h.match(/window\.__HOST_CONFIG__ = ([\s\S]*?);<\/script>/);
  const c = m ? JSON.parse(m[1]) : {};
  tags.push(c.tagline || "");
}
const uniq = new Set(descs);
check(uniq.size === descs.length, `${HOSTS.length} 站 description 互不相同 (${uniq.size}/${descs.length})`);
check(descs.every((d) => d && d.length > 20), `${HOSTS.length} 站 description 均非空`);
check(new Set(tags).size === tags.length, `${HOSTS.length} 站 tagline 互不相同 (${new Set(tags).size}/${tags.length})`,
  tags.join(" | "));

// ---- hosts.js 声明的 langs 必须在 app.js 的 LANGS 里收录 ----
// 前端 app.js 是静态资源，这里读本地文件做静态校验。
const appJs = readFileSync(new URL("./assets/app.js", import.meta.url), "utf8");
const LANGS_BLOCK = appJs.slice(appJs.indexOf("const LANGS = ["), appJs.indexOf("];", appJs.indexOf("const LANGS = [")));
const known = new Set([...LANGS_BLOCK.matchAll(/code:\s*"([^"]+)"/g)].map((m) => m[1]));
console.log(`\n===== langs 声明与实现对齐 =====`);
for (const [host] of HOSTS) {
  const h = await (await indexFn({ request: req(host), env })).text();
  const m = h.match(/window\.__HOST_CONFIG__ = ([\s\S]*?);<\/script>/);
  const declared = JSON.parse(m[1]).langs || [];
  const ghost = declared.filter((c) => !known.has(c));
  check(ghost.length === 0, `${host} 声明的语言前端都能渲染`,
    ghost.length ? `幽灵语言: ${ghost.join(",")}` : `${declared.length} 个全部对齐`);
}

// ---- 子站互链完整性 ----
// 为什么值得单列一组断言：siblings 是纯手写数组，加站时最容易漏。
// 漏一个方向不会让页面报错（href 照样渲染，只是那个方向走不通），
// 但它会让搜索引擎把几个子站当成互不相关的独立站 —— 而子域策略的全部
// 意义就是「一组互链的垂直站」。
console.log(`\n===== 子站互链完整性 =====`);
const cfgs = {};
for (const [host] of HOSTS) {
  const h = await (await indexFn({ request: req(host), env })).text();
  const m = h.match(/window\.__HOST_CONFIG__ = ([\s\S]*?);<\/script>/);
  cfgs[host] = m ? JSON.parse(m[1]) : {};
}
const allHosts = HOSTS.map(([h]) => h);
const mainHost = "myinfostream.com";
for (const host of allHosts) {
  const sibs = cfgs[host].siblings || [];
  check(!sibs.includes(host), `${host} 不把自己列为 sibling`);
  const unknown = sibs.filter((s) => !allHosts.includes(s));
  check(unknown.length === 0, `${host} 的 sibling 全部是已定义站点`, unknown.join(","));
  // 双向可达：这条才是「互链」而不是「单向链」
  const asymmetric = sibs.filter((s) => !(cfgs[s] && (cfgs[s].siblings || []).includes(host)));
  check(asymmetric.length === 0, `${host} 的互链是双向的`, asymmetric.join(","));
}
// 主站必须给每个子站都留入口，否则新站从搜索结果进来没有任何站内出口
const entryHosts = (cfgs[mainHost].entries || []).map((e) => e.host);
const noEntry = allHosts.filter((h) => h !== mainHost && !entryHosts.includes(h));
check(noEntry.length === 0, `主站覆盖全部 ${allHosts.length - 1} 个子站入口`, noEntry.join(","));

// ---- tab / 入口的 i18n 键必须在 app.js 里十语种齐全 ----
// hosts.js 里的 i18n 只是键名，真正的文案在 app.js 的 UI_I18N。加了新站
// 却忘了补文案时，页面不会报错，只会在该语言下显示裸键名（见 uiText 的
// 回落逻辑）—— 这种「静默降级」只能靠静态断言挡住。
console.log(`\n===== i18n 键覆盖率 =====`);
const i18nKeys = [...new Set(allHosts.flatMap((h) =>
  (cfgs[h].tabs || []).map((t) => t.i18n).concat((cfgs[h].entries || []).map((e) => e.i18n), (cfgs[h].entries || []).map((e) => e.i18n + "Desc")),
))];
const L10N = ["zh", "zh-Hant", "en", "es", "fr", "ja", "de", "ru", "ar", "pt"];
for (const k of i18nKeys) {
  const m = appJs.match(new RegExp("^\\s*" + k + "\\s*:\\s*\\{([^}]*)\\}", "m"));
  if (!m) { check(false, `i18n 键 ${k} 存在于 app.js`); continue; }
  const missing = L10N.filter((l) => !new RegExp(`["']?${l}["']?\\s*:`).test(m[1]));
  const blank = L10N.filter((l) => new RegExp(`["']?${l}["']?\\s*:\\s*["']?\\s*["']?\\s*,`).test(m[1]));
  check(missing.length === 0, `${k} 十语种齐全`, missing.length ? "缺: " + missing.join(",") : "");
  check(blank.length === 0, `${k} 无空文案`, blank.length ? "空: " + blank.join(",") : "");
}

console.log(`\n${fail === 0 ? "全部通过" : fail + " 项不达标"}`);
process.exit(fail === 0 ? 0 : 1);