# 网站出海、Google AdSense 合规、站群矩阵与线上全景审计 SOP

```
核心审计原则：
1. 严禁只看本地代码静态通过，一切以【生产环境线上真实 HTTP 响应】为准；
2. 严禁拿自己写的检查脚本做“自闭环自嗨”（避免测试规则自身的认知盲区）；
3. 站在【Googlebot 爬虫】和【AdSense 人工审核员】的双重视角做端到端验收；
4. 跨站矩阵双向注权：打通已认证母站（calcguide.tech）、技术评测站（techminds.cn）、信息流主站（myinfostream.com）与 GitHub 权威主页的生态闭环。
```

---

## 阶段一：五层金字塔全景审计清单（Checklist）

### 第一层：生产网络与边缘路由层（最隐蔽、最致命的技术硬伤）
| 检查项 | 致命隐患（常见翻车点） | 标准验收指标 | 快速探测命令 |
| :--- | :--- | :--- | :--- |
| **1. 404 真实状态码 (Anti Soft-404)** | 缺 `404.html`，CDN 默认返回 `200 OK + 首页`（**Soft-404 软 404**，极度消耗爬虫配额，直接判低质） | 任意乱拼路径**必须返回真实 HTTP 404**，页面与响应头带 `noindex, nofollow` | `curl -I https://domain.com/non-existent-test-xyz` |
| **2. Clean URL 与 Canonical 冲突** | CDN（如 Cloudflare Pages）默认 308 重定向到无后缀路径，但页面 `canonical` 仍写 `.html` | 规范标签（Canonical）必须与**最终提供 200 服务的干净 URL**保持绝对一致 | 查看 HTML 中的 `<link rel="canonical">` |
| **3. 首页规范化** | 首页规范 URL 写成 `https://domain.com/index.html` | 首页规范 URL 必须指向根域：`https://domain.com/` | 查看首页 `<link rel="canonical">` 与 `<meta property="og:url">` |
| **4. 边缘缓存与安全标头** | `_headers` 规则写了 `/*.html`，在 Clean URL 模式下**从未命中**；缺少基础安全响应头 | 缓存规则匹配 Clean URL / 静态资产（`/assets/*` 开启 `immutable`）；全站具备 `nosniff`、`SAMEORIGIN`、`strict-origin-when-cross-origin` | `curl -I https://domain.com/about` |
| **5. 部署配置断层** | `wrangler.toml` 项目名与生产不一致；非 Git 目录下部署缺 `--branch main` 静默发布到 Preview | 项目名匹配；CI/脚本显式声明生产分支（`--branch main` / `production`） | 部署后比对线上真实响应是否切到最新 |

---

### 第二层：AdSense 与搜索引擎准入层（审核一票否决项）
| 检查项 | 致命隐患（常见翻车点） | 标准验收指标 |
| :--- | :--- | :--- |
| **1. AdSense 双重验证部署** | 仅放了异步 `<script>` 却漏掉 `<meta name="google-adsense-account">`，或独立合规页未部署 | 全局 `<head>` 同时具备 `<meta name="google-adsense-account" content="ca-pub-1130777358854864">` 与官方异步 `adsbygoogle.js` 脚本 |
| **2. `ads.txt` 权威性** | 根目录缺失；或 Apex 裸域与 `www` 子域返回不一致 | 根目录可直接访问，`Content-Type: text/plain`，纯文本返回直接发布商代码：<br>`google.com, pub-1130777358854864, DIRECT, f08c47fec0942fa0` |
| **3. GDPR / Cookie 隐私政策** | 无隐私页面；或未明确披露 Google AdSense / DoubleClick 追踪 Cookie | 具备独立 `/privacy` 页面与首页弹窗，声明第三方广告 Cookie（DoubleClick）、提供用户退出机制（`adssettings.google.com` 与 `www.aboutads.info`） |
| **4. `sitemap.xml` 纯净度** | 脚本用 `glob("*.html")` 把 `404.html` 写进站点地图；或地图条目含 `.html` 308 跳转地址、重复项 | Sitemap 单一事实源生成，仅包含合规的 200 Clean URL 页面；**0 重复、0 死链、0 `.html` 后缀** |
| **5. `robots.txt` 抓取权限** | 误设 `Disallow: /` 拦截了 `Mediapartners-Google` 或 `Googlebot` | 显式放行 `Mediapartners-Google` 与 `Googlebot`，并指引 `Sitemap: https://domain.com/sitemap.xml` |

---

