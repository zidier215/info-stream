// functions/api/discover.js
// 全球免费接口发现：内置一份精选清单（始终可用），并尝试实时合并 publicapis.org 的结果。
// 路由：/api/discover?q=weather  ｜ 需要密钥：x-api-secret 头 或 ?key=
//
// 这块只给自己用：公开给访客没有价值，反而会被拿来刷额度。
// 未配置 API_SECRET 时一律返回 403（默认关闭）。

import { guard } from "./_guard.js";

// 内置精选：覆盖多领域的免费、无需密钥、对前端友好的公共 API
// en = 英文/通用别名。desc 是中文，只按中文匹配的话英文/小语种用户一搜就空。
const CURATED = [
  { name: "Open-Meteo", category: "天气", desc: "全球任意坐标的天气预报，无需密钥、开启 CORS", en: "weather forecast rain temperature meteo climate", link: "https://open-meteo.com/", auth: "None", cors: "Yes" },
  { name: "Hugging Face", category: "AI", desc: "模型、数据集与每日 AI 论文，免费开放接口", en: "ai llm model dataset inference paper gpt machine learning", link: "https://huggingface.co/docs/hub/api", auth: "None", cors: "Yes" },
  { name: "REST Countries", category: "地理", desc: "国家信息：首都、货币、语言、国旗等", en: "country geo capital currency flag language nation", link: "https://restcountries.com/", auth: "None", cors: "Yes" },
  { name: "TheMealDB", category: "美食", desc: "食谱与菜品图片数据库，含按国家筛选", en: "food recipe meal cooking cuisine restaurant dish", link: "https://www.themealdb.com/api.php", auth: "None", cors: "Yes" },
  { name: "Free Dictionary", category: "词典", desc: "英语单词释义与词源", en: "dictionary definition word vocabulary thesaurus translate language", link: "https://dictionaryapi.dev/", auth: "None", cors: "Yes" },
  // 本站的 /api/translate 就是代理它。加进清单有两个好处：
  //   1. 中文搜「翻译」能命中（之前搜 en 里的 translate 也命中不了中文 query）
  //   2. 清单里有的接口就是项目自己在用的，可信度说明得过去
  { name: "MyMemory", category: "翻译", desc: "免费机器翻译接口，支持上百语种，本站翻译功能即代理此源", en: "translate translation language multilingual i18n free", link: "https://mymemory.translated.net/doc/spec.php", auth: "None", cors: "Yes" },
  { name: "Open Library", category: "图书", desc: "图书元数据与封面，开源书目", en: "book library isbn author read literature novel", link: "https://openlibrary.org/developers/api", auth: "None", cors: "Yes" },
  { name: "Wikipedia", category: "知识", desc: "维基百科开放数据（REST 与 Action API）", en: "wiki encyclopedia knowledge article search reference", link: "https://www.mediawiki.org/wiki/API:Main_page", auth: "None", cors: "Yes" },
  { name: "CoinGecko", category: "加密", desc: "加密货币价格与历史，免费档无需密钥", en: "crypto bitcoin ethereum price coin market cap blockchain", link: "https://www.coingecko.com/en/api", auth: "None", cors: "Yes" },
  { name: "ExchangeRate-API", category: "金融", desc: "实时汇率（免费档无需密钥）", en: "currency exchange rate forex money convert finance", link: "https://www.exchangerate-api.com/", auth: "None", cors: "Yes" },
  { name: "Open Notify (ISS)", category: "航天", desc: "国际空间站位置与宇航员人数", en: "space station iss astronaut orbit nasa space", link: "http://open-notify.org/", auth: "None", cors: "No" },
  { name: "TVMaze", category: "影视", desc: "电视剧集信息、档期与搜寻", en: "tv show series movie episode schedule watch stream", link: "https://www.tvmaze.com/api", auth: "None", cors: "Yes" },
  { name: "Studio Ghibli", category: "影视", desc: "吉卜力工作室角色与作品数据", en: "ghibli anime cartoon movie studio", link: "https://ghibliapi.vercel.app/", auth: "None", cors: "Yes" },
  { name: "PokeAPI", category: "游戏", desc: "宝可梦全图鉴数据", en: "pokemon poke game creature monster", link: "https://pokeapi.co/", auth: "None", cors: "Yes" },
  { name: "The Dog API", category: "图片", desc: "随机狗狗图片与品种", en: "dog pet animal image picture photo breed", link: "https://dog.ceo/dog-api/", auth: "None", cors: "Yes" },
  { name: "The Cat API", category: "图片", desc: "猫咪图片与品种（免费档需 key）", en: "cat pet animal image picture photo breed", link: "https://thecatapi.com/", auth: "apiKey", cors: "Yes" },
  { name: "Advice Slip", category: "趣味", desc: "随机建议短句", en: "advice quote random funny motivation tip", link: "https://api.adviceslip.com/", auth: "None", cors: "Yes" },
  { name: "Bored API", category: "活动", desc: "随机活动建议", en: "bored activity idea random fun todo things to do", link: "https://www.boredapi.com/", auth: "None", cors: "Yes" },
  { name: "Nager Date", category: "时间", desc: "各国公共假日", en: "holiday public date calendar weekend country", link: "https://date.nager.at/", auth: "None", cors: "Yes" },
  { name: "Universities API", category: "教育", desc: "全球高校名录", en: "university college school education campus student", link: "https://github.com/hyperiongray/universities-api", auth: "None", cors: "Yes" },
  { name: "JSONPlaceholder", category: "开发", desc: "前端测试用假数据", en: "mock fake json placeholder test dummy data dev", link: "https://jsonplaceholder.typicode.com/", auth: "None", cors: "Yes" },
  { name: "reqres", category: "开发", desc: "REST 联调测试接口", en: "rest api test auth users login mock register", link: "https://reqres.in/", auth: "None", cors: "Yes" },
  { name: "Numbers API", category: "趣味", desc: "数字背后的冷知识", en: "number fact trivia math interesting fun", link: "http://numbersapi.com/", auth: "None", cors: "No" },
  { name: "SpaceX API", category: "航天", desc: "SpaceX 发射与火箭数据", en: "spacex rocket launch falcon starlink space", link: "https://github.com/r-spacex/SpaceX-API", auth: "None", cors: "Yes" },
  { name: "Deck of Cards", category: "游戏", desc: "虚拟扑克牌洗牌发牌", en: "card deck poker shuffle draw game gambling", link: "https://deckofcardsapi.com/", auth: "None", cors: "Yes" },
  { name: "QR Server", category: "工具", desc: "生成与解析二维码", en: "qr code generator reader decode image util tool", link: "https://goqr.me/api/", auth: "None", cors: "Yes" },
];

