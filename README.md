# 信息河 · InfoStream

一条部署在 **Cloudflare Pages** 上的多域名信息聚合站。
不是 hao123 那种静态链接格子，而是一条**永远往下流、滚动不息**的信息河——
滚到底自动续接，一直有新东西。

**v2.5（本版本）**：一个 Pages 项目，**五个**独立站点，按 Host 头切换形态。
- 🎮 **新增游戏站** `game.myinfostream.com`：Epic 免费领取，三个 tab 分「本周免费 / 即将开放 / 长期免费」，
  按领取截止时间排序。三个 tab 共用**一次**上游请求，靠客户端按 `badge.k` 收窄（见下方「为什么 game 站不用三个源」）。
- 🔥 **新增热搜站** `hot.myinfostream.com`：微博 / 百度 / 抖音三榜分榜对照，一个 tab 对应一个独立上游。
- 🔗 **互链双向性由测试强制**：加站时最容易漏掉某个方向的 `siblings`，单向链不会让页面报错，
  但会让搜索引擎把子站当成互不相关的独立站——`hosttest.mjs` 现在断言每条互链都是双向的。
- 🌍 **i18n 覆盖率由测试强制**：`uiText()` 在缺语言时静默回落到裸 key 名，页面不报错、只有中文用户看不出来。
  现在 23 个 tab / 入口键的十语种齐全性与非空性都是断言。

**v2.4**：一个 Pages 项目，三个独立站点，按 Host 头切换形态。
- 🌐 **三站同源部署**：`myinfostream.com`（聚合主站）/ `ai.myinfostream.com`（AI 情报）/ `news.myinfostream.com`（国际新闻）。
  同一份代码、同一次构建，靠 Host 区分站点——canonical / description / tagline / 语言集 / Tab / 数据源全部独立。
- 🧭 **Tab 取代类目多选**：顶部 Tab 单选，每个 Tab 声明自己的数据源组合（由服务端下发），前端不再硬编码类目。
- 🚪 **主站改入口模式**：主站不再把所有内容混成一条流，改为「简报 + 两个子站入口卡片」，子站整段隐藏看板。
- 🔒 **源码不再泄漏**：`build.mjs` 白名单构建到 `public/`，任何人访问 `/functions/_lib/sources.js` 都拿不到源码。
- 🗺️ **sitemap / robots 按站生成**：三站各自独立，预览域名自动 `noindex`。

**v2.2**：接口不再暴露，工具区只给自己用。
- 🔒 **私有接口默认关闭**：`/api/discover`、`/api/translate` 未配密钥一律 403，界面上也不显示入口；地址栏带 `?key=` 才解锁。
- 🛡️ **公开接口限流 + 同源校验**：`/api/feed` 30 次/分/IP，跨站 `Origin` 直接拒绝，响应头不再有 `Access-Control-Allow-Origin: *`。
- 🔎 **接口检索支持英文**：每条内置清单加了英文别名，中英文都能搜到。

**v2**：面向全球用户，尤其是**小语种用户**。
- 🌍 **19 种语言**界面（含加泰罗尼亚语、巴斯克语、威尔士语、加利西亚语、世界语、斯瓦希里语等小语种），阿拉伯语自动 RTL。
- 🧭 **固定常驻看板**：天气 / 游戏 / AI 各占独立固定位置，不随瀑布流滚动消失。
- 🔭 **发现全球免费接口**：内置接口发现面板，可搜索全球免费、无需密钥的公共 API（**仅自己可见**）。
- 🌐 **按你的语言展示内容**：卡片标题可经 MyMemory 一键翻译为你所选语言（**仅自己可用**）。
- 🎨 **暖心配色**：奶油 / 陶土 / 琥珀色系，告别冷色调。

## 它和你说的 hao123 有什么区别

| | hao123 | 信息河 |
|---|---|---|
| 形态 | 静态链接网格 / 榜单 | 无限瀑布流（masonry）+ 固定常驻看板 |
| 信息 | 停在那里等你点 | 持续流动，滚到底自动加载下一批 |
| 内容 | 新闻 + 导航 | 五个独立站点：聚合简报 / AI 情报 / 国际新闻 / 游戏限免 / 实时热搜 |
| 布局 | 一栏 | Tab 单选分区，每个 Tab 绑定自己的数据源组合 |
| 语言 | 单一（中文） | 主站 19 种语言，含小语种，可翻译卡片内容 |
| 新鲜度 | 手动刷新 | 每次滚动重新洗牌 + 上游实时刷新 |
| 接口 | 全裸 | 私有接口默认关闭 + 密钥解锁，公开接口限流同源 |

## 五个站点一览

一个 Cloudflare Pages 项目同时服务五个域名，靠 `Host` 头切换站点形态。
**代码只有一份，站点配置在 `functions/_lib/hosts.js` 里分开声明。**

| 域名 | 定位 | 默认语言 | Tab | 常驻看板 | 入口卡片 |
|---|---|---|---|---|---|
| `myinfostream.com` | 聚合主站 | 简中 | 简报 / 国际 / AI / 娱乐 | ✅ | ✅（四个子站） |
| `ai.myinfostream.com` | AI 情报站 | 简中 | 全部 / 模型 / 芯片 / 商业 / 论文 | ❌ | ❌ |
| `news.myinfostream.com` | 国际新闻站 | 英文 | 头条 / 财经 / 科技 / 地区 | ❌ | ❌ |
| `game.myinfostream.com` | 游戏限免站 | 简中 | 本周免费 / 即将开放 / 长期免费 | ❌ | ❌ |
| `hot.myinfostream.com` | 实时热搜站 | 简中 | 微博 / 百度 / 抖音 | ❌ | ❌ |

子站之间靠 `siblings` 互链，主站靠 `entries` 给四个子站各一张入口卡片。

### 为什么用子域而不是路径（`/ai/`、`/game/`）

1. **SEO**：每个域名是一个独立站点，canonical / robots / sitemap 各自独立，
   搜索引擎不会把子目录当成主站的重复内容。
2. **隔离**：各站可挂不同的 Cloudflare WAF 规则、不同的缓存策略。
3. **成本**：同一个 Pages 项目、同一次构建、同一份代码，**没有额外部署**。

### game 站：为什么三个 tab 只声明一个源

`hosts.js` 里 game 站的三个 tab 都写着 `sources: ["games"]`，看起来像笔误，其实是刻意的：

```js
tabs: [
  { id: "live",  i18n: "tabGameLive",  sources: ["games"] },
  { id: "soon",  i18n: "tabGameSoon",  sources: ["games"] },
  { id: "perma", i18n: "tabGamePerma", sources: ["games"] },
],
```

Epic 的 `freeGamesPromotions` **一次就返回全部三态**，只是每条带一个 `badge.k`
（`LiveNow` / `Upcoming` / `KeepForever`）。如果按常规做法把一个函数拆成
`games-live` / `games-soon` / `games-perma` 三个源，`fetchBySources` 会并发把
**同一个 EPIC 接口打三遍**——这正是 `sources.js` 顶部注释里记着的、
news 站把自己打到限流的那个坑。

所以三个 tab 共用一次请求，取回的整批结果由前端 `filterByTabState()` 按
`badge.k === tabId` 收窄。`tabId` 与 `badge.k` 的 `live/soon/perma` 恰好同名，
不需要额外映射表。

**代价与收益**（实测，2026-10-22）：

| | 拆成三个源 | 共用一个源 + 客户端过滤 |
|---|---|---|
| EPIC 上游请求 | 3 次 / 切 tab | **1 次**，切 tab 零额外请求 |
| 单 tab 耗时 | 578ms × 3 | **578ms** |
| 过滤逻辑位置 | 服务端，浪费带宽 | 客户端，浏览器零成本 |