### 第三层：E-E-A-T 实体信任、法律基石与跨站矩阵（人工审核高分核心）
| 检查项 | 致命隐患（常见翻车点） | 标准验收指标 |
| :--- | :--- | :--- |
| **1. 信任五基石页面与模态窗** | 缺少关于、编辑准则、隐私、条款或联系页；或模态窗缺少对应标签页面板导致空白 | 全站页脚与合规模态窗完整打通 5 大落地页：<br>`About · Editorial · Privacy · Terms · Contact` |
| **2. 官方统一联络邮箱** | 页面或 JSON-LD 中混杂不一致的临时私人邮箱 | 全站及合规页统一公示官方联络信箱（如 `contact@myinfostream.com` / `editorial@myinfostream.com`） |
| **3. Schema.org 结构化数据** | 缺少结构化数据，或将网站品牌填入 `Person` Schema | 首页内嵌标准 `WebSite` + `Organization` JSON-LD，并通过 `sameAs` 关联 GitHub 与姐妹站点实体矩阵 |
| **4. 跨站生态矩阵 (Sister Publications)** | 新站孤立无援，缺乏高信誉域名反链与生态背书 | 在 `/about` 与页脚建立 **Network & Sister Publications**，与已通过 AdSense 认证的 `calcguide.tech`、`techminds.cn`、`zidier215.github.io` 及 GitHub Profile 形成双向认证闭环 |

---

### 第四层：目标用户可用性与体验交互
| 检查项 | 致命隐患（常见翻车点） | 标准验收指标 |
| :--- | :--- | :--- |
| **1. Google Analytics 4** | 遗留未配置的占位符测量 ID 或合规落地页漏装 | 全站及合规页统一部署正式有效的 GA4 测量代码（`G-JBQYPMLVHR`） |
| **2. 全站零死链与零坏图** | 静态产物中引用不存在的内部路径或未提交的本地图片 | `build.mjs` 构建阶段自动扫描 `public/*.html` 内部 `href`/`src`，100% 可达 |
| **3. 深浅色主题全组件适配** | 启用 Dark Mode 后，卡片、看板或页脚仍硬编码 `#ffffff` 白底导致浅色文字不可见 | 所有容器统一使用 CSS 变量（`var(--card)`、`var(--bg2)`、`var(--text)`），深浅模式对比度均清晰舒适 |

---

### 第五层：多站点垂直专注度与无限流性能（InfoStream 核心护城河）
| 检查项 | 规范与判定标准 |
| :--- | :--- |
| **1. 五大站点精准分流** | 主站（`myinfostream.com`）与四大垂类子站（`ai` / `news` / `game` / `hot`）通过边缘 Host 路由返回准确的 `X-InfoStream-Site` 标识与独立 Canonical/Sitemap |
| **2. 首屏 0ms 秒开快照** | 边缘函数自动内联 `window.__INITIAL_DATA__` 预取快照，首屏无需等待客户端二次请求即可直出内容 |
| **3. 无限流真实翻页** | `/api/feed` 接口支持连续翻页（`hasMore=true`），第 1 页与第 2 页内容严格去重差异化 |

---

## 🛠️ 实战工程经验与跨站矩阵架构 (Engineering Lessons)

### 1. 站群跨站矩阵与反链协同注权 (Cross-Site Link Matrix)
```text
[GitHub Profile (zidier215)] ──(Top Authority)──> [InfoStream (myinfostream.com)]
               │                                                ▲
               ▼                                                │
[GitHub Pages (zidier215.github.io)] ──(Developer Context)──────┤
               │                                                │
               ▼                                                ▼
[CalcGuide (calcguide.tech - AdSense Certified)] <──> [TechMinds (techminds.cn)]
```
- **借力已认证母站**：将站点与已通过 AdSense 认证的 `calcguide.tech`、`techminds.cn` 以及 GitHub 权威主页建立双向回链与 Schema `sameAs` 声明，显著提升域名初始信任度（Domain Trust）。
- **母站与姐妹站反向闭环**：在 `/about` 页面与全局页脚设立“生态网络与姐妹站点 (Network & Sister Publications)”，向搜索引擎与审核员展示透明合规的产品矩阵。

### 2. 一键构建、部署与全景审计指令
```powershell
# PowerShell 一键构建、部署至 Cloudflare Pages 生产环境并执行 69 项线上真实 HTTP 审计
powershell -ExecutionPolicy Bypass -File .\run.ps1 -SkipPrefetch -Audit
```
```bash
# 或手动分步执行：
node build.mjs
node live_audit.mjs
```
