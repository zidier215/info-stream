// assets/app.js
// 前端逻辑：多语言(i18n) + 站点形态切换(portal / topic) + 顶部 Tab 信息流
//           + 固定部件(天气/游戏/AI) + 全球免费接口发现 + 内容翻译 + 本地演示降级。
//
// v2.4 关键改动：这份代码同时服务三个域名，站点差异全部来自服务端注入的
// window.__HOST_CONFIG__（见 functions/_lib/page.js），前端不再硬编码任何站点信息：
//   myinfostream.com       mode=portal  顶部 Tab（简报/国际/AI/娱乐）+ 子站入口卡片 + 常驻看板
//   ai.myinfostream.com    mode=topic   顶部 Tab（全部/大模型/芯片/商业/论文）
//   news.myinfostream.com  mode=topic   顶部 Tab（头条/商业/科技/地区）
// portal 与 topic 的差异全在两个守门：renderEntries() 只在 IS_MAIN 渲染入口卡片，
// reloadWidgets() 只在 IS_MAIN 拉看板。其余代码路径两边共用。
// 取数统一走 /api/feed?tab=<id>，tab 与源组合由 functions/_lib/hosts.js 声明，
// 前端不关心「这个 tab 该拉哪些源」。本地 file:// 打开时没有注入，回落到 FALLBACK_HOST。

// ---------- 语言表（含小语种） ----------
const LANGS = [
  { code: "zh", label: "简体中文", script: "hans", dir: "ltr", mc: "zh-CN" },
  { code: "zh-Hant", label: "繁體中文", script: "hant", dir: "ltr", mc: "zh-TW" },
  { code: "en", label: "English", dir: "ltr", mc: "en" },
  { code: "es", label: "Español", dir: "ltr", mc: "es" },
  { code: "fr", label: "Français", dir: "ltr", mc: "fr" },
  { code: "ja", label: "日本語", dir: "ltr", mc: "ja" },
  { code: "pt", label: "Português", dir: "ltr", mc: "pt" },
  { code: "de", label: "Deutsch", dir: "ltr", mc: "de" },
  { code: "ru", label: "Русский", dir: "ltr", mc: "ru" },
  { code: "ar", label: "العربية", dir: "rtl", mc: "ar" },
  { code: "vi", label: "Tiếng Việt", dir: "ltr", mc: "vi" },
  { code: "th", label: "ภาษาไทย", dir: "ltr", mc: "th" },
  { code: "id", label: "Bahasa Indonesia", dir: "ltr", mc: "id" },
  { code: "sw", label: "Kiswahili", dir: "ltr", mc: "sw" },
  { code: "ca", label: "Català", dir: "ltr", mc: "ca" },
  { code: "eu", label: "Euskara", dir: "ltr", mc: "eu" },
  { code: "cy", label: "Cymraeg", dir: "ltr", mc: "cy" },
  { code: "gl", label: "Galego", dir: "ltr", mc: "gl" },
  { code: "eo", label: "Esperanto", dir: "ltr", mc: "eo" },
];

// ---------- 品牌名：各语言的本地译名 ----------
// 规则（用户要求）：
//   1. 中文（简/繁）→ 中文名在前，英文小字在后：信息河 InfoStream / 資訊河 InfoStream
//   2. 其他所有语言 → 英文 InfoStream 在前（默认品牌），中文小字在后
//   3. 同时把该语言的本地音译放在最前，让非中文用户也认得出
const BRAND_ALT = {
  es: "Flujo de Información",
  fr: "Flux d'Infos",
  ja: "情報の川",
  pt: "Fluxo de Informações",
  de: "Informationsfluss",
  ru: "Инфопоток",
  ar: "تيار المعلومات",
  vi: "Dòng Thông Tin",
  th: "กระแสข้อมูล",
  id: "Aliran Informasi",
  sw: "Mto wa Taarifa",
  ca: "Flux d'Informació",
  eu: "Informazio Fluxua",
  cy: "Llif Gwybodaeth",
  gl: "Fluxo de Información",
  eo: "Informa Fluo",
};

// 返回 { main, sub }：main 是大号主名，sub 是小字副名
function brandName(code) {
  const l = LANGS.find((x) => x.code === code) || LANGS[0];
  // 中文（简体 / 繁体）：中文在前
  if (l.script === "hans") return { main: "信息河", sub: "InfoStream" };
  if (l.script === "hant") return { main: "資訊河", sub: "InfoStream" };
  // 其他语言：本地译名在前 + 英文 InfoStream 紧随，中间用分隔符隔开
  if (BRAND_ALT[code]) return { main: BRAND_ALT[code], sub: "InfoStream" };
  // 英文及其它未收录语言：英文默认
  return { main: "InfoStream", sub: "信息河" };
}

// ---------- 站点配置（服务端注入） ----------
// 本地 file:// 预览时没有注入，用一份与 hosts.js 主站一致的手写兜底，
// 这样离线也能看到完整形态，不至于退化成白屏或报错。
const FALLBACK_HOST = {
  key: "main",
  host: "localhost",
  title: "信息河",
  titleEn: "InfoStream",
  desc: "",
  defaultLang: "zh",
  langs: LANGS.map((l) => l.code),
  tabs: [
    { id: "brief", i18n: "brief", sources: [] },
    { id: "world", i18n: "world", sources: [] },
    { id: "ai", i18n: "ai", sources: [] },
    { id: "fun", i18n: "fun", sources: [] },
  ],
  entries: [
    { host: "ai.myinfostream.com", key: "ai", i18n: "entryAi", fallback: "AI 情报站", fallbackEn: "AI Intelligence" },
    { host: "news.myinfostream.com", key: "news", i18n: "entryNews", fallback: "国际新闻站", fallbackEn: "World News" },
    { host: "game.myinfostream.com", key: "game", i18n: "entryGame", fallback: "游戏站", fallbackEn: "Free Games" },
    { host: "hot.myinfostream.com", key: "hot", i18n: "entryHot", fallback: "热搜站", fallbackEn: "Trending" },
  ],
  siblings: [],
  isMain: true,
  mode: "portal",
  preview: false,
  canonical: "",
};

const HOST = Object.assign({}, FALLBACK_HOST, window.__HOST_CONFIG__ || {});
// langs / tabs 必须是非空数组：站点配置万一被改坏，也不要让前端空转
if (!Array.isArray(HOST.langs) || !HOST.langs.length) HOST.langs = FALLBACK_HOST.langs;
if (!Array.isArray(HOST.tabs) || !HOST.tabs.length) HOST.tabs = FALLBACK_HOST.tabs;
// mode 由服务端算好，但本地兜底时按 isMain 再算一次，两处口径一致
if (!window.__HOST_CONFIG__) HOST.mode = HOST.isMain ? "portal" : "topic";
const MODE = HOST.mode;               // "portal" | "topic"
const IS_MAIN = MODE === "portal";    // 主站才显示入口卡片与常驻看板

// ---------- Tab / 入口卡片文案 ----------
// 单独一张表而不是塞进 I18N：这些 key 只服务于 Tab 与入口卡片，
// 而 I18N 是 19 语言 × 30 键的巨型对象，单独放更易读也更容易补语言。
// 缺失语言自动回落到 en，再回落到 key 本身（不会出现空白 Tab）。
const UI_I18N = {
  brief: { zh: "简报", "zh-Hant": "簡報", en: "Brief", es: "Resumen", fr: "Brief", ja: "ブリーフ", de: "Überblick", ru: "Обзор", ar: "موجز", pt: "Resumo" },
  world: { zh: "国际", "zh-Hant": "國際", en: "World", es: "Mundo", fr: "Monde", ja: "世界", de: "Welt", ru: "Мир", ar: "العالم", pt: "Mundo" },
  ai: { zh: "AI", "zh-Hant": "AI", en: "AI", es: "IA", fr: "IA", ja: "AI", de: "KI", ru: "ИИ", ar: "ذكاء اصطناعي", pt: "IA" },
  fun: { zh: "娱乐", "zh-Hant": "娛樂", en: "Culture", es: "Cultura", fr: "Culture", ja: "エンタメ", de: "Kultur", ru: "Культура", ar: "ترفيه", pt: "Cultura" },
  all: { zh: "全部", "zh-Hant": "全部", en: "All", es: "Todos", fr: "Tout", ja: "すべて", de: "Alle", ru: "Все", ar: "الكل", pt: "Todos" },
  tabModels: { zh: "大模型", "zh-Hant": "大型模型", en: "Models", es: "Modelos", fr: "Modèles", ja: "モデル", de: "Modelle", ru: "Модели", ar: "النماذج", pt: "Modelos" },
  tabChips: { zh: "芯片算力", "zh-Hant": "晶片算力", en: "Chips", es: "Chips", fr: "Puces", ja: "半導体", de: "Chips", ru: "Чипы", ar: "الشرائح", pt: "Chips" },
  tabBiz: { zh: "商业", "zh-Hant": "商業", en: "Business", es: "Negocios", fr: "Business", ja: "ビジネス", de: "Business", ru: "Бизнес", ar: "الأعمال", pt: "Negócios" },
  tabPapers: { zh: "论文", "zh-Hant": "論文", en: "Papers", es: "Papers", fr: "Papiers", ja: "論文", de: "Papiere", ru: "Статьи", ar: "الأوراق", pt: "Artigos" },
  tabTop: { zh: "头条", "zh-Hant": "頭條", en: "Top", es: "Top", fr: "À la une", ja: "トップ", de: "Top", ru: "Главное", ar: "الأبرز", pt: "Topo" },
  tabBizNews: { zh: "财经", "zh-Hant": "財經", en: "Business", es: "Negocios", fr: "Économie", ja: "経済", de: "Wirtschaft", ru: "Экономика", ar: "اقتصاد", pt: "Negócios" },
  tabTechNews: { zh: "科技", "zh-Hant": "科技", en: "Tech", es: "Tecnología", fr: "Tech", ja: "テック", de: "Technik", ru: "Технологии", ar: "تقنية", pt: "Tecnologia" },
  tabRegion: { zh: "地区", "zh-Hant": "地區", en: "Regions", es: "Regiones", fr: "Régions", ja: "地域", de: "Regionen", ru: "Регионы", ar: "المناطق", pt: "Regiões" },
  // game 站：三态 tab 的命名跟着「用户此刻要做什么」走 —— 现在能领 / 还没开 / 永久入库。
  // 不叫「状态一/二/三」，也不叫 live/soon/perma 的直译。
  tabGameLive: { zh: "本周免费", "zh-Hant": "本週免費", en: "Live", es: "Ahora", fr: "En cours", ja: "今週", de: "Jetzt", ru: "Сейчас", ar: "الآن", pt: "Agora" },
  tabGameSoon: { zh: "即将开放", "zh-Hant": "即將開放", en: "Upcoming", es: "Próximos", fr: "À venir", ja: "近日", de: "Demnächst", ru: "Скоро", ar: "قريبًا", pt: "Em breve" },
  tabGamePerma: { zh: "长期免费", "zh-Hant": "長期免費", en: "Kept Free", es: "Gratuitos", fr: "Gratuits", ja: "常設無料", de: "Dauerhaft", ru: "Навсегда", ar: "مجاني دائمًا", pt: "Gratuitos" },
  // hot 站：三个 tab 就是三个平台的品牌名，用平台自己的叫法而不是「微博热搜」这类后缀 ——
  // 榜单本身就是那个平台的东西，加「热搜」反而在暗示这是本站的热搜。
  tabHotWeibo: { zh: "微博", "zh-Hant": "微博", en: "Weibo", es: "Weibo", fr: "Weibo", ja: "微博", de: "Weibo", ru: "Weibo", ar: "ويبو", pt: "Weibo" },
  tabHotBaidu: { zh: "百度", "zh-Hant": "百度", en: "Baidu", es: "Baidu", fr: "Baidu", ja: "百度", de: "Baidu", ru: "Baidu", ar: "بايدو", pt: "Baidu" },
  tabHotBilibili: { zh: "B站", "zh-Hant": "B站", en: "Bilibili", es: "Bilibili", fr: "Bilibili", ja: "ビリビリ", de: "Bilibili", ru: "Bilibili", ar: "بيليبيلي", pt: "Bilibili" },
  tabHotDouyin: { zh: "抖音", "zh-Hant": "抖音", en: "Douyin", es: "Douyin", fr: "Douyin", ja: "抖音", de: "Douyin", ru: "Douyin", ar: "دوين", pt: "Douyin" },
  entryAi: { zh: "AI 情报站", "zh-Hant": "AI 情報站", en: "AI Intelligence", es: "Inteligencia IA", fr: "Veille IA", ja: "AI インテリジェンス", de: "KI-Intelligence", ru: "ИИ-разведка", ar: "استخبارات الذكاء الاصطناعي", pt: "Inteligência de IA" },
  entryNews: { zh: "国际新闻站", "zh-Hant": "國際新聞站", en: "World News", es: "Noticias Mundiales", fr: "Actualités Internationales", ja: "国際ニュース", de: "Weltnachrichten", ru: "Мировые новости", ar: "أخبار العالم", pt: "Notícias Mundiais" },
  entryGame: { zh: "游戏站", "zh-Hant": "遊戲站", en: "Free Games", es: "Juegos Gratis", fr: "Jeux Gratuits", ja: "ゲーム無料", de: "Gratis-Spiele", ru: "Бесплатные игры", ar: "ألعاب مجانية", pt: "Jogos Gratuitos" },
  entryHot: { zh: "热搜站", "zh-Hant": "熱搜站", en: "Trending", es: "Tendencias", fr: "Tendances", ja: "トレンド", de: "Trends", ru: "Тренды", ar: "الأكثر رواجًا", pt: "Tendências" },
  entryAiDesc: { zh: "大模型发布 · 芯片算力 · 融资 · 每日论文", "zh-Hant": "大型模型發布 · 晶片算力 · 融資 · 每日論文", en: "Model releases · chips · funding · daily papers", es: "Modelos · chips · financiación · papers diarios", fr: "Modèles · puces · financement · papers", ja: "モデル · 半導体 · 資金調達 · 論文", de: "Modelle · Chips · Finanzierung · Papiere", ru: "Модели · чипы · финансирование · статьи", ar: "نماذج · شرائح · تمويل · أوراق", pt: "Modelos · chips · financiamento · artigos" },
  entryNewsDesc: { zh: "英 · 西 · 法 · 阿 · 俄 五语种严肃媒体", "zh-Hant": "英 · 西 · 法 · 阿 · 俄 五語種嚴肅媒體", en: "Serious media in five languages", es: "Medios serios en cinco idiomas", fr: "Médias sérieux en cinq langues", ja: "5言語の信頼できるメディア", de: "Seriöse Medien in fünf Sprachen", ru: "Серьёзные СМИ на пяти языках", ar: "إعلام جاد خمس لغات", pt: "Mídia séria em cinco idiomas" },
  entryGameDesc: { zh: "Epic 每周免费 · 附价格与截止日", "zh-Hant": "Epic 每週免費 · 附價格與截止日", en: "Free Epic games with price and deadline", es: "Juegos gratis de Epic con precio y fecha", fr: "Jeux Epic gratuits avec prix et date limite", ja: "Epic 無料ゲーム・価格と期限付き", de: "Gratis-Epic-Spiele mit Preis und Frist", ru: "Бесплатные Epic с ценой и дедлайном", ar: "ألعاب Epic مجانية مع السعر والموعد", pt: "Jogos Epic grátis com preço e prazo" },
  entryHotDesc: { zh: "微博 · 百度 · B站 · 抖音 四榜实时对照", "zh-Hant": "微博 · 百度 · B站 · 抖音 四榜即時對照", en: "Weibo, Baidu, Bilibili and Douyin side by side", es: "Weibo, Baidu, Bilibili y Douyin en paralelo", fr: "Weibo, Baidu, Bilibili et Douyin côte à côte", ja: "Weibo・Baidu・B站・Douyin を横並びで", de: "Weibo, Baidu, Bilibili und Douyin nebeneinander", ru: "Weibo, Baidu, Bilibili и Douyin рядом", ar: "ويبو وبايدو وبيليبيلي ودوين جنبًا إلى جنب", pt: "Weibo, Baidu, Bilibili e Douyin lado a lado" },
  entryGo: { zh: "进入", "zh-Hant": "進入", en: "Enter", es: "Entrar", fr: "Entrer", ja: "開く", de: "Öffnen", ru: "Открыть", ar: "ادخل", pt: "Entrar" },
  hubTitle: { zh: "专题站", "zh-Hant": "專題站", en: "Topics", es: "Temas", fr: "Thèmes", ja: "トピック", de: "Themen", ru: "Разделы", ar: "أقسام", pt: "Temas" },

  // ---------- Epic 免费游戏 ----------
  // 类目拆成三态不是为了好看，是因为三种东西对用户的行动指令完全不同：
  // 本周免费=不领就没；即将免费=先收藏；长期免费=慢慢玩。
  // 服务端只吐结构化 badge（k/price/date/left/bundle），文案在这里按当前语言拼。
  catThisWeek: { zh: "本周免费", "zh-Hant": "本週免費", en: "Free this week", es: "Gratis esta semana", fr: "Gratuit cette semaine", ja: "今週無料", de: "Diese Woche gratis", ru: "Бесплатно на неделе", ar: "مجاني هذا الأسبوع", pt: "Grátis esta semana" },
  catUpcoming: { zh: "即将免费", "zh-Hant": "即將免費", en: "Free soon", es: "Gratis pronto", fr: "Bientôt gratuit", ja: "近日無料", de: "Bald gratis", ru: "Скоро бесплатно", ar: "مجاني قريباً", pt: "Grátis em breve" },
  catForever: { zh: "长期免费", "zh-Hant": "長期免費", en: "Free to keep", es: "Gratis para siempre", fr: "Gratuit à jamais", ja: "ずっと無料", de: "Dauerhaft gratis", ru: "Навсегда бесплатно", ar: "مجاني دائمًا", pt: "Grátis para sempre" },

  // 徽章模板。竖线分段：某段只要有一个占位符是空值，整段丢掉。
  // 这样价格缺失时不会出现「💰  · 至 11/2」这种空洞，也不会掉出半句「价值」。
  gmLive: { zh: "💰 {p}|至 {d}（剩 {n} 天）", "zh-Hant": "💰 {p}|至 {d}（剩 {n} 天）", en: "💰 {p}|free until {d} ({n}d left)", es: "💰 {p}|gratis hasta el {d} (quedan {n} d)", fr: "💰 {p}|gratuit jusqu'au {d} ({n} j restants)", ja: "💰 {p}|{d} まで無料（残り {n} 日）", de: "💰 {p}|gratis bis {d} (noch {n} Tage)", ru: "💰 {p}|бесплатно до {d} (осталось {n} дн.)", ar: "💰 {p}|مجاني حتى {d} (بقي {n} يوم)", pt: "💰 {p}|grátis até {d} (faltam {n} d)" },
  gmSoon: { zh: "🔔 {d} 起免费|价值 {p}", "zh-Hant": "🔔 {d} 起免費|價值 {p}", en: "🔔 free from {d}|worth {p}", es: "🔔 gratis desde el {d}|vale {p}", fr: "🔔 gratuit à partir du {d}|valeur {p}", ja: "🔔 {d} より無料|価格 {p}", de: "🔔 gratis ab {d}|Wert {p}", ru: "🔔 бесплатно с {d}|цена {p}", ar: "🔔 مجاني اعتباراً من {d}|بقيمة {p}", pt: "🔔 grátis a partir de {d}|vale {p}" },
  gmPerma: { zh: "♾ 长期免费|原价 {p}", "zh-Hant": "♾ 長期免費|原價 {p}", en: "♾ free to keep|normally {p}", es: "♾ gratis para siempre|normalmente {p}", fr: "♾ gratuit à jamais|normalement {p}", ja: "♾ ずっと無料|通常 {p}", de: "♾ dauerhaft gratis|normalerweise {p}", ru: "♾ навсегда бесплатно|обычно {p}", ar: "♾ مجاني دائمًا|عادةً {p}", pt: "♾ grátis para sempre|normalmente {p}" },

  bdAllDlc: { zh: "含全部 DLC", "zh-Hant": "含全部 DLC", en: "All DLCs included", es: "Todos los DLC incluidos", fr: "Tous les DLC inclus", ja: "全DLC同梱", de: "Alle DLC enthalten", ru: "Все DLC включены", ar: "جميع DLC مضمّنة", pt: "Todos os DLC incluídos" },
  bdDlcN: { zh: "含 {n} 个 DLC", "zh-Hant": "含 {n} 個 DLC", en: "{n} DLCs included", es: "{n} DLC incluidos", fr: "{n} DLC inclus", ja: "DLC {n} 個同梱", de: "{n} DLC enthalten", ru: "{n} DLC включено", ar: "{n} DLC مضمّنة", pt: "{n} DLC incluídos" },
  bdEdition: { zh: "完全版", "zh-Hant": "完全版", en: "Complete Edition", es: "Edición Completa", fr: "Édition Complète", ja: "コンプリート版", de: "Vollständige Edition", ru: "Полное издание", ar: "الإصدار الكامل", pt: "Edição Completa" },
  bdDeluxe: { zh: "豪华版", "zh-Hant": "豪華版", en: "Deluxe Edition", es: "Edición Deluxe", fr: "Édition Deluxe", ja: "デラックス版", de: "Deluxe-Edition", ru: "Издание Deluxe", ar: "إصدار ديلوكس", pt: "Edição Deluxe" },
  bdBundle: { zh: "捆绑包", "zh-Hant": "捆綁包", en: "Bundle", es: "Paquete", fr: "Pack", ja: "バンドル", de: "Bundle", ru: "Набор", ar: "حزمة", pt: "Pacote" },
};