**顺序不能反**：客户端必须**先**按 tab 收窄、**再**交给 `feedSeen` 去重。
反过来的话，「本周免费」tab 会把即将/长期也标记成已见，切到「即将开放」时
它们被当成「见过了」丢掉——两个 tab 互相把对方的数据吃掉。这是 `app.js`
`loadFeed()` 里有注释锁住的地方。

`apitest.mjs` 现在会对共源 tab 做一次切片校验（live=2 / soon=2 / perma=5，
任一为空就报错），因为「三态切得开」这件事只有真打一次上游才算验证过。

### hot 站：三个 tab 三个独立上游

和 game 站相反，hot 站的三个 tab 是**一对一**的关系：

```js
tabs: [
  { id: "weibo",  i18n: "tabHotWeibo",  sources: ["weibo"] },
  { id: "baidu",  i18n: "tabHotBaidu",  sources: ["baidu"] },
  { id: "douyin", i18n: "tabHotDouyin", sources: ["douyin"] },
],
```

三个源是三个不同的接口（微博热搜榜 / 百度热搜榜 / 抖音热点），不重复调用，
所以常规写法就对了：每个 tab 声明自己的源，`fetchBySources` 各打一次。

实测 52 / 51 / 49 条，59–165ms。hot 站刻意**不复用**主站娱乐 tab 里的
「抖音 + 海外娱乐媒体」组合——那会把娱乐新闻混进纯热搜榜，破坏这个站
「分榜对照，一眼看出全网此刻在关注什么」的定位。

## 目录结构

```
hao-feed/
├── index.html              # 唯一静态模板（五域名共用，运行时由 functions/index.js 按 Host 改写）
├── assets/
│   ├── styles.css          # 暖心配色瀑布流样式（含 RTL / Tab / 入口卡片）
│   └── app.js              # i18n(19 语) + Tab 单选 + 看板 + 无限加载 + 翻译 + 演示模式
├── functions/
│   ├── index.js            # HTML 改写：按 Host 注入 canonical/description/tagline/lang/Tab/入口
│   ├── robots.txt.js       # 按 Host 生成 robots.txt（主站 Allow，屏蔽 /api/）
│   ├── sitemap.xml.js      # 按 Host 生成 sitemap，五站各自独立
│   ├── _lib/
│   │   ├── hosts.js        # ★ 五站配置唯一真相源（域名/语言/Tab/数据源/互链）
│   │   ├── budget.js       # ★ 超时预算唯一真相源（内层 < 外层 deadline < 最坏预算）
│   │   ├── page.js         # HTML 模板改写与配置注入
│   │   ├── sources.js      # 数据源注册表（每个源 = async (opts) => card[]）
│   │   ├── gnews.js       # Google News 多语种接入与 source 映射
│   │   └── util.js         # 抓取/解析/去重/时间戳等公共工具
│   └── api/
│       ├── _guard.js       # 公共守卫：限流 + 密钥校验 + 同源校验
│       ├── feed.js         # 唯一公开接口：?host=&tab=&lang= 分发取数（三层缓存）
│       ├── translate.js    # MyMemory 翻译代理（私有，需密钥）
│       └── discover.js     # 全球免费接口发现（私有，需密钥）
├── build.mjs               # 白名单构建 → public/（只发布该发布的，防源码泄漏）
├── public/                 # ★ 构建产物（部署目标，不要手改）
├── alltest.mjs             # ★ 一键跑全部测试（预算→契约→守卫→API→浏览器）
├── budgettest.mjs          # ★ 超时预算不变式测试（禁裸字面量 + 内层必小于外层）
├── localsim.mjs            # ★ 本地「准线上」预览（真跑 functions handler）
├── webtest.mjs             # ★ 真实浏览器逐 tab 点一遍，统计真实卡片数
├── hosttest.mjs            # ★ 多域名契约测试（228 项：配置/DOM/去重/幽灵语言/互链/i18n）
├── apitest.mjs             # API 分发测试（五站 × 各自 tab 真调 handler，共源 tab 做切片校验）
├── gametest.mjs            # Epic 三态归一化测试（live/soon/perma 分类与排序）
├── gamefixture.mjs         # Epic 上游的真实响应样本（测试用，不联网）
├── gameshot.mjs            # 游戏站多语言截图（Playwright 出图，肉眼验视觉）
├── hotshot.mjs             # ★ 热搜站出图与断言（3 语言 × 3 榜 = 148 项，走真数据）
├── simhosts.mjs            # ★ game/hot 子域名的本机解析规则（--host-resolver-rules）
├── pwpath.mjs             # ★ Playwright 的定位与加载（多套安装路径时只改这一处）
├── guardtest.mjs           # 守卫行为测试（A–G 七组场景：鉴权/跨站/限流/CORS）
├── test-guard.mjs          # ★ 限流分桶回归（拆桶后最怕「桶没了限流也没了」，专门盯这点）
├── brandtest.mjs           # 8 语言品牌名 + RTL + 标题测试（真实浏览器）
├── uitest.mjs              # ★ 双场景 UI 测试（访客 / 带密钥开发者，密钥走 SIM_KEY）
├── diag.mjs                # 单点诊断：手动打某个 tab 的接口看原始 JSON
├── timeouttest.mjs         # 超时保护必须盖到「读 body」阶段
├── edgetest.mjs            # stale-while-error 兜底层测试
├── staletest.mjs           # 前端 stale 横幅弹出测试
├── probe-*.mjs             # 一次性诊断探针（不进版本库，见 .gitignore）
├── favicon.svg             # 三道水波图标（品牌主色）
├── _routes.json            # 路由规则（仅 / 与 /api/* 等走函数）
├── wrangler.toml           # 构建命令 + 输出目录 + 环境变量说明
├── .gitignore              # 排除出图产物 / public/ / bak/ / probe-* / node_modules
├── bak/                    # 历史诊断脚本与旧截图归档（不参与构建/部署）
└── README.md
```

> `robots.txt` / `sitemap.xml` 不再是静态文件，而是 `functions/` 下的函数——
> 五站的 robots 与 sitemap 内容不同，静态文件没法按 Host 区分。

### 本地测试的密钥约定

私密端点（`discover` / `translate`）只在 `API_SECRET` 存在时才放行。测试脚本与
本地服务**共用同一个 env 名**，这样就不可能两边错开：

```bash
API_SECRET=simsecret node localsim.mjs 8788     # 起服务
SIM_KEY=simsecret node uitest.mjs               # 跑测试（同一把钥匙）
SIM_KEY=simsecret node probe-429.mjs
SIM=1 node alltest.mjs                          # SIM=1 让 webtest 也打本机
```

> 密钥不匹配的典型症状**不是**「限流」，而是整齐的一片 401：接口区块空白、
> 检索 0 命中。probe-429 会把 401 单独点出来，因为它不限流——混在一起看
> 会误判成「无 429，一切正常」。

## SEO 基础配置

已就位，无需额外操作：

- `favicon.svg` + `<link rel="icon">` + `apple-touch-icon`（iOS 主屏图标）。
- `canonical` / `og:url` 由 `functions/index.js` **按 Host 动态注入**——五个域名各自指向自己，不会互相重复计权。
- 完整 `og:*` / `twitter:*` 分享元信息（含 `og:locale:alt` 声明 zh_CN / zh_TW / en_US 三种）。
- `description` / `og:description` 五站独立文案，互不重复。
- `robots.txt` / `sitemap.xml` 由函数生成：放行全站但屏蔽 `/api/`，sitemap 按站列出该站支持的语言 URL。
- 预览域名（`*.pages.dev` / `localhost`）自动注入 `noindex`，避免与正式域名争索引。
- `theme-color` 暖米色，移动端浏览器地址栏同色。

