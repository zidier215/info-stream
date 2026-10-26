// functions/_lib/hosts.js
// ---------------------------------------------------------------------------
// 多域名 host 配置表 —— 全站唯一真相源（single source of truth）。
//
// 一个 Cloudflare Pages 项目同时服务五个域名，靠 Host 头切换「站点形态」：
//   myinfostream.com          主站：简报 + 专题入口卡片（不再是无差别瀑布流）
//   ai.myinfostream.com       AI 专题站：大模型 / 芯片算力 / AI 商业 / 论文
//   news.myinfostream.com     国际新闻站：英 / 西 / 法 / 阿 / 俄 五语种严肃媒体
//   game.myinfostream.com     游戏站：Epic 免费领取（本周 / 即将 / 长期三态）
//   hot.myinfostream.com      热搜站：微博 / 百度 / 抖音 三榜实时热搜
//
// 为什么要 host 切换而不是路径切换（/ai/、/news/）：
//   1. SEO —— 每个域名一个独立站点，canonical / robots / sitemap 各自独立，
//      搜索引擎不会把子目录当成主站的重复内容。这叫「子域即独立站点」。
//   2. 隔离 —— 各站可挂不同的 Cloudflare WAF 规则、不同的缓存策略。
//   3. 成本 —— 同一个 Pages 项目、同一次构建、同一份代码，没有额外部署。
//
// 绑定方式（需你在控制台操作一次）：
//   Pages → hao-feed → Settings → Domains & Routes → Add a custom domain
//   分别加 ai / news / game / hot 四个 myinfostream.com 子域。
//   域名 NS 已托管在 Cloudflare 时，DNS 记录会自动创建，证书自动签发。
// ---------------------------------------------------------------------------

/** 主站标识 */
export const MAIN_HOST = "myinfostream.com";

/**
 * 每个站点的完整配置。
 * fields:
 *   key子域短名 / host 域名 / title 标题 / titleEn 英文标题
 *   desc / descEn 描述（用于 meta description 与 og）
 *   defaultLang 默认语言 / langs 支持的语言（前端下拉）
 *   tabs 顶部 Tab 列表，每个 tab 声明自己的数据源组合
 *   siblings 站内互链（用于页脚与入口卡片）
 */
