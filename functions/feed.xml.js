// functions/feed.xml.js
// ---------------------------------------------------------------------------
// 信息河 (InfoStream) 官方标准 RSS 2.0 聚合订阅源处理
// 响应 /feed.xml 与 /rss.xml
// 支持边缘自动汇聚各垂直站精选与长青树数据库最新内容，配置边缘缓存，零服务成本
// ---------------------------------------------------------------------------

import { resolveHost, MAIN_HOST, HOSTS } from "./_lib/hosts.js";
import { PAPERS_SEED } from "./_lib/papers_seed.js";
import { MODELS_SEED } from "./_lib/models_seed.js";
import { GAMES_SEED } from "./_lib/games_seed.js";
import { TRENDS_SEED } from "./_lib/trends_seed.js";
import { WEALTH_SEED } from "./_lib/wealth_seed.js";
import { OPENSOURCE_SEED } from "./_lib/opensource_seed.js";
import { escapeXml } from "./_lib/util.js";

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const { cfg } = resolveHost(request);
  const hostCfg = cfg || HOSTS[MAIN_HOST];

  const cat = url.searchParams.get("cat") || "all";
  const now = new Date();
  const buildDate = now.toUTCString();

  const items = [];

  // 1. AI 论文周刊精选
  if (cat === "all" || cat === "ai" || cat === "papers") {
    (PAPERS_SEED || []).slice(0, 10).forEach((p, idx) => {
      const pubDate = p.pub_date ? new Date(p.pub_date + "T08:00:00Z").toUTCString() : buildDate;
      items.push({
        title: `[AI论文] ${p.title}`,
        link: p.url || `https://ai.myinfostream.com/papers`,
        description: `【来源：${escapeXml(p.source)}】${escapeXml(p.summary || p.orig_title || "")}`,
        pubDate: pubDate,
        guid: `infostream-paper-${p.id || idx}`,
        category: "AI 论文周刊",
      });
    });
  }

  // 2. 里程碑大模型发布
  if (cat === "all" || cat === "ai" || cat === "models") {
    (MODELS_SEED || []).slice(0, 8).forEach((m, idx) => {
      const pubDate = m.release_date ? new Date(m.release_date + "T08:00:00Z").toUTCString() : buildDate;
      items.push({
        title: `[大模型编年史] ${m.name} (${m.org}) 发布`,
        link: m.report_url || `https://ai.myinfostream.com/models`,
        description: `【机构：${escapeXml(m.org)}】LMSYS ELO: ${m.arena_elo || "评测中"}，上下文: ${m.context_window} Tokens。${escapeXml(m.description || "")}`,
        pubDate: pubDate,
        guid: `infostream-model-${m.id || idx}`,
        category: "大模型演进",
      });
    });
  }

  // 3. Epic 喜加一经典限免福利
  if (cat === "all" || cat === "games") {
    (GAMES_SEED || []).slice(0, 8).forEach((g, idx) => {
      const pubDate = g.giveaway_start ? new Date(g.giveaway_start + "T08:00:00Z").toUTCString() : buildDate;
      items.push({
        title: `[游戏福利] Epic 喜加一：${g.title}`,
        link: g.epic_url || `https://game.myinfostream.com/history`,
        description: `【限免福利】原价 $${g.price_usd} (${g.price_cny ? '¥' + g.price_cny : '免费'})。赠送周期：${g.giveaway_start} 至 ${g.giveaway_end}。${escapeXml(g.brief || g.description || "")}`,
        pubDate: pubDate,
        guid: `infostream-game-${g.id || idx}`,
        category: "Epic 喜加一",
      });
    });
  }

  // 4. 互联网破圈大事件
  if (cat === "all" || cat === "trends") {
    (TRENDS_SEED || []).slice(0, 8).forEach((t, idx) => {
      const pubDate = t.date ? new Date(t.date + "T08:00:00Z").toUTCString() : buildDate;
      items.push({
        title: `[破圈大事件] ${t.title}`,
        link: t.ref_url || `https://hot.myinfostream.com/history`,
        description: `【峰值热度：${escapeXml(t.peak_heat_display || "")}】${escapeXml(t.summary || "")}`,
        pubDate: pubDate,
        guid: `infostream-trend-${t.id || idx}`,
        category: "破圈大事件",
      });
    });
  }

  // 5. 开源与商业变现通鉴
  if (cat === "all" || cat === "opensource") {
    (OPENSOURCE_SEED || []).slice(0, 6).forEach((o, idx) => {
      items.push({
        title: `[开源替代] ${o.name_cn}：高质量开源自建替代方案`,
        link: `https://myinfostream.com/opensource#${o.id}`,
        description: `原商业版：${escapeXml(o.pricing_desc)}，年省约 $${o.estimated_yearly_saving_usd}。传统痛点：${escapeXml(o.pain_points)}`,
        pubDate: buildDate,
        guid: `infostream-oss-${o.id || idx}`,
        category: "开源与AI替代",
      });
    });
  }

  // 生成 RSS XML 字符串
  const itemsXml = items.map((i) => `
    <item>
      <title><![CDATA[${i.title}]]></title>
      <link>${i.link}</link>
      <guid isPermaLink="false">${i.guid}</guid>
      <category><![CDATA[${i.category}]]></category>
      <pubDate>${i.pubDate}</pubDate>
      <description><![CDATA[${i.description}]]></description>
    </item>
  `).join("");

  const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title><![CDATA[信息河 · InfoStream 精选订阅源]]></title>
    <link>https://${hostCfg.host}/</link>
    <description><![CDATA[汇聚全球科技要闻、AI 论文周刊、大模型编年史、Epic 喜加一福利与长青商业智库]]></description>
    <language>zh-CN</language>
    <lastBuildDate>${buildDate}</lastBuildDate>
    <atom:link href="https://${hostCfg.host}/feed.xml" rel="self" type="application/rss+xml"/>
    ${itemsXml}
  </channel>
</rss>`;

  return new Response(rssXml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-InfoStream-Site": hostCfg.key,
    },
  });
}