function uiText(key) {
  const row = UI_I18N[key];
  if (!row) return key;
  return row[currentLang] || row.en || key;
}

// ---------- 多语言文案 ----------
const I18N = {
  zh: { tagline: "滚动不息 · 多源聚合 · 全球信息，为你而生", all: "全部", autoStart: "▶ 自动滚动", autoPause: "⏸ 暂停滚动", refresh: "⟳ 刷新", translate: "🌐 翻译", weather: "天气", games: "游戏", ai: "AI", myLocation: "📍 定位", cityPlaceholder: "输入城市（任意全球城市）", widgetsTitle: "常驻看板", discoverTitle: "发现全球免费接口", discoverHint: "搜索全球各类免费、无需密钥的公共 API，点击前往。", discoverSearch: "搜索接口，如 weather / 翻译 / 图片 …", hot: "热搜", fun: "娱乐", market: "市场", football: "足球", loading: "正在汇聚信息洪流…", more: "↓ 向下滚动 · 信息川流不息", end: "✓ 暂时到底 · 试试点 ⟳ 刷新", demo: "演示模式 · 未连接聚合接口，内容为内置示例；部署到 Cloudflare 后即为实时数据", stale: "实时源暂时无响应 · 显示最近一次成功获取的内容", noResult: "没有找到匹配的接口。", foot1: "数据源：微博/百度/抖音热搜 · Hacker News · Open-Meteo · Epic · Exchangerate/Binance · OpenLigaDB · HuggingFace", foot2: "部署于 Cloudflare Pages · 服务端聚合，无密钥、无 CORS · 内容经 MyMemory 翻译" },
  "zh-Hant": { tagline: "滾動不息 · 多源聚合 · 全球資訊，為你而生", all: "全部", autoStart: "▶ 自動捲動", autoPause: "⏸ 暫停捲動", refresh: "⟳ 重新整理", translate: "🌐 翻譯", weather: "天氣", games: "遊戲", ai: "AI", myLocation: "📍 定位", cityPlaceholder: "輸入城市（全球任一城市）", widgetsTitle: "常駐看板", discoverTitle: "發現全球免費 API", discoverHint: "搜尋全球各類免費、無需金鑰的公開 API，點擊前往。", discoverSearch: "搜尋 API，如 weather / 翻譯 / 圖片 …", hot: "熱搜", fun: "娛樂", market: "市場", football: "足球", loading: "正在匯聚資訊洪流…", more: "↓ 向下捲動 · 資訊川流不息", end: "✓ 暫時到底 · 試試點 ⟳ 重新整理", demo: "示範模式 · 未連接聚合介面，內容為內建範例；部署到 Cloudflare 後即為即時資料", noResult: "沒有找到符合的 API。", foot1: "資料來源：微博/百度/抖音熱搜 · Hacker News · Open-Meteo · Epic · Exchangerate/Binance · OpenLigaDB · HuggingFace", foot2: "部署於 Cloudflare Pages · 伺服器端聚合，無金鑰、無 CORS · 內容經 MyMemory 翻譯" },
  en: { tagline: "Endless stream · Multi-source · Global info, made for you", all: "All", autoStart: "▶ Auto-scroll", autoPause: "⏸ Pause", refresh: "⟳ Refresh", translate: "🌐 Translate", weather: "Weather", games: "Games", ai: "AI", myLocation: "📍 Locate", cityPlaceholder: "Type a city (any city worldwide)", widgetsTitle: "Pinned board", discoverTitle: "Discover free global APIs", discoverHint: "Search free, no-key public APIs worldwide. Click to visit.", discoverSearch: "Search APIs, e.g. weather / translate / image …", hot: "Trending", fun: "Entertainment", market: "Markets", football: "Football", loading: "Gathering the stream…", more: "↓ Scroll down · the flow keeps coming", end: "✓ Caught up · tap ⟳ to refresh", demo: "Demo mode · no aggregator connected; built-in samples. Live data after deploying to Cloudflare", stale: "Live feed unavailable · showing the most recent snapshot", noResult: "No matching APIs found.", foot1: "Sources: Weibo/Baidu/Douyin hot · Hacker News · Open-Meteo · Epic · Exchangerate/Binance · OpenLigaDB · HuggingFace", foot2: "On Cloudflare Pages · server-side aggregation, no key, no CORS · translated by MyMemory" },
  es: { tagline: "Flujo infinito · Multi-fuente · Información global, hecha para ti", all: "Todos", autoStart: "▶ Auto-scroll", autoPause: "⏸ Pausa", refresh: "⟳ Actualizar", translate: "🌐 Traducir", weather: "Clima", games: "Juegos", ai: "IA", myLocation: "📍 Ubicación", cityPlaceholder: "Escribe una ciudad (cualquiera del mundo)", widgetsTitle: "Panel fijo", discoverTitle: "Descubre APIs gratuitas", discoverHint: "Busca APIs públicas gratuitas y sin clave en todo el mundo. Haz clic para visitar.", discoverSearch: "Buscar APIs, ej. weather / translate / image …", hot: "Tendencias", fun: "Entretenimiento", market: "Mercados", football: "Fútbol", loading: "Reuniendo el flujo…", more: "↓ Desplázate · el flujo sigue", end: "✓ Al día · toca ⟳ para refrescar", demo: "Modo demo · sin agregador conectado; muestras integradas. Datos en vivo tras desplegar en Cloudflare", stale: "Fuente en vivo no disponible · mostrando la última instantánea", noResult: "No se encontraron APIs.", foot1: "Fuentes: Weibo/Baidu/Douyin · Hacker News · Open-Meteo · Epic · Exchangerate/Binance · OpenLigaDB · HuggingFace", foot2: "En Cloudflare Pages · agregación en servidor, sin clave, sin CORS · traducido por MyMemory" },
  fr: { tagline: "Flux infini · Multi-sources · Info mondiale, faite pour vous", all: "Tout", autoStart: "▶ Défilement auto", autoPause: "⏸ Pause", refresh: "⟳ Actualiser", translate: "🌐 Traduire", weather: "Météo", games: "Jeux", ai: "IA", myLocation: "📍 Position", cityPlaceholder: "Saisissez une ville (n'importe où)", widgetsTitle: "Tableau épinglé", discoverTitle: "Découvrir des API gratuites", discoverHint: "Recherchez des API publiques gratuites sans clé dans le monde. Cliquez pour visiter.", discoverSearch: "Rechercher des API, ex. weather / translate / image …", hot: "Tendances", fun: "Divertissement", market: "Marchés", football: "Football", loading: "Rassemblement du flux…", more: "↓ Défilez · le flux continue", end: "✓ À jour · touchez ⟳ pour actualiser", demo: "Mode démo · agrégateur non connecté ; exemples intégrés. Données live après déploiement sur Cloudflare", stale: "Flux en direct indisponible · affichage de la dernière capture", noResult: "Aucune API trouvée.", foot1: "Sources : Weibo/Baidu/Douyin · Hacker News · Open-Meteo · Epic · Exchangerate/Binance · OpenLigaDB · HuggingFace", foot2: "Sur Cloudflare Pages · agrégation côté serveur, sans clé, sans CORS · traduit par MyMemory" },
  ja: { tagline: "終わりのない流れ · 多源集約 · 世界の情報を、あなたに", all: "すべて", autoStart: "▶ 自動スクロール", autoPause: "⏸ 一時停止", refresh: "⟳ 更新", translate: "🌐 翻訳", weather: "天気", games: "ゲーム", ai: "AI", myLocation: "📍 現在地", cityPlaceholder: "都市を入力（世界中どこでも）", widgetsTitle: "常設ボード", discoverTitle: "世界の無料APIを発見", discoverHint: "世界中の無料・キー不要な公開APIを検索。クリックで訪問。", discoverSearch: "APIを検索（例：weather / translate / image …）", hot: "トレンド", fun: "エンタメ", market: "市場", football: "サッカー", loading: "流れを集めています…", more: "↓ 下にスクロール · 流れは続く", end: "✓ ここまで · ⟳ で更新", demo: "デモモード · 集約API未接続；内蔵サンプル。Cloudflare展開でライブデータに", stale: "ライブフィードに接続できません · 最新の取得内容を表示しています", noResult: "該当するAPIが見つかりません。", foot1: "出典：微博/百度/抖音 · Hacker News · Open-Meteo · Epic · Exchangerate/Binance · OpenLigaDB · HuggingFace", foot2: "Cloudflare Pagesへ配信 · サーバー側集約、キー不要、CORS不要 · MyMemoryで翻訳" },
  pt: { tagline: "Fluxo infinito · Multi-fontes · Informação global, feita para você", all: "Todos", autoStart: "▶ Auto-scroll", autoPause: "⏸ Pausar", refresh: "⟳ Atualizar", translate: "🌐 Traduzir", weather: "Clima", games: "Jogos", ai: "IA", myLocation: "📍 Local", cityPlaceholder: "Digite uma cidade (qualquer do mundo)", widgetsTitle: "Painel fixo", discoverTitle: "Descobrir APIs grátis", discoverHint: "Busque APIs públicas grátis e sem chave no mundo. Clique para visitar.", discoverSearch: "Buscar APIs, ex. weather / translate / image …", hot: "Tendências", fun: "Entretenimento", market: "Mercados", football: "Futebol", loading: "Reunindo o fluxo…", more: "↓ Role para baixo · o fluxo continua", end: "✓ Tudo em dia · toque ⟳ para atualizar", demo: "Modo demo · agregador não conectado; amostras internas. Dados ao vivo após implantar na Cloudflare", stale: "Feed ao vivo indisponível · mostrando a captura mais recente", noResult: "Nenhuma API encontrada.", foot1: "Fontes: Weibo/Baidu/Douyin · Hacker News · Open-Meteo · Epic · Exchangerate/Binance · OpenLigaDB · HuggingFace", foot2: "Na Cloudflare Pages · agregação no servidor, sem chave, sem CORS · traduzido por MyMemory" },
  de: { tagline: "Endloser Strom · Multi-Quelle · Globale Infos, für dich gemacht", all: "Alle", autoStart: "▶ Autoscroll", autoPause: "⏸ Pause", refresh: "⟳ Aktualisieren", translate: "🌐 Übersetzen", weather: "Wetter", games: "Spiele", ai: "KI", myLocation: "📍 Ort", cityPlaceholder: "Stadt eingeben (weltweit)", widgetsTitle: "Festes Brett", discoverTitle: "Kostenlose APIs entdecken", discoverHint: "Durchsuche kostenlose, schlüsselfreie öffentliche APIs weltweit. Klick zum Öffnen.", discoverSearch: "APIs suchen, z.B. weather / translate / image …", hot: "Trends", fun: "Unterhaltung", market: "Märkte", football: "Fußball", loading: "Strom wird gesammelt…", more: "↓ Scrollen · der Strom fließt weiter", end: "✓ Alles gesehen · ⟳ zum Aktualisieren", demo: "Demo-Modus · kein Aggregator verbunden; eingebaute Beispiele. Live-Daten nach Cloudflare-Deploy", stale: "Live-Feed nicht verfügbar · letzte Momentaufnahme wird angezeigt", noResult: "Keine passenden APIs gefunden.", foot1: "Quellen: Weibo/Baidu/Douyin · Hacker News · Open-Meteo · Epic · Exchangerate/Binance · OpenLigaDB · HuggingFace", foot2: "Auf Cloudflare Pages · Server-Aggregation, kein Schlüssel, kein CORS · übersetzt von MyMemory" },
  ru: { tagline: "Бесконечный поток · Много источников · Глобальная информация для вас", all: "Все", autoStart: "▶ Авто-прокрутка", autoPause: "⏸ Пауза", refresh: "⟳ Обновить", translate: "🌐 Перевод", weather: "Погода", games: "Игры", ai: "ИИ", myLocation: "📍 Место", cityPlaceholder: "Введите город (любой в мире)", widgetsTitle: "Закреплённая панель", discoverTitle: "Откройте бесплатные API", discoverHint: "Ищите бесплатные публичные API без ключа по всему миру. Нажмите, чтобы открыть.", discoverSearch: "Искать API, напр. weather / translate / image …", hot: "Тренды", fun: "Развлечения", market: "Рынки", football: "Футбол", loading: "Собираем поток…", more: "↓ Прокрутите вниз · поток продолжается", end: "✓ Просмотрено · ⟳ обновить", demo: "Демо-режим · агрегатор не подключён; встроенные примеры. Живые данные после деплоя на Cloudflare", stale: "Лента недоступна · показаны последние полученные данные", noResult: "Подходящих API не найдено.", foot1: "Источники: Weibo/Baidu/Douyin · Hacker News · Open-Meteo · Epic · Exchangerate/Binance · OpenLigaDB · HuggingFace", foot2: "На Cloudflare Pages · серверная агрегация, без ключа, без CORS · перевод через MyMemory" },
  ar: { tagline: "تدفق لا ينتهي · مصادر متعددة · معلومات عالمية، صُنعت لك", all: "الكل", autoStart: "▶ تمرير تلقائي", autoPause: "⏸ إيقاف", refresh: "⟳ تحديث", translate: "🌐 ترجمة", weather: "الطقس", games: "ألعاب", ai: "ذكاء اصطناعي", myLocation: "📍 موقعي", cityPlaceholder: "اكتب مدينة (أي مدينة في العالم)", widgetsTitle: "لوحة مثبتة", discoverTitle: "اكتشف واجهات مجانية عالمية", discoverHint: "ابحث عن واجهات برمجة عامة مجانية بدون مفتاح حول العالم. انقر للزيارة.", discoverSearch: "ابحث عن واجهات، مثل weather / translate / image …", hot: "الرائج", fun: "ترفيه", market: "الأسواق", football: "كرة القدم", loading: "نجمع التدفق…", more: "↓ مرر للأسفل · التدفق مستمر", end: "✓ انتهى · اضغط ⟳ للتحديث", demo: "وضع تجريبي · لم يتم توصيل المجمّع؛ عينات مدمجة. بيانات حية بعد النشر على Cloudflare", stale: "البث المباشر غير متاح · يتم عرض آخر نسخة محفوظة", noResult: "لم يتم العثور على واجهات مطابقة.", foot1: "المصادر: Weibo/Baidu/Douyin · Hacker News · Open-Meteo · Epic · Exchangerate/Binance · OpenLigaDB · HuggingFace", foot2: "على Cloudflare Pages · تجميع من الخادم، بدون مفتاح، بدون CORS · مترجم عبر MyMemory" },
  vi: { tagline: "Dòng chảy vô tận · Đa nguồn · Thông tin toàn cầu, dành cho bạn", all: "Tất cả", autoStart: "▶ Tự cuộn", autoPause: "⏸ Dừng", refresh: "⟳ Làm mới", translate: "🌐 Dịch", weather: "Thời tiết", games: "Trò chơi", ai: "AI", myLocation: "📍 Vị trí", cityPlaceholder: "Nhập thành phố (bất kỳ nơi nào)", widgetsTitle: "Bảng ghim", discoverTitle: "Khám phá API miễn phí toàn cầu", discoverHint: "Tìm kiếm các API công khai miễn phí không cần khóa trên toàn thế giới. Bấm để truy cập.", discoverSearch: "Tìm API, ví dụ weather / translate / image …", hot: "Xu hướng", fun: "Giải trí", market: "Thị trường", football: "Bóng đá", loading: "Đang tập hợp dòng…", more: "↓ Cuộn xuống · dòng chảy tiếp tục", end: "✓ Đã xem hết · nhấn ⟳ để làm mới", demo: "Chế độ demo · chưa kết nối bộ gom; mẫu tích hợp. Dữ liệu thực sau khi triển khai trên Cloudflare", stale: "Nguồn trực tiếp không khả dụng · đang hiển thị ảnh chụp gần nhất", noResult: "Không tìm thấy API phù hợp.", foot1: "Nguồn: Weibo/Baidu/Douyin · Hacker News · Open-Meteo · Epic · Exchangerate/Binance · OpenLigaDB · HuggingFace", foot2: "Trên Cloudflare Pages · gom từ máy chủ, không cần khóa, không CORS · dịch bởi MyMemory" },
  th: { tagline: "กระแสไม่รู้จบ · รวมหลายแหล่ง · ข่าวโลกสำหรับคุณ", all: "ทั้งหมด", autoStart: "▶ เลื่อนอัตโนมัติ", autoPause: "⏸ หยุด", refresh: "⟳ รีเฟรช", translate: "🌐 แปล", weather: "สภาพอากาศ", games: "เกม", ai: "AI", myLocation: "📍 ตำแหน่ง", cityPlaceholder: "พิมพ์เมือง (ทั่วโลก)", widgetsTitle: "แผงปักหมุด", discoverTitle: "ค้นพบ API ฟรีทั่วโลก", discoverHint: "ค้นหา API สาธารณะฟรีไม่ต้องใช้คีย์ทั่วโลก คลิกเพื่อเยี่ยมชม", discoverSearch: "ค้นหา API เช่น weather / translate / image …", hot: "กระแส", fun: "บันเทิง", market: "ตลาด", football: "ฟุตบอล", loading: "กำลังรวมกระแส…", more: "↓ เลื่อนลง · กระแสยังไหลต่อ", end: "✓ สุดแล้ว · กด ⟳ เพื่อรีเฟรช", demo: "โหมดสาธิต · ไม่ได้ต่อaggregator; ตัวอย่างในตัว ข้อมูลจริงหลัง Deploy บน Cloudflare", stale: "ไม่สามารถเชื่อมต่อฟีดสด · กำลังแสดงข้อมูลล่าสุดที่ได้รับ", noResult: "ไม่พบ API ที่ตรงกัน", foot1: "แหล่งที่มา: Weibo/Baidu/Douyin · Hacker News · Open-Meteo · Epic · Exchangerate/Binance · OpenLigaDB · HuggingFace", foot2: "บน Cloudflare Pages · รวมจากเซิร์ฟเวอร์ ไม่ต้องใช้คีย์ ไม่มี CORS · แปลโดย MyMemory" },
  id: { tagline: "Aliran tak berujung · Multi-sumber · Info global, dibuat untukmu", all: "Semua", autoStart: "▶ Gulir otomatis", autoPause: "⏸ Jeda", refresh: "⟳ Segarkan", translate: "🌐 Terjemah", weather: "Cuaca", games: "Game", ai: "AI", myLocation: "📍 Lokasi", cityPlaceholder: "Ketik kota (mana saja di dunia)", widgetsTitle: "Papan sematan", discoverTitle: "Temukan API gratis global", discoverHint: "Cari API publik gratis tanpa kunci di seluruh dunia. Klik untuk mengunjungi.", discoverSearch: "Cari API, mis. weather / translate / image …", hot: "Tren", fun: "Hiburan", market: "Pasar", football: "Sepak bola", loading: "Menghimpun aliran…", more: "↓ Gulir ke bawah · aliran terus mengalir", end: "✓ Sudah sampai · ketuk ⟳ untuk segarkan", demo: "Mode demo · aggregator tidak terhubung; contoh bawaan. Data langsung setelah deploy ke Cloudflare", stale: "Umpan langsung tidak tersedia · menampilkan snapshot terbaru", noResult: "Tidak ada API yang cocok.", foot1: "Sumber: Weibo/Baidu/Douyin · Hacker News · Open-Meteo · Epic · Exchangerate/Binance · OpenLigaDB · HuggingFace", foot2: "Di Cloudflare Pages · agregasi server, tanpa kunci, tanpa CORS · diterjemahkan oleh MyMemory" },
  sw: { tagline: "Mtiririko usio na mwisho · Vyanzo vingi · Habari za dunia, kwa ajili yako", all: "Zote", autoStart: "▶ Sikia otomatiki", autoPause: "⏸ Simamisha", refresh: "⟳ Fanya upya", translate: "🌐 Tafsiri", weather: "Hali ya hewa", games: "Michezo", ai: "AI", myLocation: "📍 Eneo", cityPlaceholder: "Andika jiji (lolo lote duniani)", widgetsTitle: "Bodi iliyobatizwa", discoverTitle: "Gundua API za bure ulimwenguni", discoverHint: "Tafuta API za umma za bure bila ufunguo duniani. Bofya kutembelea.", discoverSearch: "Tafuta API, mf. weather / translate / image …", hot: "Trendi", fun: "Burudani", market: "Masoko", football: "Mpira", loading: "Inakusanya mtiririko…", more: "↓ Sogeza chini · mtiririko unaendelea", end: "✓ Umefika mwisho · bonyeza ⟳ kusasisha", demo: "Hali ya onyesho · hakuna aggregator iliyounganishwa; mifano iliyojumuishwa. Data ya moja kwa moja baada ya kutumia Cloudflare", stale: "Mlisho wa moja kwa moja haupatikani · inaonyesha picha ya hivi karibuni", noResult: "Hakuna API zinazofaa.", foot1: "Vyanzo: Weibo/Baidu/Douyin · Hacker News · Open-Meteo · Epic · Exchangerate/Binance · OpenLigaDB · HuggingFace", foot2: "Kwenye Cloudflare Pages · mganganyo wa seva, bila ufunguo, bila CORS · imefasiriwa na MyMemory" },
  ca: { tagline: "Flux infinit · Multifont · Informació global, feta per a tu", all: "Totes", autoStart: "▶ Auto-scroll", autoPause: "⏸ Pausa", refresh: "⟳ Actualitza", translate: "🌐 Tradueix", weather: "Temps", games: "Jocs", ai: "IA", myLocation: "📍 Ubicació", cityPlaceholder: "Escriu una ciutat (arreu del món)", widgetsTitle: "Tauler fixat", discoverTitle: "Descobreix API gratuïtes", discoverHint: "Cerca API públiques gratuïtes sense clau arreu del món. Fes clic per visitar.", discoverSearch: "Cerca API, ex. weather / translate / image …", hot: "Tendències", fun: "Entreteniment", market: "Mercats", football: "Futbol", loading: "Recollint el flux…", more: "↓ Desplaça't · el flux continua", end: "✓ Al dia · toca ⟳ per actualitzar", demo: "Mode demostració · agregador no connectat; mostres integrades. Dades en viu després de desplegar a Cloudflare", stale: "El flux en directe no està disponible · mostrant la darrera captura", noResult: "No s'han trobat API.", foot1: "Fonts: Weibo/Baidu/Douyin · Hacker News · Open-Meteo · Epic · Exchangerate/Binance · OpenLigaDB · HuggingFace", foot2: "A Cloudflare Pages · agregació al servidor, sense clau, sense CORS · traduït per MyMemory" },
  eu: { tagline: "Fluxu amaigaitza · Iturri anitz · Informazio globala, zuretzat", all: "Guztiak", autoStart: "▶ Korritze automatikoa", autoPause: "⏸ Pausatu", refresh: "⟳ Eguneratu", translate: "🌐 Itzuli", weather: "Eguraldia", games: "Jokoak", ai: "AI", myLocation: "📍 Kokapena", cityPlaceholder: "Idatzi hiri bat (mundu osoan)", widgetsTitle: "Finkatutako taula", discoverTitle: "Aurkitu doako API globalak", discoverHint: "Bilatu mundu osoko API publiko doakoak, gakorik gabe. Egin klik bisitatzeko.", discoverSearch: "Bilatu API, adib. weather / translate / image …", hot: "Joerak", fun: "Entretenimendua", market: "Merkatuak", football: "Futbola", loading: "Fluxua biltzen…", more: "↓ Korritu behera · fluxuak jarraitzen du", end: "✓ Amaituta · ⟳ freskatzeko", demo: "Demo modua · bateratzailea ez dago konektatuta; barneko laginak. Cloudflare-n hedatzean datu bizia", stale: "Zuzeneko jarioa ez dago eskuragarria · azken iruzkina erakusten", noResult: "Ez da API bat ere aurkitu.", foot1: "Iturriak: Weibo/Baidu/Douyin · Hacker News · Open-Meteo · Epic · Exchangerate/Binance · OpenLigaDB · HuggingFace", foot2: "Cloudflare Pages-en · zerbitzariko bateratzea, gakorik gabe, CORS gabe · MyMemory-k itzulia" },
  cy: { tagline: "Llifddyfais ddi-derfyn · Llawer ffynhonnell · Gwybodaeth fyd-eang, wedi'i gwneud i chi", all: "Pawb", autoStart: "▶ Awto-roll", autoPause: "⏸ Seibio", refresh: "⟳ Adfywio", translate: "🌐 Cyfieithu", weather: "Tywydd", games: "Gemau", ai: "AI", myLocation: "📍 Fy lle", cityPlaceholder: "Teipiwch ddinas (unrhyw le yn y byd)", widgetsTitle: "Panel sefydlog", discoverTitle: "Darganfyddwch APIau rhad ac am ddim byd-eang", discoverHint: "Chwiliwch am APIau cyhoeddus rhad ac am ddim heb allwedd ledled y byd. Cliciwch i ymweld.", discoverSearch: "Chwilio APIau, e.e. weather / translate / image …", hot: "Trendiau", fun: "Adloniant", market: "Marchnadoedd", football: "Pêl-droed", loading: "Yn casglu'r llif…", more: "↓ Rholiwch i lawr · mae'r llif yn parhau", end: "✓ Wedi'i weld · ⟳ i adfywio", demo: "Modd dangos · dim aggregator wedi'i gysylltu; samplau mewnol. Data byw ar ôl defnyddio Cloudflare", stale: "Nid yw'r llwybr byw ar gael · dangos y rhosyn diweddaraf", noResult: "Dim APIau cydweddu wedi'u darganfod.", foot1: "Ffynonellau: Weibo/Baidu/Douyin · Hacker News · Open-Meteo · Epic · Exchangerate/Binance · OpenLigaDB · HuggingFace", foot2: "Ar Cloudflare Pages · cronni ar y gweinydd, heb allwedd, heb CORS · wedi'i gyfieithu gan MyMemory" },
  gl: { tagline: "Fluxo infinito · Multifonte · Información global, feita para ti", all: "Todos", autoStart: "▶ Auto-scroll", autoPause: "⏸ Pausa", refresh: "⟳ Actualizar", translate: "🌐 Traducir", weather: "Tempo", games: "Xogos", ai: "IA", myLocation: "📍 Localización", cityPlaceholder: "Escribe unha cidade (en calquera lugar)", widgetsTitle: "Panel fixo", discoverTitle: "Descubre API gratuítas", discoverHint: "Busca API públicas gratuítas sen clave no mundo. Fai clic para visitar.", discoverSearch: "Buscar API, ex. weather / translate / image …", hot: "Tendencias", fun: "Entretemento", market: "Mercados", football: "Fútbol", loading: "Reunindo o fluxo…", more: "↓ Desprazar abaixo · o fluxo segue", end: "✓ Ao día · toca ⟳ para actualizar", demo: "Modo demo · agregador non conectado; mostras integradas. Datos en vigo despois de despregar en Cloudflare", stale: "A transmisión en directo non está dispoñible · amosando a última instantánea", noResult: "Non se atoparon API.", foot1: "Fuentes: Weibo/Baidu/Douyin · Hacker News · Open-Meteo · Epic · Exchangerate/Binance · OpenLigaDB · HuggingFace", foot2: "En Cloudflare Pages · agregación no servidor, sen clave, sen CORS · traducido por MyMemory" },
  eo: { tagline: "Senfina fluo · Plurfonta · Globa informo, farita por vi", all: "Ĉiuj", autoStart: "▶ Aŭtomata rulo", autoPause: "⏸ Paŭzo", refresh: "⟳ Ĝisdatigi", translate: "🌐 Traduki", weather: "Vetero", games: "Ludoj", ai: "AI", myLocation: "📍 Loko", cityPlaceholder: "Tajpu urbon (ie ajn en la mondo)", widgetsTitle: "Fiksita panelo", discoverTitle: "Malkovru senpagajn tutmondajn API-ojn", discoverHint: "Serĉu senpagajn publikajn API-ojn sen ŝlosilo tra la mondo. Alklaku por viziti.", discoverSearch: "Serĉu API-ojn, ekz. weather / translate / image …", hot: "Tendencoj", fun: "Distro", market: "Merkatoj", football: "Piedpilko", loading: "Kolektante la fluon…", more: "↓ Rulu suben · la fluo daŭras", end: "✓ Ĉio legita · ⟳ por refreŝigi", demo: "Demonstracia reĝimo · agregilo ne konektita; enkonstruitaj specimenoj. Vivaj datumoj post deployo sur Cloudflare", stale: "Rektaj fluo ne disponeblas · montrante la lastan bildeton", noResult: "Neniu kongrua API trovita.", foot1: "Fontoj: Weibo/Baidu/Douyin · Hacker News · Open-Meteo · Epic · Exchangerate/Binance · OpenLigaDB · HuggingFace", foot2: "Sur Cloudflare Pages · servila agregado, sen ŝlosilo, sen CORS · tradukita de MyMemory" },
};

