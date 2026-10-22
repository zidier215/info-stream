// gameshot.mjs / probe-overflow.mjs 共用的固定夹具。
// 单独抽出来是为了让「出图验证」和「查溢出」跑在同一份数据上——
// 之前两份各写一遍，探针量出来的宽度对不上截图，方向就废了。
export const NOW = Date.now();
export const D = 86400000;
export const mmdd = (ms) => { const d = new Date(ms); return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`; };
export const left = 3;

// 真实 Epic 条目都带 key art，thumb 分支必须走到。
// 用内联 SVG 当图：不走外网，截图可复现，也不会因为 Epic 换 CDN 而裂图。
// 注意必须整段 encodeURIComponent —— thumb 是拼进 CSS url('...') 的，
// 里面出现裸引号会被 escapeHtml 转义掉，图直接裂。
export const thumb = (bg, label) =>
  "data:image/svg+xml;charset=utf-8," + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="120">` +
    `<rect width="320" height="120" fill="${bg}"/>` +
    `<rect x="0" y="96" width="320" height="24" fill="rgba(0,0,0,.25)"/>` +
    `<text x="160" y="70" font-family="sans-serif" font-size="34" font-weight="700" ` +
    `fill="#ffffff" text-anchor="middle">${label}</text></svg>`,
  );

// 三态各两款，其中一款带 bundle 信息，一款不带
export const ITEMS = [
  {
    category: "游戏·本周", title: "Stray",
    url: "https://store.epicgames.com/p/stray", source: "Epic", lang: "en", ts: NOW - 2 * D,
    img: thumb("#c0659a", "Stray"),
    desc: "一只猫在赛博朋克都市里穿行 · Annapurna Interactive · 原版已加入长期免费区",
    meta: "",
    badge: { k: "live", price: "$19.99", date: mmdd(NOW + 3 * D), left, bundle: [{ c: "allDlc" }, { c: "edition" }] },
  },
  {
    category: "游戏·本周", title: "Castlevania Anniversary Collection",
    url: "https://store.epicgames.com/p/castlevania-anniversary-collection", source: "Epic", lang: "en", ts: NOW - 2 * D,
    img: thumb("#a85584", "Castlevania"),
    desc: "初代三部曲合集 · 本周免费领取",
    meta: "",
    badge: { k: "live", price: "$7.99", date: mmdd(NOW + 3 * D), left, bundle: [] },
  },
  {
    category: "游戏·即将", title: "Ghostrunner 2",
    url: "https://store.epicgames.com/p/ghostrunner-2", source: "Epic", lang: "en", ts: NOW + 5 * D,
    img: "",                       // 故意留空：没图时不该留一块 120px 的白洞
    desc: "One More Level 工作室 · 5 天后开领",
    meta: `🔔 ${mmdd(NOW + 5 * D)} 起免费 · 价值 $29.99`,
    badge: { k: "soon", price: "$29.99", date: mmdd(NOW + 5 * D), bundle: [] },
  },
  {
    category: "游戏·即将", title: "LISA: Definitive Edition",
    url: "https://store.epicgames.com/p/lisa-definitive-edition", source: "Epic", lang: "en", ts: NOW + 5 * D,
    img: thumb("#8a6b96", "LISA"),
    // 服务端 desc = 工作室 + Epic 原始描述的叙事句；含几个 DLC、什么版本
    // 这些结构化信息只走 meta/badge。这里刻意不把徽章文案抄进 desc，
    // 否则测试等于在给自己造假重复——上一版就是踩了这个坑才误报服务端 bug。
    desc: "Austin-based Sad Owl Studios 制作 · 一场关于末日前最后几天的人性拷问",
    meta: `🔔 ${mmdd(NOW + 5 * D)} 起免费 · 价值 $24.99 · 含 5 个 DLC · 豪华版`,
    badge: { k: "soon", price: "$24.99", date: mmdd(NOW + 5 * D), bundle: [{ c: "dlcN", n: 5 }, { c: "deluxe" }] },
  },
  {
    category: "游戏·长期", title: "Them's Fightin' Herds",
    url: "https://store.epicgames.com/p/thems-fightin-herds", source: "Epic", lang: "en", ts: NOW - 900 * D,
    img: "",
    desc: "Tender Claws 制作 · 2022 年上架 Epic 免费区常驻",
    meta: "♾ 长期免费 · 原价 $14.99",
    badge: { k: "perma", price: "$14.99", bundle: [] },
  },
  {
    category: "游戏·长期", title: "TerraScape",
    url: "https://store.epicgames.com/p/terrascape", source: "Epic", lang: "en", ts: NOW - 300 * D,
    img: thumb("#6f6a86", "TerraScape"),
    desc: "免费区常驻，无折扣信息",
    meta: "♾ 长期免费",
    badge: { k: "perma", price: "", bundle: [] },
  },
];