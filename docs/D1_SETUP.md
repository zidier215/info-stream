# Cloudflare D1 边缘持久化数据库与 AI 论文专区接入指南

本工程已完整实现 **AI 论文档案专区与 Cloudflare D1 持久化存储体系**：
- **无感平滑回退**：即使尚未创建 D1 实例，系统内置的 50 篇深度精选种子数据（2026-10-25 至 2026-11-01）仍支持前端即时秒开、图表统计、搜索与分类。
- **D1 原生绑定**：在 Cloudflare 控制台完成 D1 绑定后，系统将自动无缝升级至边缘关系型数据库查询，并支持每日全自动增量录入与同步。

---

## 步骤 1：在 Cloudflare 控制台创建 D1 数据库

1. 登录 [Cloudflare 控制台](https://dash.cloudflare.com/)；
2. 点击左侧导航栏 **存储和数据库 (Storage & Databases)** -> **D1**；
3. 点击 **创建数据库 (Create database)**，命名为 `infostream-db`；
4. 点击 **创建 (Create)**。

---

## 步骤 2：在 Pages 项目中添加 D1 绑定

1. 在左侧菜单点击 **Workers 和 Pages (Workers & Pages)** -> 选择你的项目 `info-stream`；
2. 点击顶部 **设置 (Settings)** -> 选择 **函数 (Functions)**；
3. 滚动到页面下方的 **D1 数据库绑定 (D1 database bindings)**；
4. 点击 **添加绑定 (Add binding)**：
   - **变量名称 (Variable name)**：填写 `DB`（大写）
   - **D1 数据库 (D1 database)**：下拉选择刚才创建的 `infostream-db`
5. 点击 **保存 (Save)**。

---

## 步骤 3：初始化数据库表结构与种子数据

您可以通过以下两种简单方式中的任意一种初始化数据库：

### 方式 A：在 Cloudflare 控制台控制台运行 SQL（最直观）
在 Cloudflare D1 控制台进入 `infostream-db` -> 点击 **控制台 (Console)**，将项目中的 [`data/schema.sql`](file:///d:/google-anti/info-feed/data/schema.sql) 文件内容粘贴进去，点击 **运行 (Execute)** 即可一键完成表结构创建与 50 篇种子数据导入！

### 方式 B：通过 API 一键初始化
在绑定好 `DB` 后，直接向部署域名发起一次 POST 请求：
```bash
curl -X POST "https://ai.myinfostream.com/api/papers?action=init_seed"
```
响应将返回：
```json
{
  "success": true,
  "count": 50,
  "message": "D1 database initialized with seed papers"
}
```

---

## 步骤 4：全自动增量同步最新 AI 论文

### 手动触发同步：
```bash
curl -X POST "https://ai.myinfostream.com/api/papers?action=sync"
```
边缘函数会自动从 Hugging Face Daily Papers 与 arXiv (cs.AI / cs.LG) 抓取当天最新的热门研究论文，解析并写入 D1 数据库（自动去重 `INSERT OR IGNORE`），持久化保存为历史记录！

### 定时全自动同步（Cron Trigger）：
在 Cloudflare 控制台配置 Scheduled Worker 或使用 GitHub Actions 每天定时触发一次该 URL，即可实现 365 天全自动无人值守每日归档。