// 类目 -> i18n 键。
// v2.4：类目不再由前端定义（那是旧 cat= 架构的遗留），而是由 sources.js 给每张卡片打的
// category 标签决定。这里只做「显示名」映射，未收录的类目直接显示服务端给的原文
// —— 宁可显示英文原名，也不要显示一个错的翻译。
const CAT_KEY = {
  "热搜": "hot", "境内热搜": "hot", "国际要闻": "worldNews", "头条": "topNews", "地区": "region",
  "娱乐": "fun", "市场": "market", "足球": "football", "天气": "weather", "游戏": "games",
  "AI": "ai", "AI 快讯": "ai", "AI 商业": "ai", "AI 产品": "ai", "AI 论文": "aiPapers",
  "大模型": "aiModels", "芯片算力": "aiChips", "技术社区": "tech",
  "游戏·本周": "catThisWeek", "游戏·即将": "catUpcoming", "游戏·长期": "catForever",
};

// 类目强调色。新增类目必须同时在这里登记颜色，否则卡片会退回默认橙。
const CAT_COLOR = {
  "热搜": "#e8553b", "境内热搜": "#e8553b",
  "娱乐": "#f0902a",
  "天气": "#e0a83c",
  "游戏": "#c0659a",
  "市场": "#4f9e6a",
  "足球": "#c47b3c",
  "AI": "#d9922b", "AI 快讯": "#d9922b", "AI 商业": "#c07d1f",
  "AI 产品": "#e0a02c", "AI 论文": "#8a6fbd", "大模型": "#c9852b", "芯片算力": "#9a6fb8",
  "国际要闻": "#3f7fbf", "头条": "#3f7fbf", "地区": "#5b8f7a",
  "技术社区": "#6f7f8f",
  // 三态用同一紫做深浅区分：本周=饱和（有截止，最扎眼），即将=中调，长期=低饱和
  // （随时能领，不该抢本周的风头）。比红/蓝/绿更容易看出「是一家」。
  "游戏·本周": "#c0659a", "游戏·即将": "#8a6b96", "游戏·长期": "#6f6a86",
};