> **待补（下次做）**：`og:image` 目前用的是 svg，部分平台（尤其 Twitter）不支持 svg 分享图，
> 建议补一张 `og.png`（1200×630）。

## 工作原理

- **前端**只有一份 `index.html`，五个域名共用；站点差异全部由服务端注入的 `window.__CFG` 决定。
- **前端**只调用同源的 `/api/feed?tab=xxx`，由 Cloudflare 边缘函数按Tab 声明的源列表抓取。
- **函数端**并发拉取各数据源 → 归一化为统一卡片 → 整体打乱 → 返回 JSON；单源失败被隔离，不影响整条流。
- 天气 / 游戏 / AI 走**独立固定看板**（`#w-weather` / `#w-games` / `#w-ai`），通过浏览器直连 Open-Meteo / Epic / HuggingFace，常驻页面顶部。
- 瀑布流部分每次触底拉取下一批；不同批次之间上游已刷新，加上重新洗牌，**视觉上永不枯竭**。
- 所有数据源**免费、无需密钥**；服务端发起的请求天然绕开浏览器 CORS。

---

## v2.4.1 修复记录（v2.4 上线后全站白屏）

v2.4 部署后，用户打开三个站**全都没有卡片**。这次排查花了很久，
因为**所有原有测试全绿** —— 记录在此，因为教训比修复本身更值得留下。

### 主 bug：数据取回来了，但没人画到页面上

| 现象 | 真正原因 |
|---|---|
| `/api/feed` 返回 200、19 条完整 JSON | 后端完全正常 |
| 页面 `#feed` 的 `innerHTML` 是**空字符串** | 数据卡在 `buffer` 里没被渲染 |
| 控制台 0 错误、无失败请求 | 因为确实没有代码抛错 |

死锁链条：

```
启动 → io.observe(sentinel) 立即触发
     → pump(12) → renderMore(12)
     → 此时 buffer 还是空的 → 异步启动 loadFeed()
     → 循环条件 buffer.length > 0 为假，画了 0 张，renderMore 返回
     → loadFeed 回来后只往 buffer 里塞数据，没有调用 renderMore
     → sentinel 的相交状态没变化，IO 不再触发
     → 用户没滚动，scroll 兜底也不跑
     → 死锁：数据在 buffer 里，页面永远空白
```

v2.4 重构时把 `loadFeed` 结尾的绘制调用丢了，只留下 `setStatus`。
修复：`loadFeed` 的 `finally` 里判断 `feed.childElementCount === 0`
（用户还没看到任何东西）就主动 `renderMore(24)`。

**为什么三个原有测试都没抓到**：它们测的全是「接口返回的 JSON 对不对」，
没有一个测「数据有没有变成 DOM 里的卡片」，而用户看到的恰恰是后者。
curl 能拿到 19 条，浏览器内 `fetch` 也能拿到 19 条 —— 断的那一环在两者之间。

### 同一晚发现的另外三个问题

**1. 内层超时 > 外层 deadline，一天内出了三次**

症状都是「200、JSON 合法、0 条」，且没有任何报错：

| # | 位置 | 内层 | 外层 | 后果 |
|---|---|---|---|---|
| 1 | `gnews.js` vs `sources.js` | 8000ms | 6000ms | 所有 Google News 源被判空，world/ai 随机 0 条 |
| 2 | 修复时把外层调到 11000ms | — | — | 最坏延迟 11+4=15s，线上实测顶到 **23.4 秒** |
| 3 | `sources.js` 的 `arxiv()` | 9000ms | 8000ms | **arXiv 论文源一直是死的**，但同 tab 有别的源，页面看不出异常 |

根因不是「忘了调数值」，是超时值散落三个文件、大小关系只能靠人脑记住。
现在全部收进 `functions/_lib/budget.js`，并由 `budgettest.mjs` 强制断言
「所有内层超时 < SOURCE_DEADLINE」+「源码里不许再出现裸的超时字面量」。
改坏了测试立刻红。

**2. 模块级缓存只在单个 isolate 内有效**

`feed.js` 原本是 `new Map()` + 15 秒 TTL。Cloudflare Pages 会随时回收 isolate、
新建冷 isolate，冷 isolate 上 Map 全空 → 每个请求都重新抓上游。
实测同一个 URL 连续两次：**1.4 秒 / 23.4 秒**。

现在加了一层 `caches.default` 边缘缓存（跨 isolate 共享，TTL 60s）。
三层结构：模块 Map（同 isolate，零开销）→ 边缘缓存（跨 isolate）→ 真抓上游。

**3. 空结果被缓存**

上游偶发超时时抓回 0 条也照样写缓存，接下来 15 秒整个 tab 一直空白 ——
一次偶发失败被放大成一整段用户可见的空白。
现在空结果不进任何一层缓存。边缘层尤其要小心：TTL 60s，一次空响应缓存住就是整整一分钟白屏。

### 效果

修复前后同一个真实浏览器测试（`webtest.mjs`）：

| | 修复前 | 修复后 |
|---|---|---|
| 简报 / 国际 / AI / 娱乐 | 4 个 tab 全部 0 张卡片 | 4 个 tab 全部有数据 |
| 首屏渲染耗时 | 8.9 秒后仍空白 | 2.8 秒出 24 张卡片 |

### 沉淀下来的东西

- **`budgettest.mjs`** —— 把「靠人记住的不变式」变成「CI 强制的不变式」
- **`webtest.mjs`** —— 真实浏览器逐 tab 点一遍，统计渲染出的卡片数。
  这是唯一能抓到本次这类 bug 的测试
- **`localsim.mjs`** —— 前端走本地、`/api/` 走本地或线上，能隔离出「渲染链路」还是「取数链路」的锅
- **`alltest.mjs`** —— 一键跑全套。**少这一层的教训是：补写的测试很可能被忘掉**

### 「幽灵语言」：hosts.js 声明 ≠ 前端能渲染

`hosts.js` 的 `langs` 与 `app.js` 的 `LANGS` + `I18N` **必须对齐**。
只声明了 `ko` 但前端没有 `I18N.ko` 时，会出现一个很难发现的 bug：
`?lang=ko` 通过了服务端校验 → 前端 `I18N["ko"]` undefined 回落到中文内容，
但 `<html lang="ko">` 还挂着 —— **页面语言声明与实际内容不符**，对 SEO 和读屏都是错的。

现在两处都被守住：

- 前端 `renderable()` = `LANGS ∩ HOST.langs`，`detectLang` / 语言下拉都只认这个交集。
- `hosttest.mjs` 有专门断言扫「幽灵语言」，v2.4 就是在这一步抓到 `ai` / `news` 两站多写的 `ko`。

> 要加韩语：**先**在 `app.js` 补 `LANGS` 的 `{code:"ko"}` 与 `I18N.ko` 全部文案，
> **再**回 `hosts.js` 加这一行。顺序反了就会掉进上面那个坑。

### Tab 取代类目多选

旧的顶部「类目 chips」是多选，前端硬编码一份类目表，服务端只认 `?cat=热搜,娱乐`。
v2.4 改成**Tab 单选**：

- Tab 列表与「Tab → 数据源组合」的映射由 `hosts.js` 下发，前端不硬编码。
- 单选避免了「勾了三个类目、每类只出几条、页面看着像坏了」的空档感。
- 只有 1 个 Tab 时整个 Tab 条`hidden`，不留一条孤零零的胶囊。
- 子站整段隐藏常驻看板（`#widgetsWrap` 直接 `hidden`）——留一个空标题加空框比不显示更糟。

### 构建隔离：源码不对外

原来 `wrangler.toml` 里 `pages_build_output_dir = "."`，
把整个项目目录当静态资源上传 —— 任何人访问 `/functions/_lib/sources.js` 都能下载完整源码。
`_routes.json` 的 `"/*.js"` 只匹配根目录一层，挡不住子目录。