function blob(a) {
  return `${a.name} ${a.category} ${a.desc} ${a.en || ""}`.toLowerCase();
}
function filterCurated(q) {
  if (!q) return CURATED;
  const s = q.toLowerCase().trim();
  const direct = CURATED.filter((a) => blob(a).includes(s));
  if (direct.length) return direct;
  // 退化：按空格拆词，任一词命中即算（小语种常见「整句搜索」）
  const words = s.split(/\s+/).filter(Boolean);
  if (words.length < 2) return [];
  return CURATED.filter((a) => words.some((w) => blob(a).includes(w)));
}

async function fetchJSON(url) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), 7000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.json();
  } finally { clearTimeout(id); }
}

const HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

export async function onRequest(context) {
  const blocked = guard(context.request, { private: true, label: "discover", env: context.env });
  if (blocked) return blocked;

  const q = new URL(context.request.url).searchParams.get("q") || "";
  let items = filterCurated(q);
  let source = "curated";

  // 尝试实时合并 publicapis.org（不可达时静默忽略，不影响内置清单）
  if (q) {
    try {
      const d = await fetchJSON("https://api.publicapis.org/entries?title=" + encodeURIComponent(q) + "&limit=20");
      const entries = (d && d.entries) || [];
      const mapped = entries.map((e) => ({
        name: e.API || e.Title || "Untitled",
        category: e.Category || "Other",
        desc: e.Description || "",
        link: e.Link || e.Link || "#",
        auth: e.Auth || "Unknown",
        cors: e.Cors || "Unknown",
      }));
      // 去重合并（以 name 为准）
      const seen = new Set(items.map((i) => i.name.toLowerCase()));
      for (const m of mapped) {
        if (!seen.has(m.name.toLowerCase())) { items.push(m); seen.add(m.name.toLowerCase()); }
      }
      source = "curated+live";
    } catch (e) { /* 实时源不可达，使用内置清单 */ }
  }

  return new Response(JSON.stringify({ source, count: items.length, items }), { headers: HEADERS });
}
