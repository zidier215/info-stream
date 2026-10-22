// functions/lib/gnews.js
// ---------------------------------------------------------------------------
// Google News RSS 适配器（无需密钥，全球多语种新闻主力源）
//
// 为什么用它而不是 GDELT：
//   GDELT DOC API 有 5 秒/IP 的严格限流，且 sourcecountry 过滤实测不准
//   （筛 US 会返回台湾媒体），做不了实时聚合。
//   Google News RSS 无需密钥、无限流、支持 source: 与 when: 运算符、按语种分区。
//
// 用法：
//   makeGNews({ lang: "es", sources: ["Reuters","BBC News"], when: "2d", topic: "gnews" })
// ---------------------------------------------------------------------------

import { fetchText, parseRssItems, xmlPick, stripTags, ago, toTs, isJunkTitle, matchSource } from "./util.js";
import { HTTP_TIMEOUT } from "./budget.js";

// 语种 -> Google News 的 hl / gl / ceid 三件套
export const GN_LANG = {
  en: { hl: "en-US", gl: "US", ceid: "US:en" },
  "zh-Hant": { hl: "zh-TW", gl: "TW", ceid: "TW:zh-Hant" },
  zh: { hl: "zh-CN", gl: "CN", ceid: "CN:zh-Hans" },
  es: { hl: "es-419", gl: "US", ceid: "US:es-419" },
  fr: { hl: "fr", gl: "FR", ceid: "FR:fr" },
  ar: { hl: "ar", gl: "EG", ceid: "EG:ar" },
  ru: { hl: "ru", gl: "RU", ceid: "RU:ru" },
  pt: { hl: "pt-BR", gl: "BR", ceid: "BR:pt-419" },
  de: { hl: "de", gl: "DE", ceid: "DE:de" },
  ja: { hl: "ja", gl: "JP", ceid: "JP:ja" },
  ko: { hl: "ko", gl: "KR", ceid: "KR:ko" },
};

// 各语种的「严肃媒体」清单：Google News 的 source: 过滤器按媒体名匹配
export const GN_SOURCES = {
  en: ["Reuters", "BBC News", "The Guardian", "Financial Times", "Associated Press",
    "Bloomberg", "The Economist", "CNN", "NPR", "Al Jazeera English", "NBC News", "Sky News"],
  es: ["El País", "El Mundo", "ABC", "La Vanguardia", "Reuters", "EFE", "Clarín", "Expansión"],
  fr: ["Le Monde", "Le Figaro", "Libération", "Reuters", "France 24", "Le Parisien", "Les Échos"],
  ar: ["Al Jazeera", "Al Arabiya", "Reuters", "BBC Arabic", "Asharq Al-Awsat", "Al-Ahram"],
  ru: ["РИА Новости", "ТАСС", "Интерфакс", "Лента.ру", "РБК", "Коммерсантъ"],
  zh: ["路透社", "纽约时报中文网", "英国广播公司", "法广", "DW中文", "联合早报"],
  "zh-Hant": ["中央社", "聯合報", "自由時報", "經濟日報", "公視新聞"],
  de: ["Spiegel Online", "Zeit Online", "FAZ", "Süddeutsche Zeitung", "Reuters"],
  pt: ["Folha de S.Paulo", "O Globo", "Reuters", "Valor Econômico", "Jornal i"],
  ja: ["NHK", "朝日新聞", "毎日新聞", "読売新聞", "Reuters"],
  ko: ["조선일보", "한국경제", "연합뉴스", "Reuters"],
};

/**
 * 扩展可信媒体名单 —— 只用于「结果排序加权」，不用于硬过滤。
 *
 * 实测（2026-10）：纯关键词搜索会召回大量正规但不在主白名单里的媒体
 * （WSJ / Nikkei / Politico / Le Parisien 等），它们的内容质量没问题，
 * 硬过滤会把好内容误杀。所以策略是：
 *   白名单媒体 → 排前面；不在名单 → 保留但靠后。
 */
export const GN_SOURCES_EXT = {
  en: ["Reuters", "BBC News", "The Guardian", "Financial Times", "Associated Press",
    "Bloomberg", "The Economist", "CNN", "NPR", "Al Jazeera English", "NBC News", "Sky News",
    "The New York Times", "The Washington Post", "Wall Street Journal", "Nikkei Asia",
    "Politico", "The Times", "The Independent", "The Telegraph", "Business Insider",
    "Forbes", "Fortune", "Axios", "Semafor", "The Atlantic", "Newsmax", "Newsweek",
    "USA Today", "NBC", "ABC News", "CBS News", "Fox News", "The Hill", "Politico Europe"],
  es: ["El País", "El Mundo", "ABC", "La Vanguardia", "Reuters", "EFE", "Clarín", "Expansión",
    "El Confidencial", "ElDiario.es", "Business Insider España", "La Razón", "20 Minutos"],
  fr: ["Le Monde", "Le Figaro", "Libération", "Reuters", "France 24", "Le Parisien", "Les Échos",
    "France Info", "L'Humanité", "Le Canard Enchaîné", "Ouest-France", "Sud Ouest", "La Croix"],
  ar: ["Al Jazeera", "Al Arabiya", "Reuters", "BBC Arabic", "Asharq Al-Awsat", "Al-Ahram",
    "Sky News Arabia", "France 24", "The New Arab", "Al-Mayadeen", "RT Arabic", "CNN Arabic"],
  ru: ["РИА Новости", "ТАСС", "Интерфакс", "Лента.ру", "РБК", "Коммерсантъ",
    "Ведомости", "Известия", "Газета.ru", "Naked Science", "Euronews", "Reuters"],
};