export const HOSTS = {
  "myinfostream.com": {
    key: "main",
    host: "myinfostream.com",
    title: "信息河",
    titleEn: "InfoStream",
    desc: "全球信息简报：境内热搜、国际要闻、AI 动态、市场天气，一屏看完，不做信息过载。",
    descEn: "A global briefing: China trending, world news, AI, markets and weather — one screen, zero overload.",
    // tagline 是浏览器标签下方那行小字。三站各写一句：主站讲「聚合」，
    // 子站讲「专注」—— 让用户一眼看出这个域名是干什么的。
    tagline: "滚动不息 · 多源聚合 · 全球信息，为你而生",
    taglineEn: "Endless stream · Multi-source · Global info, made for you",
    defaultLang: "zh",
    langs: ["zh", "zh-Hant", "en", "es", "fr", "ja", "pt", "de", "ru", "ar", "vi", "th", "id", "sw", "ca", "eu", "cy", "gl", "eo"],
    // 主站 = 简报 + 入口，不再把所有类目混成一条瀑布流
    tabs: [
      { id: "brief", i18n: "brief", sources: ["brief-cn", "brief-world", "brief-ai", "brief-life"] },
      { id: "world", i18n: "world", sources: ["world-en", "world-es", "world-fr", "world-ar", "world-ru"] },
      { id: "ai", i18n: "ai", sources: ["ai-news", "ai-papers", "ai-intl"] },
      { id: "fun", i18n: "fun", sources: ["fun-cn", "fun-intl"] },
    ],
    entries: [
      { host: "ai.myinfostream.com", key: "ai", i18n: "entryAi", fallback: "AI 情报站", fallbackEn: "AI Intelligence" },
      { host: "news.myinfostream.com", key: "news", i18n: "entryNews", fallback: "国际新闻站", fallbackEn: "World News" },
      { host: "game.myinfostream.com", key: "game", i18n: "entryGame", fallback: "游戏站", fallbackEn: "Free Games" },
      { host: "hot.myinfostream.com", key: "hot", i18n: "entryHot", fallback: "热搜站", fallbackEn: "Trending" },
    ],
    siblings: ["ai.myinfostream.com", "news.myinfostream.com", "game.myinfostream.com", "hot.myinfostream.com"],
    isMain: true,
  },

  "ai.myinfostream.com": {
    key: "ai",
    host: "ai.myinfostream.com",
    title: "AI 情报站",
    titleEn: "AI Intelligence",
    desc: "AI 情报站：大模型发布、芯片算力、AI 应用与融资、每日论文，全部来自境外一线媒体与一手论文源。",
    descEn: "AI intelligence: model releases, chips, AI applications and funding, daily papers — from first-tier international sources.",
    tagline: "只谈 AI · 大模型 · 算力 · 论文",
    taglineEn: "AI only · Models · Chips · Papers",
    defaultLang: "zh",
    // 只声明前端真的会渲染的语言。app.js 的 LANGS + I18N 是唯一的「能渲染」定义，
    // 往这里加一个前端没有的码，?lang=xx 会过服务端校验、前端回落中文，
    // 而 <html lang> 还挂着那个码 —— 页面语言声明与内容不符，对 SEO 和读屏都是错的。
    // 要加韩语：先在 app.js 补 LANGS 里的 {code:"ko"} 与 I18N.ko 的全部文案，再回来加这一行。
    langs: ["zh", "zh-Hant", "en", "es", "fr", "ja", "ru", "ar", "de", "pt"],
    tabs: [
      { id: "all", i18n: "all", sources: ["ai-news", "ai-papers", "ai-intl", "ai-chips", "ai-biz"] },
      { id: "models", i18n: "tabModels", sources: ["ai-models", "ai-news"] },
      { id: "chips", i18n: "tabChips", sources: ["ai-chips"] },
      { id: "biz", i18n: "tabBiz", sources: ["ai-biz", "ai-intl"] },
      { id: "papers", i18n: "tabPapers", sources: ["ai-papers"] },
    ],
    siblings: ["myinfostream.com", "news.myinfostream.com", "game.myinfostream.com", "hot.myinfostream.com"],
    isMain: false,
  },

  "news.myinfostream.com": {
    key: "news",
    host: "news.myinfostream.com",
    title: "国际新闻站",
    titleEn: "World News",
    desc: "国际新闻站：英、西、法、阿、俄五语种严肃媒体聚合——路透、BBC、卫报、法媒、半岛电视台、塔斯社。",
    descEn: "World news in five languages — English, Spanish, French, Arabic and Russian, from Reuters, BBC, Le Monde, Al Jazeera, TASS.",
    tagline: "严肃媒体 · 五语种 · 不追热搜",
    taglineEn: "Serious media · Five languages · No clickbait",
    defaultLang: "en",
    langs: ["en", "es", "fr", "ar", "ru", "zh", "zh-Hant", "pt", "de", "ja"],
    tabs: [
      { id: "top", i18n: "tabTop", sources: ["news-top"] },
      { id: "biz", i18n: "tabBizNews", sources: ["news-biz"] },
      { id: "tech", i18n: "tabTechNews", sources: ["news-tech"] },
      { id: "region", i18n: "tabRegion", sources: ["news-region"] },
    ],
    siblings: ["myinfostream.com", "ai.myinfostream.com", "game.myinfostream.com", "hot.myinfostream.com"],
    isMain: false,
  },

  // -------------------------------------------------------------------------
  // game.myinfostream.com —— Epic 免费领取站
  //
  // tab 设计说明（这是本站最容易做错的地方）：
  // games() 一个函数返回全部三态（本周/即将/长期），它内部已按状态排好序。
  // 如果按直觉写成 sources: ["games", "games", "games"] 给三个 tab，
  // fetchBySources 会并发把 EPIC_API 打三遍 —— sources.js 顶部注释里记着
  // 早先 news 站就是这么把自己打到限流的。
  //
  // 所以三个 tab 都只声明同一个源，靠客户端对整批结果按 badge.k 过滤
  // （见 app.js 的 GM_STATE_FILTER）。代价是一次请求算三态，
  // 换来的是「换 tab 零额外上游请求」。
  // -------------------------------------------------------------------------
  "game.myinfostream.com": {
    key: "game",
    host: "game.myinfostream.com",
    title: "游戏站",
    titleEn: "Free Games",
    desc: "Epic 商店免费领取：本周限时免费、即将开放领取、长期免费入库，按领取截止时间排序，价格与截止日一目了然。",
    descEn: "Epic Games Store giveaways: live this week, coming soon and kept forever — sorted by claim deadline, with price and expiry at a glance.",
    tagline: "白嫖 Epic · 每周三款 · 别领过期",
    taglineEn: "Free Epic games · Three a week · Don't miss the window",
    defaultLang: "zh",
    // 与 ai 站同一批语言：Epic 的 title/desc 是英文原文，站点形态是中文，
    // 两种都需要。游戏内容本身不随 srcLang 变化，所以不设语言过滤。
    langs: ["zh", "zh-Hant", "en", "es", "fr", "ja", "ru", "ar", "de", "pt"],
    tabs: [
      { id: "live", i18n: "tabGameLive", sources: ["games"] },
      { id: "soon", i18n: "tabGameSoon", sources: ["games"] },
      { id: "perma", i18n: "tabGamePerma", sources: ["games"] },
    ],
    siblings: ["myinfostream.com", "ai.myinfostream.com", "news.myinfostream.com", "hot.myinfostream.com"],
    isMain: false,
  },

  // -------------------------------------------------------------------------
  // hot.myinfostream.com —— 实时热搜站
  //
  // 三个 tab 对应三个独立上游（微博 / 百度 / 抖音），是一对一的关系，
  // 不像 game 站那样需要客户端过滤。
  //
  // 这里刻意不复用主站 fun tab 的 douyin 单源：热搜站的语义是
  // 「同时看谁在热」，分榜呈现比混排更有用 —— 微博和抖音的热点分布差异很大。
  // -------------------------------------------------------------------------
  "hot.myinfostream.com": {
    key: "hot",
    host: "hot.myinfostream.com",
    title: "热搜站",
    titleEn: "Trending",
    desc: "微博、百度、抖音三大实时热搜榜：分榜对照，一眼看出全网此刻在关注什么。",
    descEn: "Live trending from Weibo, Baidu and Douyin — three boards side by side, so you can see what the internet is watching right now.",
    tagline: "三榜实时 · 分榜对照 · 不做推荐",
    taglineEn: "Three live boards · Side by side · No recommendations",
    defaultLang: "zh",
    // 热搜内容源全是中文（微博/百度/抖音），界面语言放开但内容恒为中文，
    // 这与 news 站的「内容随 srcLang 变」是两种不同形态。
    langs: ["zh", "zh-Hant", "en", "es", "fr", "ja", "ru", "ar", "de", "pt"],
    tabs: [
      { id: "weibo", i18n: "tabHotWeibo", sources: ["weibo"] },
      { id: "baidu", i18n: "tabHotBaidu", sources: ["baidu"] },
      { id: "douyin", i18n: "tabHotDouyin", sources: ["douyin"] },
    ],
    siblings: ["myinfostream.com", "ai.myinfostream.com", "news.myinfostream.com", "game.myinfostream.com"],
    isMain: false,
  },
};