现在 `build.mjs` 用**白名单**（`index.html` / `assets` / `favicon.svg`）拷进 `public/`，
并在结束时**自检**：`public/` 里出现 `functions/`、`_lib/`、`.mjs` 就直接构建失败。

### 本地跑测试

```bash
node alltest.mjs           # 一键跑秒级套件（budgettest / hosttest / guardtest）
node alltest.mjs --full    # 再加上 apitest（真打 Google News，约 15 秒）
node alltest.mjs --e2e     # 再加上真实浏览器端到端 4 件（需先 node localsim.mjs 8788）

# 也可以单独跑：
node budgettest.mjs   # 超时预算不变式（见下方「2026-10-22 事故记录」）
node timeouttest.mjs  # 超时保护必须覆盖到「读 body」（起一个故意挂死 body 的坏上游）
node edgetest.mjs     # stale-while-error 兜底：mock 掉全部上游，验证回退旧快照
node staletest.mjs    # 前端真的弹出 stale 横幅（需先 node localsim.mjs 8788，SIM=1）
node hosttest.mjs     # 多域名契约 228 项：配置/DOM 契约/跨站去重/幽灵语言/preview noindex/互链双向/i18n 覆盖
node apitest.mjs      # API 分发 26 项：五站 × 各自 tab 真调 handler，校验字段完整 + 共源 tab 切片
node gametest.mjs     # Epic 三态归一化（live/soon/perma 分类正确 + 按截止日排序）
node guardtest.mjs    # 守卫行为 A–G 七组场景
node brandtest.mjs    # 8 语言品牌名 + htmlLang + dir + 标题（真实浏览器）
node webtest.mjs [url]# 端到端：真实浏览器逐 tab 点一遍，统计渲染出的卡片数
node gameshot.mjs    # 游戏站出图（拦 /api/feed 注夹具，Epic 每周换货所以 img URL 会漂）
node hotshot.mjs     # 热搜站出图（不拦，走真数据 —— 见下方「两个 shot 的分岔」）
node diag.mjs [url] [tab]  # 单点深诊断：接口层/渲染层/边界层分开打，直接指出断在哪层
node build.mjs        # 构建到 public/，并自检未泄漏源码
```

> **两个 shot 的分岔**：gameshot 拦 `/api/feed` 注入夹具，hotshot 不拦。
> 因为两站要断言的根本不是同一件事 —— game 站验的是「客户端按 `badge.k`
> 收窄出三种徽章」，夹具正好；hot 站验的是「host → tab → source 整条取数
> 链路」，一夹具就把最容易坏的那一环屏蔽掉了。上一轮 `localsim.mjs` 的
> `/api/` 分支漏做 `.test → .com` 还原（导致 hot 站抓到 0 条），就是靠
> hotshot 走真数据才暴露出来的。

> `hosttest.mjs` 里最值钱的一条是**幽灵语言检测**：比对 `hosts.js` 声明的 `langs`
> 与 `app.js` 的 `LANGS`，多写一个码就报错。v2.4 的 `ko` 就是这一步抓出来的。

> 白屏时先用 `diag.mjs` 定位再修：它会分别报接口返回多少条、DOM 里渲染多少条、
> 网络与控制台有什么错，最后直接给一句判定（如「接口有数据、DOM 没卡片 → 渲染层断了」）。
> v2.4.1 那次接口层和边界层全是绿的，只有分层打才看得见真正断点在渲染层。

### 本地「准线上」预览

```bash
node localsim.mjs 8788              # 前端走本地 public/，/api/ 调本地 functions handler
SIM=1 node webtest.mjs http://myinfostream.test:8788/
UPSTREAM=1 node localsim.mjs 8789   # /api/ 改成代理线上，对比本地代码与已部署代码
```

> **必须用 `http://myinfostream.test:8788/`，不能用 `127.0.0.1`。**
> `app.js` 的 `isLocal()` 判的是 hostname，`localhost` / `127.0.0.1` 会让它切到
> 演示模式，真实取数链路整个被绕过 —— 那样测出来的「全绿」什么也证明不了。
> 配 playwright 的 `--host-resolver-rules` 把假域名指到本机即可（`SIM=1` 会自动加）。

## v2.4.2 修复记录（AI 站 5 个 tab 有 3 个空白）

v2.4.1 修好渲染死锁后，AI 站（ai.myinfostream.com）仍有 tab 空白。
这次和上次不是同一个原因，而且**上次那个修复还帮了倒忙**。

### 现象：5 个 tab 里 3 个是空的，而且时好时坏

用真实浏览器逐 tab 点，发现 `大模型 / 芯片算力 / 商业` 三个 tab 全白，
`全部 / 论文` 正常。curl 单打接口则显示「200、JSON 合法、0 条」——
后端没报错，只是没取到东西。

**「时好时坏」是最关键的一条线索**：如果是代码写错，应该是稳定地错；
会好会坏，说明有**间歇性**因素。定位到 Cloudflare 边缘 IP 访问
`news.google.com` 会随机失败（同一分钟内，`商业` tab 拿到 15 条，
`大模型` tab 跑满 11 秒双轮超时后返回 0 条）。

### 主 bug：`fetchRaw` 的超时保护根本没盖到「读 body」

这是上一轮埋下的、v2.4.1 没能暴露的雷：

```js
// 修复前
const id = setTimeout(() => ctrl.abort(), timeout);
try {
  const res = await fetch(url, { signal });   // ← 这一行在**响应头到达时**就 resolve
  if (!res.ok) throw ...;
  return res;                                  // ← 定时器在 finally 里被清了
} finally { clearTimeout(id); }
```

`fetch()` 的 promise 在**响应头到达时**就 resolve，body 还在流。
所以 `clearTimeout` 执行的时刻比想象中早得多 —— abort 保护在
「开始读 body」之前就已经被摘掉了。后果是：

- 上游慢在**响应头** → 超时生效，表现正常（所以本机测不出来，本机到 GN 只要 2 秒）
- 上游慢在**body** → 没有超时保护，`res.text()` 裸奔，可以挂到天荒地老

`timeouttest.mjs` 起了一个「发完响应头就永久挂住 body」的坏上游来锁死这条。
用修复前的实现跑同一个场景：预算 1200ms，实际 **8000ms 仍未返回**。

修复方式是让 reader 闭包跑在保护范围内：

```js
async function fetchGuarded(url, headers, timeout, reader) {
  const ctrl = new AbortController();
  const id = timeout > 0 ? setTimeout(() => ctrl.abort(), timeout) : null;
  try {
    const res = await fetch(url, { signal: ctrl.signal, ... });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await reader(res);      // ← 读 body 也在保护内
  } finally {
    if (id) clearTimeout(id);      // ← 到这里才清理
    try { ctrl.abort(); } catch {} // 主动断 socket，别让读完的 body 占着连接
  }
}
```

`fetchText` / `fetchJSON` 都改走 `fetchGuarded`。

### 次 bug：`ai-news` 的媒体白名单严到几乎打不中

`strictSource: true` 会把结果硬过滤到 5 家指定媒体，叠加关键词后实测：

| 配置 | 条数 | 命中的媒体数 |
|---|---|---|
| 白名单 + 关键词 | 10 | 3（5 家里有 2 家永远不命中） |
| 纯关键词（放宽） | 100 | 42 |

改成 `strictSource: false`，质量交给 `isJunkTitle` 闸门兜。
这和 news 站的 fr/ar/ru 是同一个结论：**Google News 的 `source:` 运算符
只按媒体名匹配，任何固定白名单在多语种/长尾查询下都会漏**。

### 第三层保险：stale-while-error（宁可旧，不要白）

前两个 bug 修完，上游**依然可能**抽风 —— 边缘 IP 的网络问题是外部条件，
代码只能减少暴露面，不能根除。所以加了兜底层：