// 语种 -> 该语种新闻条目的归一化 lang（用于前端「翻译成我的语言」）
export function gnewsItemLang(code) {
  return code === "zh-Hant" ? "zh-Hant" : code;
}

/**
 * 生成一个 Google News 拉取函数。
 *
 * @param {object} o
 * @param {string} o.lang       语种（见 GN_LANG）
 * @param {string[]} o.sources  媒体名白名单（source:Reuters OR ...）
 * @param {string} o.when       时间窗，如 "1d" / "2d"
 * @param {string} o.extra     附加关键词（可空）
 * @param {string} o.category   归一化后的类目名（前端显示用）
 * @param {string} o.region     地区标签（cn / intl / global / apac）
 * @param {string} o.topic      专题标签（main / ai / news）
 * @param {number} o.limit      取多少条
 * @param {string} o.label      卡片 meta 上的来源描述
 *
 * 两道质量闸门（缺一不可）：
 *   1. 白名单硬校验 —— source: 只是「偏向」不是过滤，返回后按 <source> 实际媒体名比对
 *   2. 垃圾特征闸门 —— 挡掉博彩/引流/零宽字符/数学符号字体标题
 */
export function makeGNews(o) {
  const {
    lang = "en", sources = [], when = "2d", extra = "",
    category = "国际", region = "intl", topic = "main",
    limit = 12, label = "Google News",
    // strictSource: 传了 sources 时是否真的写进查询串。
    // 实测（2026-10）在 fr / ar / ru 分区里 source: 过滤几乎完全失效——
    // 6 家白名单媒体 + 地区关键词返回 0 条，去掉 source: 只留关键词就有 100 条。
    // 原因大概是这些媒体没被索引进对应语种分区。所以小语种必须关掉 source:，
    // 靠纯关键词通道 + 质量闸门拿量，而不是死守白名单把自己饿死。
    strictSource = true,
  } = o;

  const L = GN_LANG[lang] || GN_LANG.en;
  const useSources = sources.length > 0 && strictSource;
  const srcPart = useSources
    ? "(" + sources.map((s) => (s.includes(" ") ? `source:"${s}"` : `source:${s}`)).join(" OR ") + ")"
    : "";
  // 关键词组：调用方传的 extra 可能自带括号（`(Europe OR EU)`），不能再包一层。
  // 实测双层括号 `((Europe OR EU))` 会让 Google News 直接返回 0 条 —— 这是
  // news 站「地区」Tab 全空的真正原因之一，不是限流也不是白名单。
  const kw = extra
    ? (/^\(.*\)$/s.test(extra.trim()) ? extra.trim() : `(${extra})`)
    : "";
  const q = [srcPart, kw, `when:${when}`].filter(Boolean).join(" ");
  const url = "https://news.google.com/rss/search?q=" + encodeURIComponent(q) +
    "&hl=" + encodeURIComponent(L.hl) + "&gl=" + encodeURIComponent(L.gl) +
    "&ceid=" + encodeURIComponent(L.ceid);

  // 只在真正把 source: 写进查询时，才做白名单硬校验。
  // 关掉 source: 的通道（strictSource=false）必须放行所有媒体，
  // 否则会拿着一个根本没参与查询的白名单去过滤结果，一条都不剩。
  const gate = useSources;

  return async function gnews() {
    // 超时取自 budget.js —— 不要在这里写字面量。
    // 2026-10-22 踩坑：这里曾是 8000ms，而外层 SOURCE_DEADLINE 当时只有 6000ms，
    // 内层还没放弃外层就先判空，所有 GN 源静默返回空数组。
    const xml = await fetchText(url, {}, HTTP_TIMEOUT.gnews);
    const blocks = parseRssItems(xml);
    const out = [];
    // 扫描全部条目再截断：过滤会吃掉一部分，不能边过滤边凑数
    for (const b of blocks) {
      if (out.length >= limit) break;
      const rawTitle = xmlPick(b, "title");
      if (!rawTitle) continue;

      const publisher = xmlPick(b, "source") || "";
      if (gate && !matchSource(publisher, sources)) continue;

      // Google News 标题末尾固定带 " - 媒体名"，来源已经在 <source> 里，去掉更干净
      const title = rawTitle.replace(/\s+-\s+[^-]{2,40}$/, "").trim();
      if (isJunkTitle(title)) continue;

      const pub = xmlPick(b, "pubDate");
      out.push({
        category,
        title,
        url: xmlPick(b, "link"),
        desc: stripTags(xmlPick(b, "description"), 180),
        meta: "🌐 " + label + (pub ? " · " + ago(pub, lang) : ""),
        source: publisher || label,
        ts: toTs(pub),
        lang: gnewsItemLang(lang),
        region,
        topic,
        sourceType: "news",
        origin: "gnews",
      });
    }
    return out;
  };
}