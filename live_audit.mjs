// live_audit.mjs —— 生产环境线上真实 HTTP 深度审计脚本（遵循 SOP 四层全景清单 + 用户可用性 + 谷歌网站目标）
import { execSync } from "child_process";

const proxyFlag = "";

const pageCache = new Map();
function curl(url, extra = "") {
  const cacheKey = `${url}|${extra}`;
  if (!extra && pageCache.has(cacheKey)) return pageCache.get(cacheKey);
  let lastErr = null;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const res = execSync(`curl.exe -4 ${proxyFlag} --compressed --http1.1 --connect-timeout 15 --max-time 60 -f -sL ${extra} "${url}"`, {
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
      });
      if (!extra) pageCache.set(cacheKey, res);
      return res;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

const headerCache = new Map();
function curlHeaders(url) {
  if (headerCache.has(url)) return headerCache.get(url);
  let lastErr = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = execSync(`curl.exe -4 ${proxyFlag} --http1.1 --connect-timeout 15 --max-time 35 --retry 2 -sI "${url}"`, {
        encoding: "utf8",
      });
      headerCache.set(url, res);
      return res;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

console.log("=================================================================");
console.log("   生产环境线上真实 HTTP 全景审计 (SOP + 用户可用性 + 谷歌目标)   ");
console.log("=================================================================\n");

let pass = 0, fail = 0;
const ok = (cond, msg, detail = "") => {
  if (cond) {
    pass++;
    console.log(`  ✓ OK   ${msg}`);
  } else {
    fail++;
    console.log(`  ✗ FAIL ${msg} -> ${detail}`);
  }
};

// ---------------- 第一层：生产网络与边缘路由层 ----------------
console.log("【第一层：生产网络与边缘路由层（SOP 基础技术硬伤核查）】");

// 1. 软 404 真实拦截 (Anti Soft-404)
const notFoundUrl = "https://www.myinfostream.com/non-existent-anti-soft-404-" + Date.now();
const h404 = curlHeaders(notFoundUrl);
const statusLine404 = h404.split(/\r?\n/).filter((l) => l.startsWith("HTTP/")).pop() || "";
ok(statusLine404.includes("404"), "不存在路径返回真实 HTTP 404 状态码", statusLine404);
const html404 = curl("https://www.myinfostream.com/404.html");
ok(h404.toLowerCase().includes("noindex") || html404.includes("noindex"), "404 包含 noindex 标头或元标签，杜绝搜索引擎权重流失");

// 2. Clean URL 与 Canonical 规范标签对齐（杜绝 308 重定向冲突）
for (const p of ["about", "privacy", "editorial", "contact", "terms"]) {
  const pageHtml = curl(`https://www.myinfostream.com/${p}`);
  ok(pageHtml.includes(`rel="canonical" href="https://myinfostream.com/${p}"`), `/${p} 的 Canonical 规范标签与 200 Clean URL 完全对齐（无 .html 后缀冲突）`);
}

// 3. 首页 Canonical 规范化
const mainHtml = curl("https://www.myinfostream.com/");
ok(mainHtml.includes('rel="canonical" href="https://myinfostream.com/"'), "首页 Canonical 严格指向根域名 https://myinfostream.com/（非 /index.html）");

// 4. 边缘缓存与安全标头匹配（Clean URL 下缓存与安全指令验证）
const hAbout = curlHeaders("https://www.myinfostream.com/about");
ok(hAbout.includes("Cache-Control:") || hAbout.includes("cache-control:"), "Clean URL 页面正常返回 Cache-Control 缓存指令");
ok(hAbout.toLowerCase().includes("x-content-type-options: nosniff"), "边缘响应包含 X-Content-Type-Options: nosniff 安全防护头");
ok(hAbout.toLowerCase().includes("strict-origin-when-cross-origin"), "边缘响应包含 Referrer-Policy: strict-origin-when-cross-origin 规范头");

// ---------------- 第二层：Google AdSense 与搜索引擎准入层 ----------------
console.log("\n【第二层：Google AdSense 与搜索引擎准入层（一票否决项）】");

// 1. ads.txt 权威性与双域直出
const adsWww = curl("https://www.myinfostream.com/ads.txt");
const adsApex = curl("https://myinfostream.com/ads.txt");
const adsHeaders = curlHeaders("https://www.myinfostream.com/ads.txt");
const adsExpected = "google.com, pub-1130777358854864, DIRECT, f08c47fec0942fa0";
ok(adsWww.trim() === adsExpected, "www.myinfostream.com/ads.txt 严格匹配发布商规范代码");
ok(adsApex.trim() === adsExpected, "myinfostream.com/ads.txt Apex 主域严格匹配发布商规范代码");
ok(adsHeaders.toLowerCase().includes("text/plain"), "ads.txt 返回标准的 Content-Type: text/plain 标头");

// 2. 全局 AdSense 双重验证部署 (Meta + Async Script)
ok(mainHtml.includes('<meta name="google-adsense-account" content="ca-pub-1130777358854864"'), "主站 <head> 部署 AdSense 发布商账号 Meta 验证标记");
ok(mainHtml.includes("https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1130777358854864"), "主站 <head> 部署 AdSense 异步 JS 加载脚本");

// 3. robots.txt 抓取权限
const robots = curl("https://www.myinfostream.com/robots.txt");
ok(robots.includes("Mediapartners-Google"), "robots.txt 明确放行 Mediapartners-Google 审核爬虫");
ok(robots.includes("Googlebot"), "robots.txt 明确放行 Googlebot 搜索爬虫");
ok(robots.includes("Sitemap:"), "robots.txt 正确指引 Sitemap 索引文件");

// 4. sitemap.xml 纯净度（无 308 重定向与 404 污染）
const sitemap = curl("https://myinfostream.com/sitemap.xml");
ok(sitemap.includes("https://myinfostream.com/"), "sitemap.xml 包含主站根地址");
const trustCleanUrls = ["/about", "/privacy", "/editorial", "/contact", "/terms"];
ok(trustCleanUrls.every((p) => sitemap.includes(p)), "sitemap.xml 收录全部 5 大 Clean URL 落地页");
ok(["/papers", "/models", "/games", "/trends"].every((p) => sitemap.includes(`https://myinfostream.com${p}`)), "主站 sitemap.xml 完整收录本域 4 大深度数据库落地页 (/papers, /models, /games, /trends)");
ok(!sitemap.includes("ai.myinfostream.com"), "主站 sitemap.xml 严守 RFC 规范，不包含跨子域 URL");
ok(!sitemap.includes(".html"), "sitemap.xml 杜绝带 .html 的 308 重定向地址，纯净度 100%");
const aiSitemap = curl("https://ai.myinfostream.com/sitemap.xml");
ok(aiSitemap.includes("https://ai.myinfostream.com/") && !aiSitemap.includes("/about"), "子域名 sitemap.xml 仅收录本域 Canonical 根地址，杜绝跨站非 Canonical 冲突");
ok(aiSitemap.includes("https://ai.myinfostream.com/papers"), "AI 子域 sitemap.xml 完整收录 AI 论文档案专区落地页");
ok(aiSitemap.includes("https://ai.myinfostream.com/papers?week=2026-W45"), "AI 子域 sitemap.xml 完整收录最新 2026-W45 周刊归档 URL");

// 5. 独立 GDPR / Cookie / DoubleClick 隐私政策
const privacyHtml = curl("https://www.myinfostream.com/privacy");
ok(privacyHtml.includes("Google AdSense"), "隐私政策明示 Google AdSense 商业广告服务");
ok(privacyHtml.includes("DoubleClick"), "隐私政策声明 DoubleClick Cookie 追踪与个性化规范");
ok(privacyHtml.includes("adssettings.google.com"), "隐私政策提供 Google 广告偏好退出渠道");

// ---------------- 第三层：E-E-A-T 实体信任与法律基石 ----------------
console.log("\n【第三层：E-E-A-T 实体信任、结构化数据、合规落地页与跨站矩阵】");

function hasOfficialEmail(html) {
  if (html.includes("contact@myinfostream.com")) return true;
  // Cloudflare Scrape Shield email decode 兼容
  const m = html.match(/data-cfemail="([0-9a-fA-F]+)"/);
  if (m) {
    const hex = m[1];
    const k = parseInt(hex.slice(0, 2), 16);
    let str = "";
    for (let i = 2; i < hex.length; i += 2) {
      str += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ k);
    }
    if (str.includes("contact@myinfostream.com")) return true;
  }
  return false;
}

for (const p of ["about", "privacy", "editorial", "contact", "terms"]) {
  const html = curl(`https://www.myinfostream.com/${p}`);
  ok(hasOfficialEmail(html), `/${p} 页面明示官方域名邮箱 contact@myinfostream.com`);
  ok(!html.includes("shitou215@"), `/${p} 页面杜绝任何个人私密邮箱泄漏`);
  ok(html.includes('name="google-adsense-account" content="ca-pub-1130777358854864"'), `/${p} 页面部署 AdSense 发布商 Meta 验证标记`);
}

// 结构化数据 (Schema.org WebSite + Organization + sameAs 矩阵)
ok(mainHtml.includes('"@type": "WebSite"'), "主站 HTML 包含 Schema.org WebSite 结构化数据");
ok(mainHtml.includes('"publisher"') && mainHtml.includes('"@type": "Organization"'), "主站 Schema 规范定义了 publisher Organization 实体信息");
ok(mainHtml.includes('"sameAs"') && mainHtml.includes("https://calcguide.tech") && mainHtml.includes("https://techminds.cn"), "主站 Schema 包含 sameAs 跨站权威实体矩阵");

// 页脚闭环信任链接与 5 大合规弹窗面板完整性
ok(trustCleanUrls.every((u) => mainHtml.includes(`href="${u}"`)), "首页页脚无缝闭环直达 5 大 Clean URL 信任落地页");
ok(!/class="[^"]*policy-trigger[^"]*"[^>]*href="\/(about|privacy|editorial|contact|terms)"/.test(mainHtml), "首页页脚 5 大合规链接无 JS 弹窗拦截，点击真实跳转独立落地页");
ok((mainHtml.match(/<p class="desc">/g) || []).length >= 10, "主站首屏 SSR 直出 >= 10 条带完整深度摘要的卡片（杜绝纯短标题列表）");
ok(mainHtml.includes('href="https://ai.myinfostream.com/papers"') && mainHtml.includes('href="https://ai.myinfostream.com/models"'), "主站首屏 #entries 导航直出 4 大原创数据库入口（杜绝孤岛页）");
const modalPanes = ["policyTab-privacy", "policyTab-editorial", "policyTab-terms", "policyTab-about", "policyTab-contact"];
ok(modalPanes.every((id) => mainHtml.includes(`id="${id}"`)), "首页合规模态窗完整包含全部 5 大内容面板（含编辑准则）");

// 跨站生态矩阵与姐妹站点互认 (Network & Sister Publications)
const aboutHtml = curl("https://www.myinfostream.com/about");
const sisterDomains = ["https://calcguide.tech", "https://techminds.cn", "https://zidier215.github.io"];
ok(sisterDomains.every((d) => aboutHtml.includes(d) && mainHtml.includes(d)), "首页与 /about 落地页完整建立 Sister Publications 跨站生态矩阵互链");

// ---------------- 第四层：目标用户可用性与体验交互 ----------------
console.log("\n【第四层：目标用户可用性（体验/检索/深色模式/回到顶部）】");

ok(mainHtml.includes('id="themeToggleBtn"'), "顶栏提供深浅主题切换按钮 (Dark/Light Mode)");
ok(mainHtml.includes('id="streamSearch"'), "信息流提供即时搜索与过滤工具栏 (Instant Stream Search)");
ok(mainHtml.includes('id="backToTopBtn"'), "页面具备回到顶部悬浮动作按钮 (Back to Top)");
ok(mainHtml.includes("G-JBQYPMLVHR"), "主站部署 Google Analytics 4 (GA4) 测量代码 (G-JBQYPMLVHR)");
ok(curl("https://www.myinfostream.com/about").includes("G-JBQYPMLVHR"), "合规落地页部署 Google Analytics 4 (GA4) 测量代码 (G-JBQYPMLVHR)");
ok(/styles\.css\?v=[0-9a-f]{8}/.test(mainHtml) && /app\.js\?v=[0-9a-f]{8}/.test(mainHtml), "静态资源 (styles.css / app.js) 注入内容哈希 ?v=<hash> 实现强缓存即时破除");

// ---------------- 第五层：5 大垂直子站专注度与无限流性能 ----------------
console.log("\n【第五层：5 大站点主题专注度、0ms秒开与无限流性能】");

const subs = [
  { host: "myinfostream.com", site: "main", name: "主站" },
  { host: "ai.myinfostream.com", site: "ai", name: "AI 垂直站" },
  { host: "game.myinfostream.com", site: "game", name: "游戏垂直站" },
  { host: "news.myinfostream.com", site: "news", name: "新闻垂直站" },
  { host: "hot.myinfostream.com", site: "hot", name: "热搜垂直站" },
];

for (const s of subs) {
  const h = curlHeaders(`https://${s.host}/`);
  const tag = (h.match(/x-infostream-site:\s*([^\r\n]+)/i) || [])[1];
  ok(tag === s.site, `${s.name} (${s.host}) 路由与 X-InfoStream-Site 准确归属「${s.site}」`, `实际: ${tag}`);
  
  const html = curl(`https://${s.host}/`);
  ok(html.includes("window.__INITIAL_DATA__"), `${s.name} 包含服务端首屏内联快照 (0ms 秒开)`);
  ok(html.includes('<article class="card"'), `${s.name} 首屏 HTML 直出真实 SSR 资讯卡片（防爬虫空壳/低价值判定）`);
  ok(html.includes('id="editorialBriefText"'), `${s.name} 首屏包含频道编辑导读 (Editorial Briefing) 原创价值背书`);
  ok(!html.includes("shitou215@"), `${s.name} HTML 首屏已剔除个人私密邮箱`);
}

// 多页连续无限流分页接口真实响应
const p1Raw = curl("https://www.myinfostream.com/api/feed?tab=brief&page=1&pageSize=15");
const p2Raw = curl("https://www.myinfostream.com/api/feed?tab=brief&page=2&pageSize=15");
const p1 = JSON.parse(p1Raw);
const p2 = JSON.parse(p2Raw);

ok(p1.items && p1.items.length > 0, "API 第 1 页成功返回条目池 (Count=" + p1.items?.length + ")");
ok(p1.total >= 30, "API 条目储备量充足 (Total=" + p1.total + ")");
ok(p1.hasMore === true, "API 第 1 页标有 hasMore=true，支撑无限流持续滚动");
ok(p2.items && p2.items.length > 0, "API 第 2 页成功返回下一批条目 (Count=" + p2.items?.length + ")");
const p1First = p1.items[0]?.title || "";
const p2First = p2.items[0]?.title || "";
ok(p1First !== p2First, "第 1 页与第 2 页内容差异化，真实翻页生效", `P1: [${p1First.slice(0, 16)}] vs P2: [${p2First.slice(0, 16)}]`);

// ---------------- 第六层：AI 论文档案专区与持久化存储体系 ----------------
console.log("\n【第六层：AI 论文档案专区 (Papers Archive) 与持久化存储】");
const papersPageHtml = curl("https://ai.myinfostream.com/papers");
ok(papersPageHtml.includes('rel="canonical" href="https://ai.myinfostream.com/papers"'), "AI 论文档案专区 (/papers) Canonical 正确指向本域落地页");
ok(papersPageHtml.includes('ca-pub-1130777358854864'), "AI 论文档案落地页正确部署 Google AdSense 账号代码");
ok(papersPageHtml.includes("pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1130777358854864"), "AI 论文档案落地页部署 AdSense 异步加载脚本 (adsbygoogle.js)");
ok(papersPageHtml.includes('<article class="entry in"'), "AI 论文档案落地页 SSR 直出真实论文卡片（无「正在加载」空壳）");
ok(trustCleanUrls.every((u) => papersPageHtml.includes(u)), "AI 论文档案落地页页脚包含完整 5 大合规信任链接");
ok(papersPageHtml.includes('id="sparkBars"'), "AI 论文档案落地页包含每日统计动态柱状图容器");
ok(papersPageHtml.includes('id="timelineList"'), "AI 论文档案落地页包含时间轴流容器");

const papersApiRaw = curl("https://ai.myinfostream.com/api/papers?days=7&pageSize=20");
const papersApi = JSON.parse(papersApiRaw);
ok(papersApi.items && papersApi.items.length > 0, "AI 论文档案 API 正常响应 (返回条目数=" + papersApi.items?.length + ")");
ok(papersApi.total >= 40, "AI 论文档案数据储备充足 (总数=" + papersApi.total + ")");
ok(Array.isArray(papersApi.daily) && papersApi.daily.length > 0, "AI 论文档案 API 包含每日分布统计指标");
ok(papersApi.stats && papersApi.stats.sources >= 10, "AI 论文档案信源覆盖丰富 (信源数=" + papersApi.stats?.sources + ")");

const weeksApiRaw = curl("https://ai.myinfostream.com/api/papers?weeks_overview=1");
const weeksApi = JSON.parse(weeksApiRaw);
ok(weeksApi.success === true && weeksApi.weeks?.length >= 40, "AI 论文 2026 全年周刊档案覆盖完整 (可用周数=" + weeksApi.weeks?.length + ")");

const w44ApiRaw = curl("https://ai.myinfostream.com/api/papers?week=2026-W44&pageSize=10");
const w44Api = JSON.parse(w44ApiRaw);
ok(w44Api.stats?.mode === "week" && w44Api.daily?.length === 7, "单周查询返回完整 7 天分布走势 (W44 论文数=" + w44Api.total + ")");


// ---------------- 第七层：Epic 喜加一历史总账本与 D1 边缘存储 ----------------
console.log("\n【第七层：Epic 喜加一历史总账本 (Epic Free Games Archive) 与 D1 边缘存储】");
const gamesPageHtml = curl("https://game.myinfostream.com/history");
ok(gamesPageHtml.includes('rel="canonical" href="https://game.myinfostream.com/history"'), "游戏历史总账本 (/history) Canonical 正确指向本域落地页");
const mainGamesHtml = curl("https://www.myinfostream.com/games");
ok(mainGamesHtml.includes('rel="canonical" href="https://myinfostream.com/games"'), "主站 /games 路径 Canonical 正确自引用为 https://myinfostream.com/games");
ok(gamesPageHtml.includes('ca-pub-1130777358854864'), "游戏历史总账本落地页正确部署 Google AdSense 账号代码");
ok(gamesPageHtml.includes('G-JBQYPMLVHR'), "游戏历史总账本落地页正确部署 GA4 测量代码");
ok(gamesPageHtml.includes('<article class="g-card"'), "游戏历史总账本落地页 SSR 直出真实游戏卡片（消除「共 0 款」空壳）");
ok(gamesPageHtml.includes('id="statGames"'), "游戏历史总账本落地页包含累计白嫖款数看板 (id=statGames)");
ok(gamesPageHtml.includes('id="statUsd"'), "游戏历史总账本落地页包含累计美元价值看板 (id=statUsd)");
ok(gamesPageHtml.includes('id="sparkBars"'), "游戏历史总账本落地页包含历年分布走势柱状图容器 (id=sparkBars)");
ok(gamesPageHtml.includes('id="gamesList"'), "游戏历史总账本落地页包含精美游戏卡片流容器 (id=gamesList)");

const gamesApiOverviewRaw = curl("https://game.myinfostream.com/api/games?overview=1");
const gamesApiOverview = JSON.parse(gamesApiOverviewRaw);
ok(gamesApiOverview.success === true, "Epic 游戏历史 API overview 成功响应");
ok(gamesApiOverview.storage === "d1", "Epic 游戏历史 API 真实接入 Cloudflare D1 边缘数据库 (storage=d1)");
ok(gamesApiOverview.total_games >= 50, "Epic 游戏历史收录大作数充足 (总数=" + gamesApiOverview.total_games + ")");
ok(gamesApiOverview.total_value_usd > 2000, "Epic 游戏累计白嫖总值 > $2,000 USD (总值=$" + gamesApiOverview.total_value_usd + ")");
ok(gamesApiOverview.aaa_count >= 30, "Epic 游戏 3A 殿堂大作数充足 (3A数=" + gamesApiOverview.aaa_count + ")");
ok(Array.isArray(gamesApiOverview.years) && gamesApiOverview.years.length >= 8, "Epic 游戏覆盖 2019-2026 完整 8 年 (覆盖年数=" + gamesApiOverview.years?.length + ")");

const gamesApi2026Raw = curl("https://game.myinfostream.com/api/games?year=2026");
const gamesApi2026 = JSON.parse(gamesApi2026Raw);
ok(gamesApi2026.success === true && gamesApi2026.items?.length >= 10, "Epic 游戏 2026 年份专区正常查询 (2026收录=" + gamesApi2026.items?.length + "款)");

const gameSitemap = curl("https://game.myinfostream.com/sitemap.xml");
ok(gameSitemap.includes("https://game.myinfostream.com/history"), "游戏子域 sitemap.xml 完整收录 /history 历史总账本主入口");
ok(gameSitemap.includes("https://game.myinfostream.com/history?year=2026"), "游戏子域 sitemap.xml 完整收录历年年鉴索引 URL");

// ---------------- 第八层：AI 大模型编年史与跑分评测档案与 D1 边缘存储 ----------------
console.log("\n【第八层：AI 大模型编年史与跑分评测档案 (AI Model Almanac) 与 D1 边缘存储】");
const modelsPageHtml = curl("https://ai.myinfostream.com/models");
ok(modelsPageHtml.includes('rel="canonical" href="https://ai.myinfostream.com/models"'), "大模型编年史 (/models) Canonical 正确指向本域落地页");
ok(modelsPageHtml.includes('ca-pub-1130777358854864'), "大模型编年史落地页正确部署 Google AdSense 账号代码");
ok(modelsPageHtml.includes('G-JBQYPMLVHR'), "大模型编年史落地页正确部署 GA4 测量代码");
ok(modelsPageHtml.includes('<article class="model-card"'), "大模型编年史落地页 SSR 直出真实模型卡片（消除「共 0 款」空壳）");
ok(trustCleanUrls.every((u) => modelsPageHtml.includes(u)), "大模型编年史落地页页脚包含完整 5 大合规信任链接");
ok(modelsPageHtml.includes('id="statModels"'), "大模型编年史落地页包含收录模型数看板 (id=statModels)");
ok(modelsPageHtml.includes('id="statElo"'), "大模型编年史落地页包含最高 Arena ELO 看板 (id=statElo)");
ok(modelsPageHtml.includes('id="sparkBars"'), "大模型编年史落地页包含历年分布走势柱状图容器 (id=sparkBars)");
ok(modelsPageHtml.includes('id="modelsList"'), "大模型编年史落地页包含精美大模型卡片流容器 (id=modelsList)");

const modelsApiOverviewRaw = curl("https://ai.myinfostream.com/api/models?overview=1");
const modelsApiOverview = JSON.parse(modelsApiOverviewRaw);
ok(modelsApiOverview.success === true, "AI 大模型历史 API overview 成功响应");
ok(modelsApiOverview.storage === "d1", "AI 大模型历史 API 真实接入 Cloudflare D1 边缘数据库 (storage=d1)");
ok(modelsApiOverview.total_models >= 40, "AI 大模型收录大作数充足 (总数=" + modelsApiOverview.total_models + ")");
ok(modelsApiOverview.frontier_count >= 20, "AI 大模型 Frontier 旗舰数充足 (Frontier数=" + modelsApiOverview.frontier_count + ")");
ok(modelsApiOverview.open_weights_count >= 20, "AI 大模型开源权重模型数充足 (开源数=" + modelsApiOverview.open_weights_count + ")");
ok(modelsApiOverview.max_elo >= 1350, "AI 大模型最高 LMSYS ELO >= 1350 (最高分=" + modelsApiOverview.max_elo + ")");
ok(modelsApiOverview.max_context >= 1000000, "AI 大模型最大上下文 >= 1M Tokens (最大=" + modelsApiOverview.max_context + ")");
ok(Array.isArray(modelsApiOverview.orgs) && modelsApiOverview.orgs.length >= 6, "AI 大模型覆盖顶尖实验室 >= 6 家 (覆盖=" + modelsApiOverview.orgs?.length + "家)");

const modelsApiDeepSeekRaw = curl("https://ai.myinfostream.com/api/models?org=DeepSeek");
const modelsApiDeepSeek = JSON.parse(modelsApiDeepSeekRaw);
ok(modelsApiDeepSeek.success === true && modelsApiDeepSeek.items?.length >= 4, "DeepSeek 专区查询正常 (收录=" + modelsApiDeepSeek.items?.length + "款)");

const aiSitemapModels = curl("https://ai.myinfostream.com/sitemap.xml");
ok(aiSitemapModels.includes("https://ai.myinfostream.com/models"), "AI 子域 sitemap.xml 完整收录 /models 编年史主入口");
ok(aiSitemapModels.includes("https://ai.myinfostream.com/models?year=2024"), "AI 子域 sitemap.xml 完整收录模型历年年份索引 URL");
ok(aiSitemapModels.includes("https://ai.myinfostream.com/models?org=DeepSeek"), "AI 子域 sitemap.xml 完整收录模型厂商索引 URL");

// ---------------- 第九层：互联网破圈大事件历史通鉴与 D1 边缘存储 ----------------
console.log("\n【第九层：互联网破圈大事件历史通鉴 (Hot Events Almanac) 与 D1 边缘存储】");
const trendsPageHtml = curl("https://hot.myinfostream.com/history");
ok(trendsPageHtml.includes('rel="canonical" href="https://hot.myinfostream.com/history"'), "热搜大事件通鉴 (/history) Canonical 正确指向本域落地页");
const mainTrendsHtml = curl("https://www.myinfostream.com/trends");
ok(mainTrendsHtml.includes('rel="canonical" href="https://myinfostream.com/trends"'), "主站 /trends 路径 Canonical 正确自引用为 https://myinfostream.com/trends");
ok(trendsPageHtml.includes('ca-pub-1130777358854864'), "热搜大事件通鉴落地页正确部署 Google AdSense 账号代码");
ok(trendsPageHtml.includes('G-JBQYPMLVHR'), "热搜大事件通鉴落地页正确部署 GA4 测量代码");
ok(trendsPageHtml.includes('<article class="event-card"'), "热搜大事件通鉴落地页 SSR 直出真实事件卡片（消除「共 0 件」空壳）");
ok(trustCleanUrls.every((u) => trendsPageHtml.includes(u)), "热搜大事件通鉴落地页页脚包含完整 5 大合规信任链接");
ok(trendsPageHtml.includes('id="statEvents"'), "热搜大事件通鉴落地页包含收录大事件数看板 (id=statEvents)");
ok(trendsPageHtml.includes('id="statEpoch"'), "热搜大事件通鉴落地页包含时代历史印记看板 (id=statEpoch)");
ok(trendsPageHtml.includes('id="sparkBars"'), "热搜大事件通鉴落地页包含历年分布走势柱状图容器 (id=sparkBars)");
ok(trendsPageHtml.includes('id="eventsList"'), "热搜大事件通鉴落地页包含精美大事件卡片流容器 (id=eventsList)");

const trendsApiOverviewRaw = curl("https://hot.myinfostream.com/api/trends?overview=1");
const trendsApiOverview = JSON.parse(trendsApiOverviewRaw);
ok(trendsApiOverview.success === true, "热搜大事件 API overview 成功响应");
ok(trendsApiOverview.storage === "d1", "热搜大事件 API 真实接入 Cloudflare D1 边缘数据库 (storage=d1)");
ok(trendsApiOverview.total_events >= 35, "热搜大事件收录总数充足 (总数=" + trendsApiOverview.total_events + ")");
ok(trendsApiOverview.epoch_count >= 15, "时代历史印记事件数充足 (时代级=" + trendsApiOverview.epoch_count + ")");
ok(trendsApiOverview.peak_heat_max >= 90000000, "全网最高峰值热度 >= 9000万 (最高=" + trendsApiOverview.peak_heat_max + ")");
ok(Array.isArray(trendsApiOverview.categories) && trendsApiOverview.categories.length >= 4, "涵盖核心领域 >= 4 个 (领域数=" + trendsApiOverview.categories?.length + ")");
ok(Array.isArray(trendsApiOverview.years) && trendsApiOverview.years.length >= 6, "跨越年份完整 2020-2026 (跨度=" + trendsApiOverview.years?.length + "年)");

const trendsApiTechRaw = curl("https://hot.myinfostream.com/api/trends?category=tech");
const trendsApiTech = JSON.parse(trendsApiTechRaw);
ok(trendsApiTech.success === true && trendsApiTech.items?.length >= 5, "科技突破专区查询正常 (收录=" + trendsApiTech.items?.length + "件)");

const hotSitemap = curl("https://hot.myinfostream.com/sitemap.xml");
ok(hotSitemap.includes("https://hot.myinfostream.com/history"), "热搜子域 sitemap.xml 完整收录 /history 通鉴主入口");
ok(hotSitemap.includes("https://hot.myinfostream.com/history?year=2024"), "热搜子域 sitemap.xml 完整收录历年年份索引 URL");
ok(hotSitemap.includes("https://hot.myinfostream.com/history?category=tech"), "热搜子域 sitemap.xml 完整收录领域分类索引 URL");

console.log("\n=================================================================");
console.log(`   全景审计汇总: ${pass} 项全绿通过 / ${fail} 项失败`);
console.log("=================================================================");

if (fail > 0) process.exit(1);