// 内置演示数据（构建期由真实聚合函数抓取，覆盖全部类目）
const DEMO_ALL = [{ "category": "热搜", "title": "易梦玲在巴黎行李被偷", "url": "https://www.baidu.com/s?wd=%E6%98%93%E6%A2%A6%E7%8E%B2%E5%9C%A8%E5%B7%B4%E9%BB%8E%E8%A1%8C%E6%9D%8E%E8%A2%AB%E5%81%B7&sa=fyb_news&rsv_dl=fyb_news", "desc": "10月20日，易梦玲在社媒分享了自己的巴黎时装周vlog，并配文：“万！万！没！想！到！登机箱和随身包在机场被偷了！在打印行李票的时候一转身发现没有了。所有相机设备都在登机箱里，我的旧护照里面还有签证，后续的工作也耽误了。”", "img": "https://fyb-2.cdn.bcebos.com/hotboard_image/807dba2c165a0bfc15b8e14873408280", "meta": "🔥 542万", "source": "百度", "lang": "zh" }, { "category": "娱乐", "title": "早秋姐系穿搭法则", "url": "https://www.douyin.com/search/%E6%97%A9%E7%A7%8B%E5%A7%90%E7%B3%BB%E7%A9%BF%E6%90%AD%E6%B3%95%E5%88%99", "meta": "🔥 768万", "source": "抖音", "lang": "zh" }, { "category": "热搜", "title": "“局部打光了 也得打”", "url": "https://www.baidu.com/s?wd=%E2%80%9C%E5%B1%80%E9%83%A8%E6%89%93%E5%85%89%E4%BA%86+%E4%B9%9F%E5%BE%97%E6%89%93%E2%80%9D&sa=fyb_news&rsv_dl=fyb_news", "desc": "1936年春，红二、红六军团在乌蒙山回旋战中，以一万兵力牵制十几万敌军。面对10:1的兵力劣势，红军在乌蒙山辗转伏击成功突围。毛主席称赞“一万人走过来还是一万人，是个奇迹”。贺龙表示“局部打光了也得打”，揭示了顾全大局的长征胜利密码。", "img": "https://fyb-2.cdn.bcebos.com/hotboard_image/7b1a4086661f7caef8f854b25a1e2167", "meta": "🔥 598万", "source": "百度", "lang": "zh" }, { "category": "热搜", "title": "长征万里险 最忆夹金山", "url": "https://www.baidu.com/s?wd=%E9%95%BF%E5%BE%81%E4%B8%87%E9%87%8C%E9%99%A9+%E6%9C%80%E5%BF%86%E5%A4%B9%E9%87%91%E5%B1%B1&sa=fyb_news&rsv_dl=fyb_news", "desc": "长征万里险，最忆夹金山。此前，当地民谣称夹金山“鸟儿飞不过，凡人不敢攀”，当年红军用双脚丈量，用血肉铺就了风雪长征路。如今，长征精神如同不灭灯火，跨越万水千山，照亮我们的奋进之路。", "img": "https://fyb-2.cdn.bcebos.com/hotboard_image/dc2d988e6d0163e9ac09942b44ce136a", "meta": "🔥 312万", "source": "百度", "lang": "zh" }, { "category": "热搜", "title": "法国乱成一锅粥了还有人威胁中国", "url": "https://s.weibo.com/weibo?q=法国乱成一锅粥了还有人威胁中国", "meta": "🔥 92万", "source": "微博", "lang": "zh" }, { "category": "娱乐", "title": "KDA新歌神之八秒", "url": "https://www.douyin.com/search/KDA%E6%96%B0%E6%AD%8C%E7%A5%9E%E4%B9%8B%E5%85%AB%E7%A7%92", "meta": "🔥 781万", "source": "抖音", "lang": "zh" }, { "category": "娱乐", "title": "NBA活塞121:113逆转凯尔特人", "url": "https://www.douyin.com/search/NBA%E6%B4%BB%E5%A1%9E121%3A113%E9%80%86%E8%BD%AC%E5%87%AF%E5%B0%94%E7%89%B9%E4%BA%BA", "meta": "🔥 801万", "source": "抖音", "lang": "zh" }, { "category": "娱乐", "title": "一顶假发拿捏秋冬氛围感", "url": "https://www.douyin.com/search/%E4%B8%80%E9%A1%B6%E5%81%87%E5%8F%91%E6%8B%BF%E6%8D%8F%E7%A7%8B%E5%86%AC%E6%B0%9B%E5%9B%B4%E6%84%9F", "meta": "🔥 765万", "source": "抖音", "lang": "zh" }, { "category": "娱乐", "title": "秋冬的第一件情侣装", "url": "https://www.douyin.com/search/%E7%A7%8B%E5%86%AC%E7%9A%84%E7%AC%AC%E4%B8%80%E4%BB%B6%E6%83%85%E4%BE%A3%E8%A3%85", "meta": "🔥 771万", "source": "抖音", "lang": "zh" }, { "category": "热搜", "title": "又一地宣布：生物地理不计入中考总分", "url": "https://www.baidu.com/s?wd=%E5%8F%88%E4%B8%80%E5%9C%B0%E5%AE%A3%E5%B8%83%EF%BC%9A%E7%94%9F%E7%89%A9%E5%9C%B0%E7%90%86%E4%B8%8D%E8%AE%A1%E5%85%A5%E4%B8%AD%E8%80%83%E6%80%BB%E5%88%86&sa=fyb_news&rsv_dl=fyb_news", "desc": "10月20日，江苏省徐州市教育局宣布，地理、生物学科原始成绩不计入中考录取总分，成绩以等级形式呈现。该政策自2025年秋季入学的七年级学生起执行。此前，北京、吉林、陕西咸阳等多地也已明确将生物、地理调整为考查科目，以等级呈现。", "img": "https://fyb-2.cdn.bcebos.com/hotboard_image/06c08333ac4253e8e20456044f94b72b", "meta": "🔥 752万", "source": "百度", "lang": "zh" }, { "category": "热搜", "title": "唐禹哲获刑1年7个月缓刑3年", "url": "https://s.weibo.com/weibo?q=唐禹哲获刑1年7个月缓刑3年", "meta": "🔥 21万", "source": "微博", "lang": "zh" }, { "category": "热搜", "title": "Sixteen Years After Deepwater Horizon, Deep Sea Life Shows Few Signs of Recovery", "url": "https://e360.yale.edu/digest/deepwater-horizon-deep-sea-recovery", "desc": "▲ 204 · speckx", "meta": "🔥 Hacker News", "source": "Hacker News", "lang": "en" }, { "category": "热搜", "title": "Good type against all odds", "url": "https://unsung.aresluna.org/good-type-against-all-odds/", "desc": "▲ 14 · firloop", "meta": "🔥 Hacker News", "source": "Hacker News", "lang": "en" }, { "category": "AI", "title": "Any 3D Scene is Worth 1K Tokens: 3D-Grounded Representation for Scene Generation at Scale", "desc": "Scene-level 3D generation has long been dominated by 2D multi-view or video diffusion models. Typically, these 2D-based approaches perform scene generation in a", "url": "https://huggingface.co/papers/2604.11331", "meta": "🤖 2026-10-19", "source": "HuggingFace", "lang": "en" }, { "category": "热搜", "title": "队旗缝进百褶裙夹层", "url": "https://www.baidu.com/s?wd=%E9%98%9F%E6%97%97%E7%BC%9D%E8%BF%9B%E7%99%BE%E8%A4%B6%E8%A3%99%E5%A4%B9%E5%B1%82&sa=fyb_news&rsv_dl=fyb_news", "desc": "1950年，四川凉山州冕宁县解放，彝族妇人倮伍伍加嫫将队旗献给解放军。1935年5月22日，刘伯承与彝族头人小叶丹歃血为盟并赠其队旗。1942年，小叶丹离世前叮嘱妻子保管队旗，等红军回来。为躲避国民党追究，其妻将队旗缝进百褶裙夹层。该队旗历经十五年的守护，现珍藏于中国人民革命军事博物馆。", "img": "https://fyb-2.cdn.bcebos.com/hotboard_image/9930ddac228fec7cedf06a9fc68670ef", "meta": "🔥 695万", "source": "百度", "lang": "zh" }, { "category": "足球", "title": "Borussia Mönchengladbach vs TSG Hoffenheim", "desc": "0 : 1", "meta": "德甲 · 6. Spieltag", "source": "OpenLigaDB", "lang": "en" }, { "category": "热搜", "title": "鼓浪屿冷清不复当年盛景", "url": "https://s.weibo.com/weibo?q=鼓浪屿冷清不复当年盛景", "meta": "🔥 21万", "source": "微博", "lang": "zh" }, { "category": "热搜", "title": "The Other Epidemic: Trying to get off benzodiazepines", "url": "https://www.thebeliever.net/the-other-epidemic/", "desc": "▲ 70 · gaplong", "meta": "🔥 Hacker News", "source": "Hacker News", "lang": "en" }, { "category": "AI", "title": "Progress-Aware Distillation for Mitigating Stagnation in Small Language Model Agents", "desc": "While LLM-based agent systems have demonstrated remarkable proficiency in reasoning and solving complex real-world tasks, they also come with substantial token ", "url": "https://huggingface.co/papers/2610.19439", "meta": "🤖 2026-10-17", "source": "HuggingFace", "lang": "en" }, { "category": "热搜", "title": "Apple broke an essential presentation feature of iPads", "url": "https://teddysvoronos.com/2026-10-19-apple-broke-an-essential-presentation-feature-of-ipads/", "desc": "▲ 500 · evanb", "meta": "🔥 Hacker News", "source": "Hacker News", "lang": "en" }, { "category": "娱乐", "title": "小城良方弟弟怀疑自己不是亲生", "url": "https://www.douyin.com/search/%E5%B0%8F%E5%9F%8E%E8%89%AF%E6%96%B9%E5%BC%9F%E5%BC%9F%E6%80%80%E7%96%91%E8%87%AA%E5%B7%B1%E4%B8%8D%E6%98%AF%E4%BA%B2%E7%94%9F", "meta": "🔥 768万", "source": "抖音", "lang": "zh" }, { "category": "娱乐", "title": "刘晓艳郑马名场面渲染大赛", "url": "https://www.douyin.com/search/%E5%88%98%E6%99%93%E8%89%B3%E9%83%91%E9%A9%AC%E5%90%8D%E5%9C%BA%E9%9D%A2%E6%B8%B2%E6%9F%93%E5%A4%A7%E8%B5%9B", "meta": "🔥 776万", "source": "抖音", "lang": "zh" }, { "category": "娱乐", "title": "跟随魏娆体会成长型爽文人生", "url": "https://www.douyin.com/search/%E8%B7%9F%E9%9A%8F%E9%AD%8F%E5%A8%86%E4%BD%93%E4%BC%9A%E6%88%90%E9%95%BF%E5%9E%8B%E7%88%BD%E6%96%87%E4%BA%BA%E7%94%9F", "meta": "🔥 777万", "source": "抖音", "lang": "zh" }, { "category": "娱乐", "title": "南北吃蟹大不同", "url": "https://www.douyin.com/search/%E5%8D%97%E5%8C%97%E5%90%83%E8%9F%B9%E5%A4%A7%E4%B8%8D%E5%90%8C", "meta": "🔥 764万", "source": "抖音", "lang": "zh" }, { "category": "游戏", "title": "Luftrausers", "desc": "The skies are aflame and the seas will overflow with wreckage in Vlambeer’s stylish arcade shooter LUFTRAUSERS! Take to the skies in customi", "url": "https://store.epicgames.com/", "meta": "🎮 免费领取 · Epic", "source": "Epic", "lang": "en" }, { "category": "热搜", "title": "巴黎圣日耳曼4比2巴萨", "url": "https://s.weibo.com/weibo?q=巴黎圣日耳曼4比2巴萨", "meta": "🔥 49万", "source": "微博", "lang": "zh" }, { "category": "娱乐", "title": "当东北人假装南方人", "url": "https://www.douyin.com/search/%E5%BD%93%E4%B8%9C%E5%8C%97%E4%BA%BA%E5%81%87%E8%A3%85%E5%8D%97%E6%96%B9%E4%BA%BA", "meta": "🔥 931万", "source": "抖音", "lang": "zh" }, { "category": "热搜", "title": "大冰掏心掏肺谈职场", "url": "https://s.weibo.com/weibo?q=大冰掏心掏肺谈职场", "meta": "🔥 16万", "source": "微博", "lang": "zh" }, { "category": "足球", "title": "FC Schalke 04 vs 1. FSV Mainz 05", "desc": "0 : 1", "meta": "德甲 · 6. Spieltag", "source": "OpenLigaDB", "lang": "en" }, { "category": "热搜", "title": "伟大远征 精神永续", "url": "https://www.baidu.com/s?wd=%E4%BC%9F%E5%A4%A7%E8%BF%9C%E5%BE%81+%E7%B2%BE%E7%A5%9E%E6%B0%B8%E7%BB%AD&sa=fyb_news&rsv_dl=fyb_news", "desc": "信仰不灭，征程永恒。今年是中国工农红军长征胜利90周年。《时政微观察》与你一起在致敬英雄中赓续伟大长征精神，在抚今追昔中坚定前行意志，走好新时代长征路。", "img": "https://fyb-2.cdn.bcebos.com/hotboard_image/17db9b69dbaf2844081993a3bdb29e6e", "meta": "🔥 790万", "source": "百度", "lang": "zh" }, { "category": "热搜", "title": "古人的东方审美藏在济南城", "url": "https://s.weibo.com/weibo?q=古人的东方审美藏在济南城", "meta": "🔥 48万", "source": "微博", "lang": "zh" }, { "category": "游戏", "title": "Monument Valley", "desc": "Embark on a journey of forgiveness through impossible environments and illusionary puzzles. Experience this meditative and calming puzzle ga", "url": "https://store.epicgames.com/", "meta": "🎮 免费领取 · Epic", "source": "Epic", "lang": "en" }, { "category": "市场", "title": "美元 → 人民币", "desc": "1 USD ≈ 6.6913 ¥", "meta": "💱 汇率 · Exchangerate", "source": "汇率", "lang": "zh" }, { "category": "热搜", "title": "刘雯维密回归太权威了", "url": "https://s.weibo.com/weibo?q=刘雯维密回归太权威了", "meta": "🔥 23万", "source": "微博", "lang": "zh" }, { "category": "热搜", "title": "王凯说我全唱别人的歌开什么演唱会", "url": "https://s.weibo.com/weibo?q=王凯说我全唱别人的歌开什么演唱会", "meta": "🔥 16万", "source": "微博", "lang": "zh" }, { "category": "娱乐", "title": "不烧心可可妆", "url": "https://www.douyin.com/search/%E4%B8%8D%E7%83%A7%E5%BF%83%E5%8F%AF%E5%8F%AF%E5%A6%86", "meta": "🔥 764万", "source": "抖音", "lang": "zh" }, { "category": "娱乐", "title": "妲己配音大赛", "url": "https://www.douyin.com/search/%E5%A6%B2%E5%B7%B1%E9%85%8D%E9%9F%B3%E5%A4%A7%E8%B5%9B", "meta": "🔥 767万", "source": "抖音", "lang": "zh" }, { "category": "热搜", "title": "王一博是istp", "url": "https://s.weibo.com/weibo?q=王一博是istp", "meta": "🔥 28万", "source": "微博", "lang": "zh" }, { "category": "热搜", "title": "法国将部署军队反恐力量应对示威活动", "url": "https://www.baidu.com/s?wd=%E6%B3%95%E5%9B%BD%E5%B0%86%E9%83%A8%E7%BD%B2%E5%86%9B%E9%98%9F%E5%8F%8D%E6%81%90%E5%8A%9B%E9%87%8F%E5%BA%94%E5%AF%B9%E7%A4%BA%E5%A8%81%E6%B4%BB%E5%8A%A8&sa=fyb_news&rsv_dl=fyb_news", "desc": "法国内政部长努内兹20日说，为更好应对预计于24日举行的示威活动可能引发的暴力事件，法国政府将部署法军反恐力量“哨兵”行动的士兵增援警察和宪兵。", "img": "https://fyb-2.cdn.bcebos.com/hotboard_image/7dc7175b28ced3ae66ae3b76b60b8f75", "meta": "🔥 408万", "source": "百度", "lang": "zh" }, { "category": "热搜", "title": "DeepInfer: High-performance inference framework for DeepSeek models", "url": "https://github.com/deepseek-ai/DeepInfer", "desc": "▲ 2145 · ggcr", "meta": "🔥 Hacker News", "source": "Hacker News", "lang": "en" }, { "category": "热搜", "title": "张柏芝自曝五点起床陪儿子一整天", "url": "https://s.weibo.com/weibo?q=张柏芝自曝五点起床陪儿子一整天", "meta": "🔥 11万", "source": "微博", "lang": "zh" }, { "category": "娱乐", "title": "同心同行长征路", "url": "https://www.douyin.com/search/%E5%90%8C%E5%BF%83%E5%90%8C%E8%A1%8C%E9%95%BF%E5%BE%81%E8%B7%AF", "meta": "🔥 1195万", "source": "抖音", "lang": "zh" }, { "category": "热搜", "title": "旭日旗事件涉事学生曾骂劝阻同学", "url": "https://s.weibo.com/weibo?q=旭日旗事件涉事学生曾骂劝阻同学", "meta": "🔥 11万", "source": "微博", "lang": "zh" }, { "category": "AI", "title": "SolarRenderer: Few-Step Generative Reference Rendering", "desc": "Game engines and coding agents can specify the layout, motion, and camera of a scene, yet turning such coarse structure into realistic video requires a renderer", "url": "https://huggingface.co/papers/2610.28630", "meta": "🤖 2026-10-20", "source": "HuggingFace", "lang": "en" }, { "category": "娱乐", "title": "奚梦瑶12张图晒维密工作花絮", "url": "https://www.douyin.com/search/%E5%A5%9A%E6%A2%A6%E7%91%B612%E5%BC%A0%E5%9B%BE%E6%99%92%E7%BB%B4%E5%AF%86%E5%B7%A5%E4%BD%9C%E8%8A%B1%E7%B5%AE", "meta": "🔥 771万", "source": "抖音", "lang": "zh" }, { "category": "热搜", "title": "00后北漂患上“扔垃圾羞耻”", "url": "https://www.baidu.com/s?wd=00%E5%90%8E%E5%8C%97%E6%BC%82%E6%82%A3%E4%B8%8A%E2%80%9C%E6%89%94%E5%9E%83%E5%9C%BE%E7%BE%9E%E8%80%BB%E2%80%9D&sa=fyb_news&rsv_dl=fyb_news", "desc": "近期，北京部分小区频现“垃圾猎人”，邻居不问自取甚至疯抢纸箱，致北漂青年患上“扔垃圾羞耻”，被迫深夜扔垃圾。目前部分小区引入智能回收机试图缓解，但仍面临机器满载等困境。", "img": "https://fyb-2.cdn.bcebos.com/hotboard_image/254e005b83332986fe6f700ef334ce05", "meta": "🔥 656万", "source": "百度", "lang": "zh" }, { "category": "热搜", "title": "龚宝冬被追记一等功", "url": "https://www.baidu.com/s?wd=%E9%BE%9A%E5%AE%9D%E5%86%AC%E8%A2%AB%E8%BF%BD%E8%AE%B0%E4%B8%80%E7%AD%89%E5%8A%9F&sa=fyb_news&rsv_dl=fyb_news", "desc": "10月20日，应急管理部决定对在基层防灾避险工作中牺牲的龚宝冬追记一等功，对彭迪等11名同志给予记功、嘉奖奖励。此前7月17日，重庆市彭水苗族土家族自治县发生山体崩塌，网格员龚宝冬在转移群众时不幸遇难，彭迪被落石击伤，最终区内60多名居民被安全转移。7月30日，龚宝冬被重庆市政府评定为烈士。", "img": "https://fyb-2.cdn.bcebos.com/hotboard_image/57926c2573d710eec78d83a85984d02d", "meta": "🔥 666万", "source": "百度", "lang": "zh" }, { "category": "热搜", "title": "年轻人每月在养老院服务可减免房租", "url": "https://www.baidu.com/s?wd=%E5%B9%B4%E8%BD%BB%E4%BA%BA%E6%AF%8F%E6%9C%88%E5%9C%A8%E5%85%BB%E8%80%81%E9%99%A2%E6%9C%8D%E5%8A%A1%E5%8F%AF%E5%87%8F%E5%85%8D%E6%88%BF%E7%A7%9F&sa=fyb_news&rsv_dl=fyb_news", "desc": "近日，广西壮族自治区南宁市五象养老服务中心试行“代际共居”模式，青年每月完成不少于50小时助老服务可换取1000元房租减免。这种“代际共居”模式探索为年轻人减轻生活负担，同时为老年人带来富有青春气息的情感陪伴。", "img": "https://fyb-2.cdn.bcebos.com/hotboard_image/ce17234850b8c2530dbf845c6e4cdd60", "meta": "🔥 636万", "source": "百度", "lang": "zh" }, { "category": "热搜", "title": "NBA", "url": "https://s.weibo.com/weibo?q=NBA", "meta": "🔥 35万", "source": "微博", "lang": "zh" }, { "category": "热搜", "title": "天猫双11百大爆款清单发布", "url": "https://s.weibo.com/weibo?q=天猫双11百大爆款清单发布", "meta": "🔥 89万", "source": "微博", "lang": "zh" }, { "category": "市场", "title": "日元 → 人民币", "desc": "1 JPY ≈ 4.229 ¥", "meta": "💱 汇率 · Exchangerate", "source": "汇率", "lang": "zh" }, { "category": "市场", "title": "欧元 → 人民币", "desc": "1 EUR ≈ 7.5120 ¥", "meta": "💱 汇率 · Exchangerate", "source": "汇率", "lang": "zh" }, { "category": "热搜", "title": "崔秀彬公司未回应", "url": "https://s.weibo.com/weibo?q=崔秀彬公司未回应", "meta": "🔥 16万", "source": "微博", "lang": "zh" }, { "category": "热搜", "title": "中使馆预警 泰方：普通游客不会遭绑架", "url": "https://www.baidu.com/s?wd=%E4%B8%AD%E4%BD%BF%E9%A6%86%E9%A2%84%E8%AD%A6+%E6%B3%B0%E6%96%B9%EF%BC%9A%E6%99%AE%E9%80%9A%E6%B8%B8%E5%AE%A2%E4%B8%8D%E4%BC%9A%E9%81%AD%E7%BB%91%E6%9E%B6&sa=fyb_news&rsv_dl=fyb_news", "desc": "近期，中国驻泰国大使馆发布旅游安全预警。据外媒报道，泰国旅游与体育部长素拉沙10月20日对此回应称，泰国政府高度重视游客安全，并澄清“普通游客不会在泰国被强行塞入车辆或押送至边境”，涉事者多是在出境前已被骗。", "img": "https://fyb-2.cdn.bcebos.com/hotboard_image/7dc7175b28ced3ae66ae3b76b60b8f75", "meta": "🔥 609万", "source": "百度", "lang": "zh" }, { "category": "娱乐", "title": "长今你在工作里加了什么啊", "url": "https://www.douyin.com/search/%E9%95%BF%E4%BB%8A%E4%BD%A0%E5%9C%A8%E5%B7%A5%E4%BD%9C%E9%87%8C%E5%8A%A0%E4%BA%86%E4%BB%80%E4%B9%88%E5%95%8A", "meta": "🔥 778万", "source": "抖音", "lang": "zh" }, { "category": "热搜", "title": "蔡天凤前公公买绞肉机监控曝光", "url": "https://s.weibo.com/weibo?q=蔡天凤前公公买绞肉机监控曝光", "meta": "🔥 46万", "source": "微博", "lang": "zh" }, { "category": "娱乐", "title": "宝青坊主cos", "url": "https://www.douyin.com/search/%E5%AE%9D%E9%9D%92%E5%9D%8A%E4%B8%BBcos", "meta": "🔥 765万", "source": "抖音", "lang": "zh" }, { "category": "游戏", "title": "Lost Castle: The Old Ones Awaken", "desc": "The Old Ones Awaken adds new levels to explore, new enemies to defeat, and new bosses to face along with a host exciting new weapons and equ", "url": "https://store.epicgames.com/", "meta": "🎮 免费领取 · Epic", "source": "Epic", "lang": "en" }, { "category": "热搜", "title": "西太平洋战鼓隆隆 中美日排兵布阵", "url": "https://www.baidu.com/s?wd=%E8%A5%BF%E5%A4%AA%E5%B9%B3%E6%B4%8B%E6%88%98%E9%BC%93%E9%9A%86%E9%9A%86+%E4%B8%AD%E7%BE%8E%E6%97%A5%E6%8E%92%E5%85%B5%E5%B8%83%E9%98%B5&sa=fyb_news&rsv_dl=fyb_news", "desc": "近日，西太平洋战鼓隆隆。美日计划于10月19日至29日举行大规模联合军事演习，演习部署至距离台湾仅110公里的与那国岛。对此，解放军这边则提前启动了反制，从10月8日起，大连、秦皇岛、盐城等地陆续发布了航行警告，强势对冲，直接威慑了美日的军演。", "img": "https://fyb-2.cdn.bcebos.com/hotboard_image/3b5127110753533d778ea9025f5dd678", "meta": "🔥 647万", "source": "百度", "lang": "zh" }, { "category": "热搜", "title": "Voxtral 3", "url": "https://mistral.ai/news/voxtral-3/", "desc": "▲ 535 · ilreb", "meta": "🔥 Hacker News", "source": "Hacker News", "lang": "en" }, { "category": "天气", "title": "武汉 ☀️", "desc": "晴 18°C · 湿度62% · 风速17.2km/h", "meta": "武汉 · Open-Meteo", "source": "Open-Meteo", "lang": "zh" }, { "category": "天气", "title": "重庆 ☁️", "desc": "阴 19°C · 湿度93% · 风速4.1km/h", "meta": "重庆 · Open-Meteo", "source": "Open-Meteo", "lang": "zh" }, { "category": "热搜", "title": "特斯拉“能飞” 我们就被甩开了？", "url": "https://www.baidu.com/s?wd=%E7%89%B9%E6%96%AF%E6%8B%89%E2%80%9C%E8%83%BD%E9%A3%9E%E2%80%9D+%E6%88%91%E4%BB%AC%E5%B0%B1%E8%A2%AB%E7%94%A9%E5%BC%80%E4%BA%86%EF%BC%9F&sa=fyb_news&rsv_dl=fyb_news", "desc": "最近特斯拉发布“会飞的汽车”引发热议，有人惊呼“我们被甩开了”。对此，媒体指出不必妄自菲薄。特斯拉此次“飞行”更像概念秀，而中国汽车在速度、充电、智驾及飞行领域均有系统性硬功夫与多维突破，中国汽车产业不惧同台比拼。", "img": "https://fyb-2.cdn.bcebos.com/hotboard_image/8dc894c9379dbe1839ad97839302e0f4", "meta": "🔥 732万", "source": "百度", "lang": "zh" }, { "category": "热搜", "title": "活塞22分逆转凯尔特人", "url": "https://s.weibo.com/weibo?q=活塞22分逆转凯尔特人", "meta": "🔥 13万", "source": "微博", "lang": "zh" }, { "category": "热搜", "title": "美舰首次在仙宾礁挑衅 背后有何算计", "url": "https://www.baidu.com/s?wd=%E7%BE%8E%E8%88%B0%E9%A6%96%E6%AC%A1%E5%9C%A8%E4%BB%99%E5%AE%BE%E7%A4%81%E6%8C%91%E8%A1%85+%E8%83%8C%E5%90%8E%E6%9C%89%E4%BD%95%E7%AE%97%E8%AE%A1&sa=fyb_news&rsv_dl=fyb_news", "desc": "20日，解放军南部战区通报，当日凌晨美“查尔斯顿”号濒海战斗舰未经允许冲闯中国南沙群岛仙宾礁附近海域，中方组织兵力跟踪监视。专家解读，这是美舰首次在仙宾礁挑衅，意在试探中方立场并为近期频繁挑衅的菲律宾提供军事背书，以低成本搅局南海。", "img": "https://fyb-2.cdn.bcebos.com/hotboard_image/e36288d07f33cb7de7ad8814cd9490c2", "meta": "🔥 330万", "source": "百度", "lang": "zh" }, { "category": "AI", "title": "Harness-Delta Attribution: Dissecting Gains From Harness Evolution", "desc": "Harness evolution automatically optimizes the prompts, skills, tools, and orchestration code around a fixed-weight model, offering a way to improve agentic syst", "url": "https://huggingface.co/papers/2610.22466", "meta": "🤖 2026-10-15", "source": "HuggingFace", "lang": "en" }, { "category": "热搜", "title": "2岁幼童坠亡后母亲暴瘦11斤", "url": "https://s.weibo.com/weibo?q=2岁幼童坠亡后母亲暴瘦11斤", "meta": "🔥 15万", "source": "微博", "lang": "zh" }, { "category": "热搜", "title": "中年男子骑车载白发老人看哭网友", "url": "https://www.baidu.com/s?wd=%E4%B8%AD%E5%B9%B4%E7%94%B7%E5%AD%90%E9%AA%91%E8%BD%A6%E8%BD%BD%E7%99%BD%E5%8F%91%E8%80%81%E4%BA%BA%E7%9C%8B%E5%93%AD%E7%BD%91%E5%8F%8B&sa=fyb_news&rsv_dl=fyb_news", "desc": "近日，一拍摄者看到中年男子骑车载白发老人，觉得画面中的父子很幸福。此前其父亲于去年过世，拍摄者联想到自己无法再载父亲，既感动又心酸，坦言留下了很多遗憾。", "img": "https://fyb-2.cdn.bcebos.com/hotboard_image/033d5d9b6f3b9bbea06231e61267304e", "meta": "🔥 628万", "source": "百度", "lang": "zh" }, { "category": "天气", "title": "深圳 ☀️", "desc": "晴 32°C · 湿度50% · 风速9.4km/h", "meta": "深圳 · Open-Meteo", "source": "Open-Meteo", "lang": "zh" }, { "category": "娱乐", "title": "NBA揭幕战76人vs尼克斯", "url": "https://www.douyin.com/search/NBA%E6%8F%AD%E5%B9%95%E6%88%9876%E4%BA%BAvs%E5%B0%BC%E5%85%8B%E6%96%AF", "meta": "🔥 888万", "source": "抖音", "lang": "zh" }];
// 内置接口发现清单（演示/离线时使用）
// 本地 file:// 预览用的离线清单。字段与 functions/api/discover.js 的 CURATED 保持一致，
// 含 en 英文别名，否则本地演示模式下英文检索会搜不到东西。
const DEMO_DISCOVER = [
  { name: "Open-Meteo", category: "天气", desc: "全球天气预报，无需密钥、开启 CORS", en: "weather forecast rain temperature meteo climate", link: "https://open-meteo.com/", auth: "None", cors: "Yes" },
  { name: "Hugging Face", category: "AI", desc: "模型与每日 AI 论文", en: "ai llm model dataset inference paper", link: "https://huggingface.co/docs/hub/api", auth: "None", cors: "Yes" },
  { name: "REST Countries", category: "地理", desc: "国家信息：首都、货币、语言", en: "country geo capital currency flag language nation", link: "https://restcountries.com/", auth: "None", cors: "Yes" },
  { name: "CoinGecko", category: "加密", desc: "加密货币价格与历史", en: "crypto bitcoin ethereum price coin market cap blockchain", link: "https://www.coingecko.com/en/api", auth: "None", cors: "Yes" },
  { name: "Open Library", category: "图书", desc: "图书元数据与封面", en: "book library isbn author read literature novel", link: "https://openlibrary.org/developers/api", auth: "None", cors: "Yes" },
  { name: "Wikipedia", category: "知识", desc: "维基百科开放数据", en: "wiki encyclopedia knowledge article search", link: "https://www.mediawiki.org/wiki/API:Main_page", auth: "None", cors: "Yes" },
  { name: "TheMealDB", category: "美食", desc: "食谱与菜品图片", en: "food recipe meal cooking cuisine restaurant dish", link: "https://www.themealdb.com/api.php", auth: "None", cors: "Yes" },
  { name: "TVMaze", category: "影视", desc: "电视剧集信息", en: "tv show series movie episode schedule", link: "https://www.tvmaze.com/api", auth: "None", cors: "Yes" },
  { name: "Free Dictionary", category: "词典", desc: "单词释义与词源", en: "dictionary definition word vocabulary translate language", link: "https://dictionaryapi.dev/", auth: "None", cors: "Yes" },
  { name: "PokeAPI", category: "游戏", desc: "宝可梦全图鉴", en: "pokemon poke game creature monster", link: "https://pokeapi.co/", auth: "None", cors: "Yes" },
  { name: "Deck of Cards", category: "游戏", desc: "虚拟扑克牌洗牌发牌", en: "card deck poker shuffle draw game", link: "https://deckofcardsapi.com/", auth: "None", cors: "Yes" },
  { name: "QR Server", category: "工具", desc: "生成与解析二维码", en: "qr code generator reader decode image", link: "https://goqr.me/api/", auth: "None", cors: "Yes" },
  { name: "The Dog API", category: "图片", desc: "随机狗狗图片与品种", en: "dog pet animal image picture breed", link: "https://dog.ceo/dog-api/", auth: "None", cors: "Yes" },
  { name: "Bored API", category: "活动", desc: "随机活动建议", en: "bored activity idea random fun todo", link: "https://www.boredapi.com/", auth: "None", cors: "Yes" },
  { name: "JSONPlaceholder", category: "开发", desc: "前端测试假数据", en: "mock fake json placeholder test dummy data", link: "https://jsonplaceholder.typicode.com/", auth: "None", cors: "Yes" },
];
function filterDemo(q) {
  if (!q) return DEMO_DISCOVER;
  const s = q.toLowerCase().trim();
  const hit = DEMO_DISCOVER.filter((a) => `${a.name} ${a.category} ${a.desc} ${a.en || ""}`.toLowerCase().includes(s));
  if (hit.length) return hit;
  const words = s.split(/\s+/).filter(Boolean);
  if (words.length < 2) return [];
  return DEMO_DISCOVER.filter((a) => words.some((w) => `${a.name} ${a.category} ${a.desc} ${a.en || ""}`.toLowerCase().includes(w)));
}