维护两份边缘缓存，用 URL 路径前缀区分（Cache API 的 `match` 不按 TTL 过滤，
只能靠不同 key 来分）：

| 层 | key | TTL | 用途 |
|---|---|---|---|
| 新鲜层 | `/__f60?…` | 60s | 正常读取路径 |
| 兜底层 | `/__s86400?…` | 24h | 只在「新鲜层没有」且「本次抓取失败」时读 |

抓取成功 → 两份都刷新；抓取失败 → 回退兜底，响应里标 `stale: true`，
前端在顶部挂一条琥珀色横幅（「实时源暂时无响应 · 显示最近一次成功获取的内容」）。
恢复正常后横幅自动消失。

**关键约束：兜底层只在有非空数据时才写**，绝不让一次失败污染兜底。
另外「冷启动时兜底也没有」这种情况会如实返回 0 条且 **不标 stale** ——
没有旧数据却标「显示最近一次成功获取的内容」是骗用户。

配色也刻意和 demo 模式区分开（橙 vs 琥珀），
否则用户看到橙色会以为「我一直看的是演示数据」。

### 配套的两个新测试

这两个测试都测的是**正常路径永远不执行**的代码，靠正常跑永远测不出来：

- **`edgetest.mjs`**（后端）—— mock 掉**全部**上游 + 补一个内存版 `caches`，
  验证「上游全挂时回退旧快照且 `stale:true`」「fresh 命中时不误标 stale」
  「冷启动无数据时不谎标 stale」。
  写这个测试时踩了两个坑，都记在文件注释里：mock 只拦 `news.google.com`
  会让 arXiv 等真实源照常返回，stale 分支根本没被执行；
  场景设计还必须让 L1（15s）和 fresh 层（60s）都过期才测得到回退。
- **`staletest.mjs`**（前端）—— 拦截 `/api/feed` 注入 `stale:true`，
  验证横幅真的会弹出来、文案对、class 带 `warn`，且恢复正常后消失。
  stale 是「后端标了、前端响了」的跨端约定，两边各写各的最容易一边改了另一边没跟。

### 一句话教训

> 会好会坏的 bug，先怀疑外部条件，不要先怀疑代码写错。
> 而「修好了也不保证不复发」的外部条件，要用兜底数据兜住，而不是等它恢复。

## v2.5.1 修复记录（翻译从未生效 + 滚动末段卡死）

两个都是**早就存在、只是这轮才被测出来**的问题：一个让功能形同虚设，
一个让末段内容永远画不出来。

### 1. 翻译端点从来没工作过（`await` 缺失）

| | |
|---|---|
| **症状** | 端点返回 200、`results` 长度也对，但**每条结果都等于原文** |
| **根因** | `fetchJSON()` 里写成 `const res = fetch(url)` —— 少一个 `await`，`res` 拿到的是 Promise 而不是 Response。于是 `res.ok` 恒为 `undefined`，`!res.ok` 恒真，每一条都抛 `HTTP undefined` |
| **为何没被发现** | 失败被 catch 后**静默回落原文**。所有断言只看状态码和数组长度，全绿；curl 和接口测试也看不出——只有把译文和原文对照着看才知道它压根没翻 |
| **修复** | `fetchJSON` 改 `async` 并补上 `await` |

> **教训**：静默兜底（catch 后回落原文）把一个致命错误伪装成了正常输出。
> 降级路径必须有独立的观测手段，否则它会一直把错误藏起来。

批量化的验证（`probe-translate.mjs`）：`POST[10] POST[10] POST[1]` 覆盖 21 条文本，
抽样 8 条标题全部译出且**顺序正确**。顺序这项必须单独验——顺序错了不会报错，
只会让整屏卡片张冠李戴。

### 2. 滚动到末段后，最后几张卡永远画不出来

首屏 24 张 → 滚一下变 36 张 → **无论怎么滚都停在 36**，buffer 里还剩 3 张，
底部却已经写着「✓ 暂时到底」。

三层原因叠加，每层单独看都合理：

| 层 | 机制 | 问题 |
|---|---|---|
| IO | 只在 sentinel「相交状态**变化**」时回调 | 画完 36 张后 sentinel 仍停在相交区，状态没再变 → 不再回调 |
| scroll 兜底 | 只在滚动事件里跑 | `scrollY` 已到文档最大高度，再滚也不动 → 不再产生事件 |
| 220ms 节流 | `if (now - ioThrottle < 220) return` | 前一次 pump 后仅隔 120ms 就来了新事件，**被直接丢弃** |

于是两条路同时断掉，而 buffer 里的货无人认领。

**修法**：节流语义从「丢弃」改为「延后补跑」（尾沿）——窗口内的调用记下要画的
张数，窗口结束后保证再执行一次。节流本来是为了防止一次滚动里铺出几百张卡，
补跑一次不影响这个目的，但让「唯一的机会」不再丢失。

> **教训**：丢弃式节流只在「保证还有下一次事件」时安全。这两个触发源都是
> **边沿**触发（IO 状态变化、scroll 位置变化），一次机会丢掉就是永久丢失。
> 节流丢的不是重复调用，而是唯一调用。

补货回来的自愈条件也一并放宽（`loadFeed` 的 `finally`）：原来只看
`feed.childElementCount === 0`（页面是不是全空），现在加上 `nearBottom()`——
数据到货时页面通常已经有一屏卡了，只判断「空」救不了末段滞留。

**回归口径也改了**：`uitest.mjs` 场景 A 原来写死「滚 10 次」，等于把
「滚够了没」和「画完了没」混成一件事——bug 存在时它看到的增长就停在 36，
看起来像"数据源就这么少"。现在改成**滚到连续 3 次不涨为止**，并断言
`buffer.length === 0`（货必须清空），而不只看卡片数有没有涨。

回归结果（冷启动、每滚 4000px 等 120ms）：`12 → 24 → 36 → 39`，buffer 清零，
`/api/feed` 仍只 2 次请求（brief + ai 各一），无重复取数。

### 3. 顺手修的两处测试可靠性

- **`uitest.mjs` / `probe-429.mjs` 的密钥走 `SIM_KEY`**：原先硬编码 `"demo"`，
  而 `localsim` 只在 `API_SECRET` 存在时放行私密端点。两边错开就是整齐的 401，
  症状像功能坏了。probe-429 额外把 401 单独点出来——**401 不限流**，
  混在状态分布里会被读成「无 429，一切正常」。
- **`uitest.mjs` 场景 B 的等待**：原来拍固定时长，改为等真实结果出现。

---

## v2.1 修复记录（首屏空 + 滚动卡住）

用户反馈两个问题，均已修复并用真实浏览器（Playwright/Chromium）回归验证：

| 问题 | 真正原因 | 修复 |
|---|---|---|
| 本地双击 `index.html` 一片空白 | `index.html` 用了绝对路径 `/assets/app.js`，在 `file://` 下解析成 `file:///assets/app.js`（磁盘根目录），脚本根本没加载 | 改为相对路径 `assets/app.js`，`file://` 与 Cloudflare 两侧都可用 |
| 首屏只有十几张，之后一直转圈 | 转圈状态文案从不复位；IO 在数据返回前就已触发，buffer 空 → 什么都不渲染 | `bootstrapFeed()` 一次性打底 24 张；`setStatus()` 三态机（loading / more / end），loader 默认隐藏、仅 `.is-on` 时显示 |
| 滚到底后不再出新内容 | `IntersectionObserver` 只在「相交状态变化」时回调，sentinel 加载后一直停在视口内 → 不再触发 | 额外挂 `scroll` 兜底：只要 sentinel 还在视口下方 400px 内就继续补；220ms 节流防抖 |

实测（本地演示模式，1360×940）：