// 已知 host 列表（用于 sitemap 与自检）
export const HOST_KEYS = Object.keys(HOSTS);

/** 从请求里取出 host（去掉端口、小写） */
export function hostOf(request) {
  const h = request.headers.get("host") || "";
  return h.split(":")[0].toLowerCase();
}

/**
 * 解析请求对应的站点配置。
 * 未知 host（例如 xxx.pages.dev 预览域名）一律回落到主站配置 —— 这样
 * 预览环境也能正常跑，只是 canonical 指向正式域名、并且加 noindex 避免重复计权。
 */
export function resolveHost(request) {
  const host = hostOf(request);
  // www. 前缀归一化 —— www.myinfostream.com 与 myinfostream.com 是同一个站，
  // HOSTS 表只登记裸域。少了这一步，www 查表落空 → cfg=null → 被判成
  // 「未知 host = 预览域名」→ 首页挂 noindex、Cache-Control 变 no-store，
  // 等于把 www 版主站整个从搜索引擎里摘掉。归一化后 www 走裸域配置，
  // canonical 仍指向裸域（https://myinfostream.com/），这是标准做法。
  const bare = host.startsWith("www.") ? host.slice(4) : host;
  const cfg = HOSTS[bare] || null;
  return {
    host,
    bare,
    cfg,
    isKnown: !!cfg,
    // 预览域名（pages.dev / localhost）不参与索引
    isPreview: !cfg || /\.pages\.dev$/.test(host) || host === "localhost" || host === "127.0.0.1",
  };
}

/** 该 host 的规范地址 */
export function canonicalOf(cfg, path = "/") {
  return `https://${cfg.host}${path}`;
}

/** 站点间跳转（相对当前 host 做绝对化） */
export function siblingUrl(fromHost, toHost, path = "/") {
  return `https://${toHost}${path}`;
}