// ---------- DOM 引用 ----------
const feed = document.getElementById("feed");
const sentinel = document.getElementById("sentinel");
const statusEl = document.getElementById("status");
const tabsEl = document.getElementById("tabs");
const langSel = document.getElementById("lang");
const translateBtn = document.getElementById("translateBtn");
const autoBtn = document.getElementById("autoBtn");
const refreshBtn = document.getElementById("refreshBtn");
const cityInput = document.getElementById("cityInput");
const cityGo = document.getElementById("cityGo");
const geoBtn = document.getElementById("geoBtn");
const weatherBody = document.getElementById("weatherBody");
const gamesBody = document.getElementById("gamesBody");
const aiBody = document.getElementById("aiBody");
const discoverInput = document.getElementById("discoverInput");
const discoverResults = document.getElementById("discoverResults");
const discoverWrap = document.getElementById("discoverWrap");

// ---------- 状态 ----------
let buffer = [];
let loading = false;
let autoScroll = false;
let hovering = false;
let useDemo = false;
let currentLang = "zh";
let translateEnabled = true;
let feedCursor = 0;            // 演示池子游标（环形，模拟无限）
let feedExhausted = false;     // 真实模式下真没数据了
let ioThrottle = 0;            // IO 节流时间戳

// 真实模式见过的条目。/api/feed 没有分页参数，每次请求都返回整个 tab，
// 所以「buffer 见底 → 再拉一次」拿到的是同一批内容。v2.5 之前这里直接
// concat，用户滚过第一屏之后整页卡片开始逐屏重复，而且永远重复下去
// ——而页面顶上正写着「滚动不息」。按 key 去重既止住重复，又保留了
// 「滚到底顺手再刷一次、可能捡到刚上榜的热搜」这个真实收益。
const feedSeen = new Set();
// key 用四个字段拼：单靠 url 不够（有的源 url 为空），单靠 ts 也不够
// （同秒多条）。用 \0 分隔避免字段值本身含分隔符时误判。
const feedKey = (it) =>
  [it && it.source, it && it.title, it && it.ts, it && it.url].join("\0");