- 首屏 **24 张**卡片，状态栏显示「↓ 向下滚动 · 信息川流不息」
- 连续滚动 20 次 → 264 张；再连续小幅滚动 15 次 → **336 张**，页面高度同步增长，**永远触不到底**
- 控制台错误 **0**（本地无 Functions 时，翻译 / 看板 / 接口发现直接短路走演示数据，不再刷 fetch 协议报错）
- 语言切到 العربية 自动 `dir="rtl"`，状态文案正确本地化

## v2.2：接口不暴露（只给自己用）

v2 里 `/api/discover`、`/api/translate` 是裸接口——任何人拿到你的域名就能刷翻译额度、扒接口清单。
v2.2 把这两块改成**默认关闭、密钥开启**，并给公开的 `/api/feed` 加了限流与同源校验。

### 三层防护

| 层 | 手段 | 覆盖 |
|---|---|---|
| 1. 限流 | 内存滑动窗口，按 `CF-Connecting-IP` 计 | 全部接口 |
| 2. 密钥 | `API_SECRET` 环境变量，请求需带 `x-api-secret` 头或 `?key=` | `/api/discover`、`/api/translate` |
| 3. 同源校验 | `Origin` 存在且非本站 → 403（防浏览器跨站盗用） | `/api/feed` |

### 行为一览

| 接口 | 默认状态 | 说明 |
|---|---|---|
| `GET /api/feed` | **开放** | 首页数据源。限流 30 次/分/IP + 同源校验。想彻底锁死设 `FEED_REQUIRE_KEY=1`，但页面会随之空白 |
| `GET /api/discover` | **关闭（403）** | 未配 `API_SECRET` 时一律拒绝。配了才开放 |
| `GET /api/translate` | **关闭（403）** | 同上 |

> `/api/feed` 无法在「页面能用」的同时做到「完全不可见」——数据总得从某处出来。
> 它的实际风险是**额度/流量被白嫖**，30 次/分/IP 的限流 + 同源校验已经把刷取成本抬到不划算。
> 真正有价值的两个接口（翻译、接口发现）已经默认关掉了。

### 怎么给自己用

1. Cloudflare 控制台 → 你的 Pages 项目 → **Settings → Environment variables** → 加一条：

   | 名称 | 值 |
   |---|---|
   | `API_SECRET` | 一串随机字符，例如 `openssl rand -hex 24` |

2. 访问 `https://你的域名/?key=那串密钥`。
   密钥会写进 `localStorage`，地址栏里的 `key=` 会被自动抹掉，之后直接开域名就行。

3. 效果：
   - 顶部出现 **🌐 翻译** 按钮（非中文界面下）
   - 页面出现 **「发现全球免费接口」** 区块
   - 点 **⟳ 刷新** 会连同接口清单一起刷新

4. 别人访问你的域名：看不到这两块，直接点按钮/直接请求接口都会拿到 `403 disabled`。

### 环境变量

| 变量 | 默认 | 作用 |
|---|---|---|
| `API_SECRET` | 未设置 | 私有接口的总开关。**不设置 = discover/translate 一律 403** |
| `FEED_LIMIT` | `30` | `/api/feed` 每 IP 每分钟上限，超了返回 `429` |
| `FEED_REQUIRE_KEY` | `0` | 设为 `1` 则 `/api/feed` 也要密钥 |
| `RATE_LIMIT` | `10` | 私有接口每 IP 每分钟上限 |
| `ALLOW_NO_ORIGIN` | `0` | 设为 `1` 放行不带 `Origin` 头的请求（curl / 脚本） |

> **限流是内存实现**：Cloudflare Pages Functions 每个 isolate 各自持有计数，
> 高流量下会被打散到多个 isolate，实际阈值会高于配置值。
> 够用来挡住随手刷，**不是**扛得住有组织的攻击——真要严格限流得配 Cloudflare Rate Limiting 规则。

### 单独跑守卫测试

```bash
node guardtest.mjs
```

直接调 handler、不依赖 wrangler，覆盖 7 组场景：默认关闭、跨站拦截、密钥校验、
限流触发、`ALLOW_NO_ORIGIN`、中英文检索命中、响应头无 CORS 通配。

## 接入的数据源（已实测可用）

### 五个站各自的源组合

| 站点 | Tab | 源组合 |
|---|---|---|
| 主站 | 简报 | 境内热搜（微博+百度）· 国际要闻 · AI 动态 · 生活（天气/市场/游戏/足球/HN） |
| 主站 | 国际 | en / es / fr / ar / ru 五语种严肃媒体 |
| 主站 | AI | AI 产品 · 每日论文 · 中英文 AI 商业 |
| 主站 | 娱乐 | 抖音热点 · 海外娱乐媒体（Variety / THR / Guardian / BBC） |
| AI 站 | 全部 | AI 产品 · 论文 · 中英文商业 · 芯片算力 |
| AI 站 | 模型 | 大模型发布 / benchmark |
| AI 站 | 芯片 | Nvidia / AMD / TPU / HBM / GPU / 数据中心 |
| AI 站 | 商业 | 融资 / 估值 / 并购 / IPO + FT · Bloomberg · 经济学人 |
| AI 站 | 论文 | HuggingFace 每日论文 + arXiv |
| news 站 | 头条/财经/科技/地区 | 五语种 Google News，按语言走不同通道 |
| game 站 | 本周免费 / 即将开放 / 长期免费 | **同一个 `games` 源**（Epic 一次返回三态），客户端按 `badge.k` 切片 |
| hot 站 | 微博 / 百度 / 抖音 | `weibo` / `baidu` / `douyin`，三个独立上游，一对一 |

> game 站那一行是唯一一个「多 tab 共用一行源」的，展开原因见上文
> 「game 站：为什么三个 tab 只声明一个源」。

### 底层数据源

| 类别 | 数据源 | 说明 |
|---|---|---|
| 境内热搜 | 微博热搜 + 百度热搜 | 主站简报「境内」部分 |
| 国际新闻 | Google News（11 语种分区） | 白名单媒体见 `gnews.js` 的 `GN_SOURCES` |
| 国际新闻 | Hacker News | 主站生活区的技术向内容 |
| 娱乐 | 抖音热点 `v2.xxapi.cn` | 国内娱乐 |
| 天气（看板 + 源） | Open-Meteo | 任意全球城市，支持浏览器定位 |
| 游戏（看板 + 源） | Epic 限免 | 官方 promotions 接口 |
| 市场 | Exchangerate + Binance | 主要货币兑人民币 + BTC/ETH |
| 足球 | OpenLigaDB | 德甲为主，自动回退 |
| 论文 | HuggingFace 每日论文 + arXiv | 前沿 AI 研究 |
| 翻译 | MyMemory | 免费翻译 API 代理（`/api/translate`，**需密钥**） |
| 接口发现 | 内置清单 + publicapis.org | `/api/discover?q=...`（**需密钥**），带英文别名检索 |

### Google News 的语言差异（实测硬伤）

`source:` 过滤在不同语种分区表现完全不一致（2026-10 实测）：

| 语种 | `source:` 过滤 | 结论 |
|---|---|---|
| en / es | 正常，能精确命中本地大媒体 | `strict=true`：写 `source:` + 白名单硬校验 |
| fr / ar | 白名单完全匹配不上，返回 0 条 | `strict=false`：只走本地化关键词 + 垃圾特征闸门 |
| ru | 6 家白名单返回 0 条；单个 `source:Интерфакс` 有效 | 关键词为主，单源补充 |

**结论**：小语种媒体没被完整索引进对应语种分区，死守 `source:` 白名单等于自杀。
所以 `gnews.js` 给每个语种一个 `strict` 开关——质量靠 `isJunkTitle` 闸门兜底，不靠白名单。

## 多语言 & 小语种 & 双语品牌名

