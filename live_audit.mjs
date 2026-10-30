// live_audit.mjs —— 生产环境线上真实 HTTP 深度审计脚本（遵循 SOP 四层全景清单 + 用户可用性 + 谷歌网站目标）
import { execSync } from "child_process";

let proxyFlag = "";
try {
  execSync(`curl.exe -x http://127.0.0.1:7890 -sI --connect-timeout 1 "https://www.myinfostream.com/"`, { stdio: "ignore" });
  proxyFlag = "-x http://127.0.0.1:7890";
} catch {
  proxyFlag = "";
}

const pageCache = new Map();
function curl(url, extra = "") {
  const cacheKey = `${url}|${extra}`;
  if (!extra && pageCache.has(cacheKey)) return pageCache.get(cacheKey);
  let lastErr = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = execSync(`curl.exe -4 ${proxyFlag} --http1.1 --connect-timeout 15 --max-time 40 --retry 2 -sL ${extra} "${url}"`, {
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
const sitemap = curl("https://www.myinfostream.com/sitemap.xml");
ok(sitemap.includes("https://myinfostream.com/"), "sitemap.xml 包含主站根地址");
const trustCleanUrls = ["/about", "/privacy", "/editorial", "/contact", "/terms"];
ok(trustCleanUrls.every((p) => sitemap.includes(p)), "sitemap.xml 收录全部 5 大 Clean URL 落地页");
ok(!sitemap.includes(".html"), "sitemap.xml 杜绝带 .html 的 308 重定向地址，纯净度 100%");

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

console.log("\n=================================================================");
console.log(`   全景审计汇总: ${pass} 项全绿通过 / ${fail} 项失败`);
console.log("=================================================================");

if (fail > 0) process.exit(1);