// 天气定位上下文。放在全局是因为 v2.4 的取数入口收敛成一个 /api/feed?tab=，
// 天气部件和主信息流共用同一条链路，天气源需要知道城市/经纬度。
// 空对象 = 用服务端默认城市。
const weatherCtx = { city: "", lat: null, lon: null };

// 当前选中的 tab。v2.4 起，「筛选维度」由 tab 承担，不再有 chips 多选那套逻辑 ——
// tab 本身就声明了用哪些源，多选组合会让「tab→源」的映射在前端失真。
let activeTab = "";
// 允许 ?tab=xxx 直达（分享链接、SEO 落地页）。未匹配则回落到第一个 tab。
function resolveTabFromUrl() {
  let want = "";
  try { want = new URL(location.href).searchParams.get("tab") || ""; } catch { want = ""; }
  return HOST.tabs.find((t) => t.id === want) || HOST.tabs[0];
}
function activeTabDef() {
  return HOST.tabs.find((t) => t.id === activeTab) || HOST.tabs[0];
}

// ---------- 工具 ----------
function escapeHtml(s) {
  return (s || "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}
// 相对时间。ts=0（上游没给时间）返回空串 —— 绝不能显示 "1970"，那会让卡片
// 看起来像数据坏了。meta 有值时优先用 meta（境内源给的「🔥 542万」比时间有用）。
const AGO_STEPS = [
  { sec: 60, div: 1, zh: "秒", en: "s" },
  { sec: 3600, div: 60, zh: "分钟", en: "m" },
  { sec: 86400, div: 3600, zh: "小时", en: "h" },
  { sec: 2592000, div: 86400, zh: "天", en: "d" },
];
function agoText(ts) {
  if (!ts) return "";
  const cn = currentLang === "zh" || currentLang === "zh-Hant";
  const diff = Math.max(0, (Date.now() - ts) / 1000);
  for (const st of AGO_STEPS) {
    if (diff < st.sec) {
      const v = Math.max(1, Math.floor(diff / st.div));
      // 60秒内不显示「秒」，太跳；直接当成 1 分钟
      return cn ? `${v}${st.zh}前` : `${v}${st.en} ago`;
    }
  }
  return cn ? "1个月前" : "1mo ago";
}
function isLocal() {
  return location.protocol === "file:" || location.hostname === "localhost" || location.hostname === "127.0.0.1";
}
function langCode(c) { const l = LANGS.find((x) => x.code === c); return (l && l.mc) || "en"; }
function srcCode(lang) { return lang === "zh" ? "zh-CN" : "en"; }
// 类目显示名：先查主 I18N 表，查不到再查 UI_I18N（新增类目只补后者），
// 都没有就原样返回服务端给的类目名。
function catName(cat) {
  if (!cat) return "";
  const k = CAT_KEY[cat];
  if (!k) return cat;
  const main = (I18N[currentLang] || I18N.zh)[k];
  if (main) return main;
  return uiText(k);
}

// ---------- Epic 徽章渲染 ----------
// 模板里的 | 是分段符：某段只要有一个占位符是空值，整段丢掉，段间用 " · " 接。
// 这样「原价缺失」「剩余天数为 0」这类情况不会漏出空洞或半句话。
function fillTpl(tpl, vars) {
  return String(tpl).split("|").map((seg) => {
    const hits = seg.match(/\{(\w+)\}/g) || [];
    for (const h of hits) {
      const v = vars[h.slice(1, -1)];
      if (v == null || v === "") return "";
    }
    return seg.replace(/\{(\w+)\}/g, (_, k) => String(vars[k]));
  }).filter(Boolean).join(" · ").replace(/\s{2,}/g, " ").trim();
}

// badge.c（内容类型）-> UI 键。dlcN 带数字，单独走模板。
const GAME_BD_KEY = { allDlc: "bdAllDlc", edition: "bdEdition", deluxe: "bdDeluxe", bundle: "bdBundle" };

// 把服务端给的结构化 badge 拼成当前语言的 meta 行。
// 没有 badge（其他所有源）就返回空串，由 makeCard 回落到服务端拼好的 meta。
function gameBadgeMeta(b) {
  if (!b || typeof b !== "object") return "";
  const tplKey = b.k === "live" ? "gmLive" : b.k === "soon" ? "gmSoon" : b.k === "perma" ? "gmPerma" : "";
  const parts = [];
  if (tplKey) parts.push(fillTpl(uiText(tplKey), { p: b.price || "", d: b.date || "", n: b.left != null ? b.left : "" }));
  for (const c of b.bundle || []) {
    if (!c || !c.c) continue;
    parts.push(c.c === "dlcN" ? fillTpl(uiText("bdDlcN"), { n: c.n }) : uiText(GAME_BD_KEY[c.c] || ""));
  }
  return parts.filter(Boolean).join(" · ");
}

// ---------- 私密接口的密钥 ----------
// /api/discover 与 /api/translate 默认关闭（服务端未配 API_SECRET 时一律 403）。
// 自己用时在地址栏带上 ?key=你的密钥 即可，密钥记在 localStorage，之后免带。
function apiKey() {
  try {
    const u = new URL(location.href);
    const k = u.searchParams.get("key");
    if (k) { localStorage.setItem("infostream_key", k); u.searchParams.delete("key"); history.replaceState(null, "", u.toString()); return k; }
    return localStorage.getItem("infostream_key") || "";
  } catch { return ""; }
}
// 开发者模式：地址栏带 ?key= 才开启。此时才显示「翻译」与「发现接口」两个私有工具入口。
const DEV_MODE = !!apiKey();
if (discoverWrap) discoverWrap.hidden = !DEV_MODE;
function authedFetch(url, opts) {
  const k = apiKey();
  return fetch(url, Object.assign({ cache: "no-store" }, opts || {}, {
    headers: Object.assign({}, (opts && opts.headers) || {}, k ? { "x-api-secret": k } : {}),
  }));
}

// 演示模式横幅：用 kind 记住类型，切换语言时按新语言重刷文案，
// 否则会出现「界面已切繁体、横幅还写简体」的割裂感。
let bannerKind = "";
function showBanner(kind) {
  bannerKind = kind === true ? "demo" : (kind || "");
  const b = document.getElementById("banner");
  if (!bannerKind) { if (b) b.remove(); return; }
  let el = b;
  if (!el) { el = document.createElement("div"); el.id = "banner"; el.className = "banner"; document.body.prepend(el); }
  // stale 是「实时源挂了、这是旧快照」，语义和 demo（根本没连）不同，配色也得分开，
  // 否则用户会以为「原来我一直在看演示数据」。
  el.className = "banner" + (bannerKind === "stale" ? " warn" : "");
  el.textContent = (I18N[currentLang] || I18N.zh)[bannerKind] || "";
}
function translateOn() { return currentLang !== "zh" && currentLang !== "zh-Hant" && translateEnabled && DEV_MODE; }

// 翻译（带缓存、并发限制与批量；失败/离线返回原文）
//
// 为什么改成批量（2026-10-22，实测 59 个请求）：
//   原来是一条文本一个 /api/translate 请求。一屏 24 张卡片 + 三个固定部件，
//   一次页面会话实测打出 59 个；而 /api/translate 是私密端点，
//   RATE_LIMIT 默认 10 次/分 —— 第 11 个开始就 429，翻译对所有人等于不存在。
//
//   这里的做法是「接口不变、底下攒批」：调用方还是拿 Promise<string>，
//   改动对 renderWidget / makeCard 这些渲染点完全透明。
//   攒批靠一个 40ms 的微延时：同步渲染里连续调几十次 translateText，
//   40ms 足够把它们全收齐，又短到用户察觉不到。
//
//   保留的旧机制：
//   transCache —— 键含 from|to|text，切语言来回横跳（en→ar→en）不会重复翻；
//   并发上限 —— MyMemory 是公共免费服务，一口气打几十条会被它限。
const transCache = new Map();
let transInflight = 0; const TRANS_MAX = 4; const transQueue = [];
function nextTrans() { if (transQueue.length && transInflight < TRANS_MAX) transQueue.shift()(); }

// 攒批状态
let transBatch = [];
let transTimer = null;
const TRANS_BATCH_MAX = 10;
const TRANS_FLUSH_MS = 40;

function translateText(text, from, to) {
  if (!text || from === to) return Promise.resolve(text);
  // 本地没有 Functions，翻译接口不可用：直接回原文，不去刷控制台
  if (isLocal()) return Promise.resolve(text);
  const key = from + "|" + to + "|" + text;
  if (transCache.has(key)) return Promise.resolve(transCache.get(key));
  return new Promise((resolve) => {
    transBatch.push({ key, text, from, to, resolve });
    // 攒满了立刻发，不必再等那 40ms
    if (transBatch.length >= TRANS_BATCH_MAX) flushTrans();
    else if (!transTimer) transTimer = setTimeout(flushTrans, TRANS_FLUSH_MS);
  });
}

function flushTrans() {
  if (transTimer) { clearTimeout(transTimer); transTimer = null; }
  const batch = transBatch;
  if (!batch.length) return;
  transBatch = [];

  const run = async () => {
    transInflight++;
    try {
      const r = await authedFetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: batch.map((b) => ({ text: b.text, from: b.from, to: b.to })),
        }),
      });
      const d = await r.json();
      const results = (d && d.results) || [];
      batch.forEach((b, i) => {
        const t = results[i] || b.text;
        transCache.set(b.key, t);
        b.resolve(t);
      });
    } catch (e) {
      // 整批失败：逐条回落原文并写进缓存，避免每张卡片都重试一次
      batch.forEach((b) => { transCache.set(b.key, b.text); b.resolve(b.text); });
    } finally { transInflight--; nextTrans(); }
  };
  transQueue.push(run); nextTrans();
}

// ---------- 应用语言 ----------
// code 兜底而不是信任调用方：applyLang 是所有语言切换的唯一入口，
// 一旦传进来 LANGS 里没有的码，下面 LANGS.find 会返回 undefined，
// 紧接着 .dir 访问直接抛 TypeError，整页白屏。
function applyLang(code) {
  if (!LANGS.some((l) => l.code === code)) code = HOST.defaultLang;
  currentLang = code;
  const lang = LANGS.find((x) => x.code === code) || LANGS[0];
  document.documentElement.lang = code;
  document.documentElement.dir = lang.dir || "ltr";
  const dict = I18N[code] || I18N.zh;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const k = el.getAttribute("data-i18n");
    if (dict[k]) el.textContent = dict[k];
  });
  document.querySelectorAll("[data-i18n-ph]").forEach((el) => {
    const k = el.getAttribute("data-i18n-ph");
    if (dict[k]) el.placeholder = dict[k];
  });
  // 品牌名 + 页面标题（跟随语言切换）
  const bn = brandName(code);
  const bMain = document.querySelector('[data-brand="main"]');
  const bSub = document.querySelector('[data-brand="sub"]');
  // 主站显示品牌名；子站显示站点名（AI 情报站 / 国际新闻站）。
  // 这两者不能混：子站叫「信息河」会让用户以为走错了域名。
  if (IS_MAIN) {
    if (bMain) bMain.textContent = bn.main;
    if (bSub) bSub.textContent = bn.sub;
    document.title = `${bn.main} · ${bn.sub}`;
  } else {
    const siteName = code === "en" ? (HOST.titleEn || HOST.title) : HOST.title;
    if (bMain) bMain.textContent = siteName;
    if (bSub) bSub.textContent = bn.main;
    document.title = `${siteName} · InfoStream`;
  }
  // tagline 跟站点走：主站讲「聚合」，子站讲「专注」。
  // 主站直接用 I18N 的 tagline（19 种语言都有，繁简各自到位）；
  // 子站只有中英两句，非中英界面回落到英文 —— 硬把主站那句塞到日文站上只会更糟。
  // 必须摘掉 data-i18n="tagline"，否则上面那段 data-i18n 循环会先写主站文案，
  // 这里再覆盖，用户会看到一闪而过的错句。
  const tagEl = document.querySelector(".tagline");
  if (tagEl) {
    if (IS_MAIN) {
      tagEl.textContent = dict.tagline || "";
    } else {
      tagEl.removeAttribute("data-i18n");
      const cn = code === "zh" || code === "zh-Hant";
      tagEl.textContent = (cn ? HOST.tagline : HOST.taglineEn) || dict.tagline || "";
    }
  }
  // 翻译按钮：仅开发者模式 + 非中文界面才出现（简繁中文都需要翻译，跳过）
  const isCN = code === "zh" || code === "zh-Hant";
  if (translateBtn) translateBtn.style.display = (!DEV_MODE || isCN) ? "none" : "";
  // 横幅（若正在显示）按新语言重刷
  if (bannerKind) showBanner(bannerKind);
  buildTabs();
  renderEntries();
  reloadWidgets();
  resetFeed();
}