界面支持 **19 种语言**（顶部下拉框切换）：

> 简体中文、繁體中文、English、Español、Français、日本語、Português、
> Deutsch、Русский、العربية（RTL）、Tiếng Việt、ภาษาไทย、
> Bahasa Indonesia、Kiswahili、Català、Euskara、Cymraeg、Galego、Esperanto

### 品牌名随语言切换

站名是双轨的：**主名随语言变，副名固定 `InfoStream`**，浏览器标题同步更新。

| 当前语言 | 显示为 | 页面标题 |
|---|---|---|
| 简体中文 | 信息河 InfoStream | 信息河 · InfoStream |
| 繁體中文 | 資訊河 InfoStream | 資訊河 · InfoStream |
| English | **InfoStream 信息河** | InfoStream · 信息河 |
| Español | Flujo de Información · InfoStream | Flujo de Información · InfoStream |
| العربية（RTL） | تيار المعلومات · InfoStream | تيار المعلومات · InfoStream |
| 日本語 | 情報の川 · InfoStream | 情報の川 · InfoStream |

- 中文（简/繁）走「中文在前」，其余语言走「英文在前、中文在后」，
  同时把该语言的本地音译顶到最前（`情報の川`、`تيار المعلومات`、`Flujo de Información`…），
  这样非中文用户一眼认得出，SEO 也能命中各语言的搜索词。
- 本地译名表在 `assets/app.js` 的 `BRAND_ALT`，加语言时顺手加一条即可。
- **繁体自动识别**：浏览器语言是 `zh-TW / zh-HK / zh-MO / zh-Hant` 时首次访问直接进繁体界面，
  不用手动切（三种 URL 写法 `?lang=zh-TW/zh-HK/zh-Hant` 也统一归一到 `zh-Hant`）。

### 每站可选语言不同

| 站点 | 语言数 | 语言集 |
|---|---|---|
| 主站 | 19 | 简中 繁中 英 西 法 日 葡 德 俄 阿 越 泰 印尼 斯瓦希里 加泰 巴斯克 威尔士 加利西亚 世界语 |
| AI 站 | 10 | 简中 繁中 英 西 法 日 葡 德 俄 阿 |
| news 站 | 10 | 英 西 法 阿 俄 简中 繁中 葡 德 日 |
| game 站 | 10 | 简中 繁中 英 西 法 日 葡 德 俄 阿（游戏名多为英文，en 为最佳体验） |
| hot 站 | 10 | 同 AI 站，但**内容本身是中文热搜**——界面可切十语种，卡片标题始终是中文原题 |

语言下拉只列**本站声明且前端真能渲染**的语言（`renderable()` = `LANGS ∩ HOST.langs`），
不会出现「选得到但显示不出」的空选项。

### 其它语言行为

- 阿拉伯语自动切换为从右到左（RTL）排版；主副名用 flex `gap` 排版，方向切换不会错位。
- 切换语言后，若你是**带密钥访问**（`?key=`），非中文界面下会出现 **🌐 翻译** 按钮，
  可将中文 / 英文卡片标题翻译为所选语言（经 `/api/translate` 代理 MyMemory，前端带缓存与并发限制）。
  简繁中文界面不显示该按钮（源内容本就是中文，不需要转）。
- 内容卡片本身来自中文源 + 英文源，因此「翻译」是针对非中/英文用户的增强。
- **访客看不到翻译按钮**：未带密钥时该按钮隐藏，对应接口服务端也返回 403。
- 「发现全球免费接口」区块同理：整块默认 `hidden`，只有带密钥才显示。

## 本地预览（推荐）

```bash
# 在项目根目录 hao-feed/ 下
node build.mjs   # 先构建到 public/
npx wrangler pages dev . --compatibility-date=2024-09-23
# 浏览器打开提示的 http://localhost:8788
```

> `wrangler pages dev .` 会读 `wrangler.toml`，已经配好 `command = "node build.mjs"`，
> 通常会自动构建。手动跑一次 `node build.mjs` 只是为了先看到构建自检结果。

> **测五个站点的不同形态**：本地 host 是 `localhost`，会回落到主站配置。
> 想看子站形态，把 `ai.myinfostream.com` / `news.myinfostream.com` /
> `game.myinfostream.com` / `hot.myinfostream.com` 指到 `127.0.0.1`
> 再带 Host 头访问（curl `-H "Host: ai.myinfostream.com"`）。
> 预览域名一律注入 `noindex`，不会与正式域名争索引。

> **快速看效果（无需 Node）**：直接双击 `index.html`（file://）也能看到完整效果——
> 页面检测到本地无聚合接口时，自动进入「演示模式」，加载内置真实示例数据并循环滚动
> （顶部有黄色提示条）。**部署到 Cloudflare 后自动切换为实时数据**，演示提示条消失。
> 本地演示模式下「发现接口」区块默认隐藏；想看效果可在地址栏加 `?key=demo`
> （本地不校验密钥，只是为了把这块显出来）。
> 若想本地测试真实聚合链路，仍建议用 `wrangler pages dev`（能触发 `functions/`）。

## 部署到 Cloudflare Pages（两种方式）

> **五个正式域名**：`myinfostream.com` / `ai.myinfostream.com` / `news.myinfostream.com`
> / `game.myinfostream.com` / `hot.myinfostream.com`。
> `canonical` 由 `functions/index.js` 按 Host 动态注入，五个域名各自指向自己，互不重复计权。

### 方式 A：Git 关联（推荐，支持自动部署）
1. 把 `hao-feed/` 推到 GitHub / GitLab 仓库。
2. Cloudflare 控制台 → Workers & Pages → Create → Pages → 关联仓库。
3. 构建设置：
   - **Build command** 填 `node build.mjs`
   - **Build output directory** 填 `public`
   - **Root directory** 填 `hao-feed`（若仓库里有一层文件夹）
4. 保存部署，几秒后得到 `*.pages.dev` 域名。

> ⚠️ **不要把 Output directory 填 `.`**（v2.4 修掉的就是这个问题）。
> 填 `.` 会把整个项目目录当静态资源上传，`/functions/_lib/sources.js` 和 `/apitest.mjs`
> 都能被直接下载 —— 源码、接口结构、测试脚本全部对外公开。
> `_routes.json` 里的 `"/*.js"` 只匹配根目录一层，挡不住子目录。

### 方式 B：直接上传（无 Git）
1. 控制台 → Workers & Pages → Create → Pages → 直接上传。
2. 选择 `hao-feed/` 整个文件夹上传即可（`functions/` 会被自动识别为 Pages Functions）。

> **要打成 zip 分发给别人部署，用 `node mkzip.mjs`**（输出到项目上一层的 `hao-feed.zip`）。
> 不要用 PowerShell 的 `Compress-Archive` —— 它写出的条目名用**反斜杠**分隔
> （`assets\app.js`），Windows 自己解压无感，Linux / macOS 解出来是「一个名字里
> 带反斜杠的单个文件」，目录层级整个塌掉，包直接废掉。`mkzip.mjs` 手写 ZIP 结构，
> 条目名强制正斜杠，跨平台可解。

### 绑定五个域名

域名已在 Cloudflare 注册并把 NS 指向了 Cloudflare，接着：

1. 控制台 → Workers & Pages → 你的 Pages 项目 → **Custom domains** → **Set up a custom domain**。
2. 分别加 `myinfostream.com`、`ai.myinfostream.com`、`news.myinfostream.com`、
   `game.myinfostream.com`、`hot.myinfostream.com`（共五个）。
3. 等 DNS 自动签发证书，通常 1 分钟内生效，HTTPS 证书自动签发。