// ---------- 语言选择 ----------
// 只列该站真能渲染的语种（renderable()，见下方注释）：news 站不需要 sw/ca/eo，
// 给用户列一个点了没反应的语言，等于制造「坏了」体验。
function buildLangSelect() {
  if (!langSel) return;
  langSel.innerHTML = "";
  const ok = renderable();
  const codes = ok.length ? ok : LANGS.map((l) => l.code);
  for (const code of codes) {
    const l = LANGS.find((x) => x.code === code);
    if (!l) continue;
    const o = document.createElement("option");
    o.value = l.code;
    o.textContent = l.label;
    langSel.appendChild(o);
  }
  langSel.value = currentLang;
  langSel.addEventListener("change", () => applyLang(langSel.value));
}

// ---------- 顶部 Tab（三个站统一形态） ----------
// 旧的 chips 是「类目多选」，v2.4 换成「tab 单选」：tab 与源组合由服务端声明，
// 前端只负责显示和切换。多选语义在这个架构下是错的 —— 比如 ai 站选「芯片」再叠加
// 「论文」，前端无法表达「这两个 tab 的源要并发拉再合并去重」，只能各拉一次再拼。
function buildTabs() {
  tabsEl.innerHTML = "";
  for (const t of HOST.tabs) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "tab" + (t.id === activeTab ? " active" : "");
    el.textContent = uiText(t.i18n);
    el.dataset.tab = t.id;
    tabsEl.appendChild(el);
  }
  tabsEl.hidden = HOST.tabs.length < 2;
  tabsEl.onclick = (ev) => {
    const btn = ev.target.closest(".tab");
    if (!btn || btn.dataset.tab === activeTab) return;
    activeTab = btn.dataset.tab;
    // 用 replaceState 而不是 pushState：切 tab 不该在浏览器历史里堆条目，
    // 否则用户点两次返回就被卡在 tab 切换的循环里。
    try {
      const u = new URL(location.href);
      u.searchParams.set("tab", activeTab);
      history.replaceState(null, "", u.toString());
    } catch { /* file:// 下没有 history，忽略 */ }
    buildTabs();
    resetFeed();
  };
}

// ---------- 主站入口卡片（portal 模式独有） ----------
// 子站不渲染：入口卡片是「从主站跳去子站」的导航，子站自己不需要。
function renderEntries() {
  const box = document.getElementById("entries");
  if (!box) return;
  const list = HOST.entries || [];
  box.hidden = !IS_MAIN || list.length === 0;
  if (box.hidden) { box.innerHTML = ""; return; }
  const en = currentLang === "en";
  box.innerHTML =
    `<h2 class="section-title">${uiText("hubTitle")}</h2>` +
    `<div class="entry-grid">` +
    list.map((e) => {
      const name = (en && e.fallbackEn) || e.fallback || uiText(e.i18n);
      const desc = uiText((e.i18n || "") + "Desc");
      return `<a class="entry-card" href="https://${escapeHtml(e.host)}/">
        <span class="entry-name">${escapeHtml(name)}</span>
        <span class="entry-desc">${escapeHtml(desc)}</span>
        <span class="entry-go">${uiText("entryGo")} →</span>
      </a>`;
    }).join("") +
    `</div>`;
}

// ---------- 卡片 ----------
function makeCard(it) {
  const el = document.createElement("article");
  el.className = "card";
  el.style.setProperty("--accent", CAT_COLOR[it.category] || "#e8743b");
  const thumb = it.img ? `<div class="thumb" style="background-image:url('${escapeHtml(it.img)}')"></div>` : "";
  const desc = it.desc ? `<p class="desc">${escapeHtml(it.desc)}</p>` : "";
  // badge 有值就按当前语言重排（Epic），没有才用服务端拼好的 meta 兜底。
  // meta 里带的价格/截止日也是服务端那一版中文，两者都缺时才退到相对时间。
  // 徽章在 .meta 里被 -webkit-line-clamp 截到 2 行，所以下面渲染时同时挂 title，
  // 被截掉的部分还能靠悬停读全——否则「最多两行」这条 CSS 就等于静默丢信息。
  const metaText = gameBadgeMeta(it.badge) || it.meta || agoText(it.ts);
  el.innerHTML = `
    ${thumb}
    <div class="bar"></div>
    <div class="body">
      <span class="tag">${escapeHtml(catName(it.category))}</span>
      <a class="title" href="${escapeHtml(it.url || "#")}" target="_blank" rel="noopener">${escapeHtml(it.title || "")}</a>
      ${desc}
      <div class="meta"><span>${escapeHtml(it.source || "")}</span><span title="${escapeHtml(metaText)}">${escapeHtml(metaText)}</span></div>
    </div>`;
  // 按用户语言翻译标题
  const titleEl = el.querySelector(".title");
  if (translateOn() && it.lang && it.lang !== currentLang) {
    const from = srcCode(it.lang); const to = langCode(currentLang);
    translateText(it.title, from, to).then((t) => { if (t && t !== it.title) titleEl.textContent = t; });
  }
  return el;
}

function widgetItem(it, withLink) {
  const a = it.url && it.url !== "#"
    ? `<a href="${escapeHtml(it.url)}" target="_blank" rel="noopener">${escapeHtml(it.title)}</a>`
    : `<span>${escapeHtml(it.title)}</span>`;
  let extra = "";
  if (it.desc) extra += `<div class="w-desc">${escapeHtml(it.desc)}</div>`;
  const wMeta = gameBadgeMeta(it.badge) || it.meta;
  if (wMeta) extra += `<span class="w-meta">${escapeHtml(wMeta)}</span>`;
  // 翻译回填由 renderWidget 统一异步处理，避免在 widgetItem 内重复请求
  return `<div class="w-item">${a}${extra}</div>`;
}

// ---------- 状态指示 ----------
function setStatus(kind) {
  const dict = I18N[currentLang] || I18N.zh;
  const loader = document.querySelector("#sentinel .loader");
  if (kind === "loading") {
    if (loader) loader.classList.add("is-on");
    statusEl.textContent = dict.loading;
  } else if (kind === "more") {
    if (loader) loader.classList.remove("is-on");
    statusEl.textContent = dict.more || "↓ 向下滚动 · 信息川流不息";
  } else {
    if (loader) loader.classList.remove("is-on");
    statusEl.textContent = dict.end || "✓ 暂时到底 · 试试点 ⟳ 刷新";
  }
}

// ---------- 演示池：环形游标，永不断流 ----------
// v2.4：不再按类目过滤。演示数据的类目体系（热搜/娱乐/市场/足球）是旧架构的，
// 与现在的 tab→源组合对不上，硬过滤会让某些 tab 拿到空池子。
function loadDemoBatch(n) {
  const pool = DEMO_ALL;
  if (!pool.length) return;
  const batch = [];
  for (let i = 0; i < n; i++) batch.push(pool[(feedCursor + i) % pool.length]);
  feedCursor = (feedCursor + n) % pool.length;
  buffer = buffer.concat(batch);
}

// ---------- 启动：立即打底一屏 ----------
function bootstrapFeed(force) {
  if (isLocal()) {
    if (!useDemo) { useDemo = true; showBanner("demo"); }
    loadDemoBatch(24);              // 一次性打底 24 张，首屏立刻满满
    renderMore(24);                 // 立即画 24 张
    return;
  }
  loadFeed(force);
}

// ---------- 远端拉取（部署后） ----------
// game 站的三个 tab（本周/即将/长期）对应服务端同一个 games 源 ——
// hosts.js 里它们各自 sources:["games"]，是有意为之：Epic 的
// freeGamesPromotions 一次返回全部三态，按状态切分成三个源只会让
// fetchBySources 把同一个上游并发打三遍（sources.js 顶部记着 news 站
// 就是这么把自己打到限流的）。所以这里在客户端按 badge.k 收窄。
//
// 为什么只在 game 站生效：live/soon/perma 三个 id 与 Epic 的 badge.k
// 恰好同名，其他站的 tab id（all/models/chips…）不会命中这三个值，
// filterByTabState 直接原样返回 —— 不需要额外判断站点。
function filterByTabState(items, tabId) {
  if (tabId !== "live" && tabId !== "soon" && tabId !== "perma") return items;
  return items.filter((it) => it && it.badge && it.badge.k === tabId);
}
// ---------- feed 取数：相同参数的请求在短时间内共享同一次网络往返 ----------
//
// 为什么需要这一层：
//   主信息流和三个固定部件请求的是**同一个 tab**（主站上主信息流、天气部件、
//   游戏部件都是 tab=brief），于是「打开一次页面」= 4 个 feed 请求，
//   「切一次界面语言」再来 4 个。用户翻 8 种语言 = 36 个 —— 撞上服务端
//   30 次/分的限流，页面自己把自己 429 掉了。
//
//   这里只合并**参数完全相同**的请求（tab / lang / 城市坐标全一致），不改变任何
//   取数语义：响应对象是只读的，loadFeed 和 loadWidget 拿到后各自 filter，
//   没有任何一处会去改 data.items。
//
//   存 Promise 而不是只存结果：首屏那几个请求几乎是同时发出的，只存结果的话
//   它们仍会各发一次；存 Promise 才能真正并成一次网络往返。
//   TTL 15 秒 —— 与服务端 L1 缓存 TTL 对齐，不会拿到比服务端更旧的响应。
const feedMemo = new Map();
const FEED_MEMO_TTL = 15000;
const CLIENT_CACHE_TTL = 3600000; // 1 小时客户端本地缓存

function getClientFeed(key) {
  try {
    const raw = localStorage.getItem("infostream_feed_" + key);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (obj && obj.t && (Date.now() - obj.t < CLIENT_CACHE_TTL) && obj.data) {
      return obj.data;
    }
  } catch {}
  return null;
}

function setClientFeed(key, data) {
  try {
    if (data && Array.isArray(data.items) && data.items.length) {
      localStorage.setItem("infostream_feed_" + key, JSON.stringify({ t: Date.now(), data }));
    }
  } catch {}
}

/**
 * 取一份 feed。
 * @param {URLSearchParams} q   查询参数
 * @param {boolean} force       true=跳过复用，强制发一次新的（用户点了刷新）
 */
function fetchFeed(q, force) {
  const key = q.toString();
  const m = feedMemo.get(key);
  if (!force && m && Date.now() - m.t < FEED_MEMO_TTL) return m.promise;

  // 1. 尝试读客户端本地 1 小时缓存（秒开，无网络往返）
  if (!force) {
    const cached = getClientFeed(key);
    if (cached) return Promise.resolve(cached);
  }

  // 2. 发起请求：force 时带 force=1 与 no-store，平时走 Cloudflare 边缘长缓存
  const query = new URLSearchParams(q);
  if (force) query.set("force", "1");
  const fetchOpts = force ? { cache: "no-store" } : {};

  const promise = fetch(`/api/feed?${query.toString()}`, fetchOpts)
    .then((res) => {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    })
    .then((data) => {
      setClientFeed(key, data);
      return data;
    })
    .catch(async (err) => {
      // 3. 静态快照兜底（方案2）：若 API 暂时不可用，尝试读取构建时生成的静态快照 /data/feed-${tab}.json
      const tabId = q.get("tab") || "brief";
      try {
        const staticRes = await fetch(`/data/feed-${tabId}.json`);
        if (staticRes.ok) {
          const staticData = await staticRes.json();
          if (staticData && staticData.items && staticData.items.length) {
            setClientFeed(key, staticData);
            return staticData;
          }
        }
      } catch {}
      throw err;
    });

  feedMemo.set(key, { t: Date.now(), promise });
  // 失败不留在 memo 里：上游偶发失败时服务端本来就不缓存空结果，
  // 下一次重试就能拿到数据 —— 不能让一次抖动被钉死 15 秒。
  promise.catch(() => {
    const cur = feedMemo.get(key);
    if (cur && cur.promise === promise) feedMemo.delete(key);
  });
  return promise;
}

// v2.4：请求从 ?cat=热搜,娱乐 换成 ?tab=brief。tab 的源组合由服务端 hosts.js 决定，
// 前端只报 tab id。这样加一个 tab 不用碰前端，加一个源不用碰前端。
async function loadFeed(force) {
  if (loading) return;
  if (!force && buffer.length >= 24) { setStatus("more"); return; }
  loading = true;
  setStatus("loading");
  try {
    const tab = activeTabDef();
    const q = new URLSearchParams();
    q.set("tab", tab.id);
    // lang 是界面语言，news 站用它决定拉哪个语种的源；srcLang 不传 = 全语种
    q.set("lang", currentLang);
    if (weatherCtx.city) q.set("city", weatherCtx.city);
    if (weatherCtx.lat != null) q.set("lat", String(weatherCtx.lat));
    if (weatherCtx.lon != null) q.set("lon", String(weatherCtx.lon));
    const data = await fetchFeed(q, force);
    // 后端实时源全部超时时，会回退到 24h 内的旧快照并标 stale=true。
    // 「有内容但不是最新的」必须说清楚 —— 不提示的话用户会把旧快照当成实时流，
    // 这比白屏更糟：白屏用户会去刷新，旧快照看起来一切正常。
    if (data.stale) showBanner("stale");
    else if (bannerKind === "stale") showBanner("");   // 已恢复正常，清掉兜底提示
    // 拿到整批后先按当前 tab 的口径收窄，再交给去重。顺序不能反 ——
    // 「本周免费」tab 若先把即将/长期也写进 feedSeen，切到「即将开放」时
    // 它们会被当成「已经见过了」而被丢掉，两个 tab 互相把对方的数据吃掉。
    const items = Array.isArray(data.items) ? data.items : [];
    const scoped = filterByTabState(items, activeTabDef().id);
    if (scoped.length) {
      // 丢掉已经画过的条目（见 feedSeen 注释）。
      const fresh = scoped.filter((it) => {
        const k = feedKey(it);
        if (feedSeen.has(k)) return false;
        feedSeen.add(k);
        return true;
      });
      // 按时间倒序：新→旧。服务端已经按源分组返回了，直接全局排序会让
      // 「国际要闻」和「AI 快讯」的时间线交错 —— 这正是简报想要的效果。
      // ts=0 的排最后，不能当成 1970 年。
      buffer = buffer.concat(
        fresh.slice().sort((a, b) => (b.ts || 0) - (a.ts || 0)),
      );
      // 整个 tab 都已经见过了 → 这个 tab 暂时没新东西。标记到底，别再空转请求。
      // 不这么做的话：renderMore 见 buffer<8 就再拉一次，拉回来的全是重复项，
      // 去重后为空 → 又触发下一轮，形成永不停止的刷新循环。
      if (!fresh.length) feedExhausted = true;
    } else {
      feedExhausted = true;
    }
  } catch (e) {
    if (isLocal() && !useDemo) {
      useDemo = true; showBanner("demo");
      loadDemoBatch(24);
    } else if (!isLocal()) {
      feedExhausted = true;
    }
  } finally {
    loading = false;
    // 数据到货但页面还是空的 → 主动画出来。
    // 踩坑记录（2026-10-22）：v2.4 重构时这里只剩 setStatus，把原来的绘制调用丢了。
    // 后果是「后端返回 19 条、buffer 有数据、但 #feed 零张卡片」——死锁：
    // 启动时 IO 触发 pump → renderMore 发现 buffer 空 → 异步 loadFeed 起飞 →
    // renderMore 循环什么都没画就返回 → loadFeed 回来只塞 buffer 不画 →
    // sentinel 相交状态没变，IO 不再触发，用户不滚动，scroll 兜底也不跑。
    // 表面症状是「接口 200 有数据，页面全白」，curl 和接口测试全都测不出来。
    // 只有渲染路径能画，用 feed.childElementCount===0 精确判断「用户还没看到东西」。
    //
    // 第二条（2026-10-22 又踩一次）：不能只看「页面是不是空的」。补货回来后
    // buffer 里往往还剩几条没画，而把它们逼出来的只有 IO 与 scroll 两个**边沿**触发：
    //   · IO 只在 sentinel 相交状态「变化」时回调，内容变高但 sentinel 仍在视口内 → 不再触发
    //   · scroll 兜底有 220ms 节流，用户恰好在节流窗口里停下滚动 → 那一次 pump 被丢掉
    // 实测：首屏 24 张 → 滚一下变 36 张，buffer 里还剩 3 张，
    // 之后无论怎么滚都停在 36，底部却写着「✓ 暂时到底」——货在 buffer 里画不出来。
    // 所以判断标准补一条：底部还露着（nearBottom）就继续画，与 feedExhausted 无关。
    if (buffer.length && (feed.childElementCount === 0 || nearBottom())) {
      renderMore(pumpNeed());
      return;                       // renderMore 内部会 setStatus
    }
    setStatus(loading ? "loading" : buffer.length > 0 ? "more" : "end");
  }
}