> **加/改域名时要同步改四处**，缺一处都不会报错、只是悄悄失效：
> ① `functions/_lib/hosts.js` 的 `HOSTS`（加站点全量配置，含 `tabs` / `siblings`）、
> ② `MAIN_HOST`（如果动主域名）、
> ③ 其它站的 `siblings` 与主站的 `entries`（**双向**，漏一个方向测试会红）、
> ④ 本 README。
> `index.html` 里不需要改 —— canonical / description / tagline 现在都是运行时注入的。
>
> ② 之后还要在 `app.js` 的 `UI_I18N` 里补齐该站所有 tab / 入口键的十语种文案，
> 漏了不会崩，只会在界面上露出裸 key 名（`tabGameLive` 这种）——`hosttest.mjs` 现在会拦。

### 部署后自检清单

```bash
# ① 五站各自的 canonical / description / 语言是否正确
curl -s https://myinfostream.com/ | grep -o '<link rel="canonical"[^>]*>'
curl -s https://ai.myinfostream.com/ | grep -o '<meta name="description"[^>]*>'
curl -s https://news.myinfostream.com/ | grep -o '<html lang="[^"]*"'
curl -s https://game.myinfostream.com/  | grep -o '<meta name="description"[^>]*>'
curl -s https://hot.myinfostream.com/   | grep -o '<title>[^<]*</title>'

# ② sitemap / robots 是否按站生成
curl -s https://news.myinfostream.com/sitemap.xml | head -5
curl -s https://game.myinfostream.com/robots.txt

# ③ 源码不应该能被下载（应返回 404 或 HTML）
curl -sI https://myinfostream.com/functions/_lib/sources.js | head -1

# ④ ★ 接口层：真调一次，看有没有卡片
node diag.mjs https://myinfostream.com/ 简报
node apitest.mjs                            # 本地直调 handler，五站全 tab 一遍

# ⑤ ★★ 浏览器层：唯一能证明「用户真看到东西」的一步，别跳
node webtest.mjs https://myinfostream.com/
node webtest.mjs https://game.myinfostream.com/
node webtest.mjs https://hot.myinfostream.com/
node gameshot.mjs                          # 游戏站多语种出图，肉眼验三态 tab
```

> ④⑤ 的区别是这次事故的全部教训：**curl 和 apitest 全绿，页面照样是白的。**
> 唯一能证伪「用户看到空白」的是 `webtest.mjs` ——它开真浏览器、逐个tab 点过去、
> 数 DOM 里的卡片数。只有它报 `出 N 条` 才算真的修好了。

## 自定义

- **换/加城市天气**：看板支持任意全球城市（Open-Meteo 地理编码），亦可点 📍 用浏览器定位。
- **切换内容分区**：点顶部 Tab；URL 支持 `?tab=xxx`（tab id 由 `hosts.js` 定义）。
- **加 Tab**：在 `hosts.js` 对应站的 `tabs` 数组加一项（`id` / `i18n` / `sources`），
  在 `sources.js` 的 `SOURCES` 注册对应的源 id，在 `app.js` 的 `UI_I18N` 补该 `i18n` 键的十语种。
- **加站点**：在 `hosts.js` 的 `HOSTS` 加一项（含 `tabs` / `siblings` / `langs`），
  在主站的 `entries` 加入口卡片，并**回其它站的 `siblings` 补上它**（要双向），
  最后在 `app.js` 补 `entryXxx` / `entryXxxDesc` 两个键的十语种。跑 `node hosttest.mjs` 验收。
- **接入更多数据源**：在 `functions/_lib/sources.js` 写一个返回 `card[]` 的函数，
  注册到 `SOURCES`。用 `g()` 工厂写 Google News 源最省事（白名单 + 垃圾闸门都现成）。
- **加翻译支持的语言**：**先**在 `app.js` 的 `LANGS` 加一项（含 `mc` = MyMemory 语言码）并补齐
  `I18N[code]` 全部文案，**再**回 `hosts.js` 对应站的 `langs` 加这个码。顺序反了会出现「幽灵语言」。
- **加内置接口清单**：编辑 `functions/api/discover.js` 里的 `CURATED`（始终可用，离线也返回）。
- **改刷新频率**：`feed.js` 的 `CACHE_TTL`（默认 20s，控制批次间重复度）。

> **「一个 tab 一个源」不是美学偏好，是硬约束**：`fetchBySources` 并发拉取时，
> 多个源 id 若映射到同一个函数，等于自己打自己限流。game 站三个 tab 共用一个 `games` 源
> 就是这个约束的正解（一次上游，客户端切片），详见「game 站：为什么三个 tab 只声明一个源」。

## 已知限制

- **限流是内存实现**，多 isolate 下会失准，只够挡随手刷（详见 v2.2 说明）。
- `/api/feed` 在页面正常工作的前提下无法完全隐藏，只能靠限流 + 同源抬高刷取成本。
- **五站共用一个 Cloudflare Pages 项目**：无法给某个子站单独回滚（要么全发要么不发），
  也无法给子站单独配 WAF 规则（DNS 层可以，Pages 项目层不行）。
- **前端一份 HTML 意味着全站同版本**：任何改动五站同时生效，无法灰度。
- **game 站的「即将开放」依赖 Epic 的预告数据**：Epic 官方偶尔会临时撤下预告，
  那一刻该 tab 会短暂变空（`apitest.mjs` 的切片断言会捕捉到这种情况）。
- **hot 站的内容是中文原生热搜**：界面支持十语种，但微博/百度/抖音的词条本身没有多语种版本，
  非中文用户看到的是中文原题（这与 news 站的 Google News 多语种不同源）。
- **game 站的语言集对非英语用户不完美**：游戏名几乎全是英文原文，界面文案可切十语种但卡片标题不会本地化。
- **Google News 小语种保量靠关键词而非白名单**（fr / ar / ru），质量靠垃圾标题闸门兜底，
  偶尔会混进不够硬的源。
- 足球源依赖 OpenLigaDB 公开接口，部分联赛随赛季可能返回空，自动回退到德甲。
- 市场加密行情依赖 Binance 公共接口，不可达时自动跳过。
- 翻译依赖 MyMemory 免费接口（有每日额度），超限或失败时卡片保留原文。
- 接口发现内置清单始终可用；publicapis.org 实时合并为增强项，**该源实测可能不可达**，不可达时静默降级为纯内置清单。
- 所有数据源均为第三方免费接口，稳定性不保证；单个源失败会被隔离，不影响整条信息河。
- **子站没有独立的 og:image**，五站共用一张 svg，部分平台（尤其 Twitter）不支持 svg 分享图。
- **线上首访某 tab 可能等 10 秒上下**：`webtest.mjs` 偶尔报「AI tab 空白（20s 超时）」，
  已实测定性——同一 URL 直查三次是 `10.2s / 3.4s / 10.2s`，三次都返回 200 与 34 条数据。
  首次请求吃满 `WORST_CASE`（`SOURCE_DEADLINE 8000 + RETRY_DEADLINE 3000`），
  第二次命中边缘缓存就降到 3s 级。**这是边缘缓存冷启动开销，不是数据缺失**，
  也不该靠加超时解决（`budget.js` 顶部写明：超 `WORST_CASE` 该看缓存，不是加预算）。
  真要优化方向是预热/更长的缓存 TTL，而不是动超时预算。

  > `webtest.mjs` 现在把这两类情况**分开报**：单 tab 一轮等满 20s 为空就再点一次重试，
  > 重试后有数据 → 计入 `⚠ 边缘冷启动` 一行（不算失败），重试仍空 → 才报
  > `✗ 重试后仍空白`。这样冷启动不会再冒充回归，而真空白也藏不进「重试成功」里。
  > 另有 `SIM=1 node webtest.mjs` 走本机 `localsim.mjs` 模拟环境，**同一份代码
  > 四个 tab 全绿**，是区分「代码坏了」和「冷启动慢」最直接的对照。