// ---------- 渲染更多 + 节流 + 演示池自补 ----------
function renderMore(n) {
  // buffer 空了就补
  if (buffer.length === 0) {
    if (useDemo) loadDemoBatch(20);                              // 演示永远有
    else if (!feedExhausted) loadFeed();                          // 真实模式按需 fetch
    else { setStatus("end"); return; }
  }
  const frag = document.createDocumentFragment();
  // n<=0 表示"一次画完整个 buffer"
  const want = n > 0 ? n : Infinity;
  let drew = 0;
  for (let i = 0; i < want && buffer.length > 0; i++) {
    frag.appendChild(makeCard(buffer.shift()));
    drew++;
  }
  if (frag.childNodes.length) feed.appendChild(frag);

  // 演示模式：永远别让 buffer 见底
  if (useDemo && buffer.length < 12) loadDemoBatch(20);
  // 真实模式：buffer 少了就再 fetch
  if (!useDemo && buffer.length < 8 && !feedExhausted && !loading) loadFeed();

  setStatus(loading ? "loading" : buffer.length > 0 ? "more" : "end");
}

function resetFeed(force) {
  buffer = [];
  feedCursor = 0;
  feedExhausted = false;
  // 去重表必须跟着一起清：换 tab 后同名同时间的条目要能重新出现，
  // 否则新 tab 的首屏会被上一站的 key 误判成「见过」而整批丢掉。
  feedSeen.clear();
  feed.innerHTML = "";
  bootstrapFeed(force);
}

// ---------- 固定部件 ----------
// v2.4：旧的 ?cat=天气 端点没有了，部件改为「拉当前 tab 的数据，再按 category 挑」。
// 这样部件和主信息流共用同一条链路，也就不会出现部件还停留在旧类目体系的问题。
const WIDGET_SRC_TAB = { 天气: "brief", 游戏: "brief", AI: "ai" };
const WIDGET_CATS = { 天气: ["天气"], 游戏: ["游戏"], AI: ["AI", "AI 快讯", "AI 产品", "AI 商业", "大模型", "AI 论文"] };

async function loadWidget(cat, opts, force) {
  const body = cat === "天气" ? weatherBody : cat === "游戏" ? gamesBody : aiBody;
  if (!body) return;
  body.innerHTML = `<div class="w-loading">…</div>`;
  if (opts && opts.city !== undefined) setWeatherCtx(opts);
  const want = WIDGET_CATS[cat] || [];
  if (isLocal()) {
    renderWidget(body, DEMO_ALL.filter((it) => want.includes(it.category)).slice(0, 6));
    return;
  }
  try {
    const q = new URLSearchParams();
    q.set("tab", WIDGET_SRC_TAB[cat] || activeTab);
    q.set("lang", currentLang);
    if (weatherCtx.city) q.set("city", weatherCtx.city);
    if (weatherCtx.lat != null) q.set("lat", String(weatherCtx.lat));
    if (weatherCtx.lon != null) q.set("lon", String(weatherCtx.lon));
    const data = await fetchFeed(q, force);
    const items = (data.items || []).filter((x) => want.includes(x.category));
    // tab 里没有这个类目（比如 brief tab 恰好没拉到天气）时退回 tab 全量，
    // 宁可显示别的内容，也不要给用户一个永远转圈的框。
    renderWidget(body, items.length ? items : (data.items || []).slice(0, 6));
  } catch (e) {
    if (isLocal()) renderWidget(body, DEMO_ALL.filter((it) => want.includes(it.category)).slice(0, 6));
    else body.innerHTML = `<div class="w-loading">⚠️</div>`;
  }
}
function setWeatherCtx(opts) {
  if (!opts) return;
  if (opts.city !== undefined) weatherCtx.city = opts.city || "";
  if (opts.lat != null) weatherCtx.lat = opts.lat;
  if (opts.lon != null) weatherCtx.lon = opts.lon;
}
function renderWidget(body, items) {
  if (!items || !items.length) { body.innerHTML = `<div class="w-loading">-</div>`; return; }
  const rows = items.slice(0, 6);
  body.innerHTML = rows.map((it) => widgetItem(it, true)).join("");
  // 部件内标题翻译（异步回填）
  if (translateOn()) {
    const nodes = body.querySelectorAll(".w-item a, .w-item span");
    rows.forEach((it, i) => {
      if (it.lang && it.lang !== currentLang) {
        translateText(it.title, srcCode(it.lang), langCode(currentLang)).then((t) => {
          const node = nodes[i]; if (node && t && t !== it.title) node.textContent = t;
        });
      }
    });
  }
}
// 只有主站有常驻看板：ai / news 站的内容本身就是这些主题，
// 再挂一块「游戏」看板只会稀释站点定位。
// 不只是不发请求 —— 整段（含标题）必须 hidden，否则子站页面上会留一个
// 空标题和三个空框，比不显示更像出故障。
function reloadWidgets(force) {
  const wrap = document.getElementById("widgetsWrap");
  if (wrap) wrap.hidden = !IS_MAIN;
  if (!IS_MAIN) return;
  loadWidget("天气", undefined, force);
  loadWidget("游戏", undefined, force);
  loadWidget("AI", undefined, force);
}

// 天气：城市搜索（浏览器直连 Open-Meteo 地理编码，已开启 CORS）
// 定位结果写进 weatherCtx 而不是只传给一次请求 —— v2.4 的取数入口是 /api/feed?tab=，
// 主信息流和天气部件共用这条链路，两边都要拿到城市。
async function weatherByCity(name) {
  if (!name) return;
  try {
    const g = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1`, { cache: "no-store" });
    const d = await g.json();
    const r = d.results && d.results[0];
    if (r) loadWidget("天气", { city: r.name, lat: r.latitude, lon: r.longitude });
    else loadWidget("天气", { city: name });
  } catch (e) { loadWidget("天气", { city: name }); }
}
function weatherByGeo() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    (pos) => loadWidget("天气", { city: "本地", lat: pos.coords.latitude, lon: pos.coords.longitude }),
    () => loadWidget("天气")
  );
}

// ---------- 接口发现（仅开发者模式） ----------
async function loadDiscover(q) {
  // 没有密钥 = 你只是访客，这块是你的自用工具，界面不展示、也不请求
  if (!DEV_MODE) { renderDiscover([]); return; }
  if (isLocal()) { renderDiscover(filterDemo(q)); return; }
  try {
    const res = await authedFetch(`/api/discover?q=${encodeURIComponent(q || "")}`);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    renderDiscover(data.items || []);
  } catch (e) {
    renderDiscover([]);
  }
}
function renderDiscover(items) {
  if (!items.length) { discoverResults.innerHTML = `<div class="w-loading">${(I18N[currentLang] || I18N.zh).noResult}</div>`; return; }
  discoverResults.innerHTML = items.map((a) => `
    <div class="api-card">
      <div><span class="api-name">${escapeHtml(a.name)}</span><span class="api-cat">${escapeHtml(a.category || "")}</span></div>
      <div class="api-desc">${escapeHtml(a.desc || "")}</div>
      <div class="api-tags"><span>${escapeHtml(a.auth || "")}</span><span>${escapeHtml(a.cors || "")}</span></div>
      <a class="api-link" href="${escapeHtml(a.link || "#")}" target="_blank" rel="noopener">${escapeHtml(a.link || "#")}</a>
    </div>`).join("");
}

// ---------- 无限滚动 ----------
// IO 只在"相交状态变化"时回调：sentinel 加载后若一直停在视口内就不会再触发，
// 所以额外挂一层 scroll 兜底 —— 只要底部还露着就继续补，直到填满或触底。
function nearBottom() {
  if (!sentinel) return false;
  // 没得可画了（演示模式无限，真实模式取完）就别再空转
  if (!useDemo && feedExhausted && buffer.length === 0) return false;
  const r = sentinel.getBoundingClientRect();
  return r.top < window.innerHeight + 400;
}
// 一次铺多少张：一屏约 90px 一张，最少 12 张。
// 抽成函数是因为 loadFeed 补完货也要用它，两处口径必须一致 ——
// 一处按 24 一处按 need 会画出不均匀的密度。
const pumpNeed = () => Math.max(12, Math.ceil(window.innerHeight / 90));

// 节流窗口内已有一次 pump 排着队了（带它要画的张数）
let pumpPending = 0;
let pumpTimer = null;

// 踩坑记录（2026-10-22，第三次踩同一个坑）：
// 这里的节流原来是「丢弃式」的 —— `if (now - ioThrottle < 220) return;`。
// 丢弃在**有后续事件**的场合是安全的（IO 会再触发、用户会再滚），
// 但这个场景里两个触发源都会同时断掉，是真正的死锁：
//   · IO 是**边沿**触发：sentinel 从不相交→相交画了 24 张后，滚到页底
//     sentinel 仍留在相交区，相交状态没再变化 → 不再回调
//   · scroll 兜底同样进不来：scrollY 已到文档最大高度，再滚也不动，
//     不再产生 scroll 事件
// 实测（冷启动、每滚 4000px 等 120ms）：滚 1 画到 24 张，滚 2 起再无增长，
// buffer 剩 15 张永久画不出来，底部还写着「✓ 暂时到底」。
// 滚 2 那次 IO 明明触发了，只是距上一次 pump 只隔 120ms < 220ms 被丢掉。
//
// 修法：节流语义从「丢弃」改成「延后补跑」（尾沿）——窗口内的调用记下要画的
// 张数，窗口结束后一定再执行一次。节流本来是为了防止一次滚动里铺出几百张卡，
// 补跑一次不影响这个目的，但让「唯一的机会」不再丢失。
// 中止条件必须带上 buffer.length，否则 buffer 见底时 nearBottom 恒真
// （就等着补货），会退化成 220ms 一轮的轮询空转。
function pump(n) {
  const now = Date.now();
  if (now - ioThrottle < 220) {
    pumpPending = Math.max(pumpPending, n);   // 攒着要画的量，取最大值
    if (!pumpTimer) {
      pumpTimer = setTimeout(() => {
        pumpTimer = null;
        const todo = pumpPending;
        pumpPending = 0;
        // 中止条件：buffer 里还有货、且底部仍露着才值得继续画
        if (todo && buffer.length && nearBottom()) pump(todo);
      }, 220 - (now - ioThrottle));
    }
    return;
  }
  ioThrottle = now;
  renderMore(n);
}

const io = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (e.isIntersecting) { pump(12); break; }
  }
}, { rootMargin: "400px 0px" });
io.observe(sentinel);

let scrollQueued = false;
function onScroll() {
  if (scrollQueued) return;
  scrollQueued = true;
  requestAnimationFrame(() => {
    scrollQueued = false;
    // sentinel 仍在可视范围 → 视口没被填满，继续铺
    if (nearBottom()) {
      pump(pumpNeed());
    }
  });
}
window.addEventListener("scroll", onScroll, { passive: true });
window.addEventListener("resize", onScroll, { passive: true });

// ---------- 自动滚动 ----------
function tick() {
  if (autoScroll && !document.hidden && !hovering) window.scrollBy(0, 1.1);
  requestAnimationFrame(tick);
}

// ---------- 事件 ----------
if (autoBtn) autoBtn.addEventListener("click", () => {
  autoScroll = !autoScroll;
  autoBtn.classList.toggle("on", autoScroll);
  autoBtn.textContent = autoScroll ? (I18N[currentLang] || I18N.zh).autoPause : (I18N[currentLang] || I18N.zh).autoStart;
});
if (refreshBtn) refreshBtn.addEventListener("click", () => {
  resetFeed(true); reloadWidgets(true);
  if (DEV_MODE && discoverInput) loadDiscover(discoverInput.value);
});
if (translateBtn) translateBtn.addEventListener("click", () => {
  translateEnabled = !translateEnabled;
  translateBtn.classList.toggle("on", translateEnabled);
  // 重新渲染以应用/取消翻译
  resetFeed(); reloadWidgets();
});
if (cityGo) cityGo.addEventListener("click", () => weatherByCity(cityInput.value.trim()));
if (cityInput) cityInput.addEventListener("keydown", (e) => { if (e.key === "Enter") weatherByCity(cityInput.value.trim()); });
if (geoBtn) geoBtn.addEventListener("click", weatherByGeo);
// force=true 是必须的：用户明确点了刷新，就该真的打一次网络，
// 不能被上面 fetchFeed 的 15 秒复用挡掉，否则按钮看着像坏了。
document.querySelectorAll(".w-refresh").forEach((b) =>
  b.addEventListener("click", () => loadWidget(b.dataset.widget || "AI", undefined, true))
);
if (discoverInput) discoverInput.addEventListener("input", () => { clearTimeout(discoverInput._t); discoverInput._t = setTimeout(() => loadDiscover(discoverInput.value.trim()), 300); });
if (feed) {
  feed.addEventListener("mouseenter", () => (hovering = true));
  feed.addEventListener("mouseleave", () => (hovering = false));
}

// ---------- 启动 ----------
// 首次访问的语言优先级：
//   1. URL 里的 ?lang=（分享链接）
//   2. 该站 defaultLang（news 站默认 en，主站/ai 站默认 zh）
//   3. 浏览器语言，且必须在本站支持列表内
// 站点默认语言排浏览器语言之前是有意的：news 站的默认语种就是英语，
// 一个法语用户落到 news 站，看到英语是合理的；看到中文才是 bug。
//
// 关键：判定基准是 renderable() =「本站声明支持」∩「前端真的会渲染」，
// 而不是只看 HOST.langs。hosts.js 里写了但 I18N 没收录的语言（比如曾经
// 声明过的 ko），一旦命中就会回落 I18N.zh，可 <html lang> 还挂着那个码 ——
// 对屏幕阅读器和 SEO 来说就是「页面语言声明与内容不符」，比直接回落更糟。
function renderable() {
  const set = new Set(HOST.langs);
  return LANGS.filter((l) => set.has(l.code)).map((l) => l.code);
}
function detectLang() {
  const ok = renderable();
  const fallback = ok.includes(HOST.defaultLang) ? HOST.defaultLang : (ok[0] || "zh");
  let want = "";
  try { want = new URL(location.href).searchParams.get("lang") || ""; } catch { want = ""; }
  // zh-Hant 的URL 写法有zh-TW / zh-HK / zh-Hant 三种，统一归一
  if (/^zh-(tw|hk|mo|hant)/i.test(want)) want = "zh-Hant";
  if (ok.includes(want)) return want;
  if (ok.includes(HOST.defaultLang)) return HOST.defaultLang;
  const nav = (navigator.languages && navigator.languages[0]) || navigator.language || "";
  const s = nav.toLowerCase();
  if (/^zh-(tw|hk|mo|hant)/.test(s)) return ok.includes("zh-Hant") ? "zh-Hant" : fallback;
  if (/^zh/.test(s)) return ok.includes("zh") ? "zh" : fallback;
  const base = s.split("-")[0];
  return ok.includes(base) ? base : fallback;
}
activeTab = resolveTabFromUrl().id;
currentLang = detectLang();
buildLangSelect();
// applyLang 末尾已经串好 buildTabs → renderEntries → reloadWidgets → resetFeed，
// 这里不要再来一遍 —— 重复调会让首屏打两次 /api/feed，浪费一次上游抓取。
applyLang(currentLang);
if (DEV_MODE) loadDiscover("");
requestAnimationFrame(tick);
