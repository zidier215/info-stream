// functions/_lib/page.js
// ---------------------------------------------------------------------------
// HTML 外壳改写工具 —— 被 functions/index.js 使用。
//
// 静态 index.html 是一份「主站模板」，三个域名共用同一份文件。
// 服务端按 Host 把它改写成对应站点形态，注入三样东西：
//   1. <title> / description / og / twitter —— 每站独立，避免三站互相抢权重
//   2. window.__HOST_CONFIG__ —— 前端读它决定渲染 portal 还是 topic 模式
//   3. canonical / robots —— 预览域名自动 noindex，避免 pages.dev 与正式域重复计权
//
// 用正则做替换而不是 DOMParser：Workers 没有 DOM，
// 而且这里只改 <head> 里的固定标签，正则足够可控。
// ---------------------------------------------------------------------------

import { escapeXml } from "./util.js";

/**
 * 替换 <head> 里的 <title>。</head> 里恰好一个。
 * 用函数式 replace 是为了避免 $& / $1 这类替换串被内容里的字符二次解释。
 */
function setTitle(html, title) {
  return html.replace(/<title>[\s\S]*?<\/title>/i, () => `<title>${escapeXml(title)}</title>`);
}

/** 替换或插入 <meta name="description"> */
function setMeta(html, attr, key, content) {
  const re = new RegExp(`<meta\\s+${attr}="${key}"[^>]*>`, "i");
  const tag = `<meta ${attr}="${key}" content="${escapeXml(content)}">`;
  if (re.test(html)) return html.replace(re, () => tag);
  return html.replace(/<\/head>/i, () => `  ${tag}\n</head>`);
}

/** 替换或插入 <link rel="...">（canonical / alternate） */
function setLink(html, rel, href) {
  const re = new RegExp(`<link\\s+rel="${rel}"[^>]*>`, "i");
  const tag = `<link rel="${rel}" href="${escapeXml(href)}">`;
  if (re.test(html)) return html.replace(re, () => tag);
  return html.replace(/<\/head>/i, () => `  ${tag}\n</head>`);
}

/** 删掉所有已有的 <meta name="robots">，避免模板里残留的与新值冲突 */
function dropRobots(html) {
  return html.replace(/<meta\s+name="robots"[^>]*>\s*/gi, "");
}

/**
 * 把站点配置序列化进页面。
 * 必须 JSON.stringify 后再做一次 </script> 转义，否则配置里任何 "</script>"
 * 都会提前闭合脚本块（XSS 注入面）。这里也顺手挡掉 U+2028/2029 —— 它们在
 * JSON 里合法，但在 JS 字符串字面量里是非法换行符。
 */
function configScript(cfg) {
  const json = JSON.stringify(cfg, null, 2)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
  return `<script>window.__HOST_CONFIG__ = ${json};</script>`;
}

/**
 * 生成改写后的 HTML。
 *
 * @param {string} html    原始 index.html
 * @param {object} hostCfg hosts.js 里的站点配置
 * @param {object} opt     { canonical, isPreview, siblings }
 */
export function renderHostHTML(html, hostCfg, opt = {}) {
  const canonical = opt.canonical || `https://${hostCfg.host}/`;
  const isPreview = !!opt.isPreview;

  // 界面语言用站点默认语言决定标题/描述；en 用 titleEn/descEn
  const en = hostCfg.defaultLang === "en";
  const title = en
    ? `${hostCfg.titleEn} · InfoStream`
    : `${hostCfg.title} · InfoStream`;
  const desc = en ? hostCfg.descEn : hostCfg.desc;

  let out = setTitle(html, title);
  out = setMeta(out, "name", "description", desc);
  out = setMeta(out, "property", "og:site_name", en ? hostCfg.titleEn : hostCfg.title);
  out = setMeta(out, "property", "og:title", title);
  out = setMeta(out, "property", "og:description", desc);
  out = setMeta(out, "property", "og:url", canonical);
  out = setMeta(out, "property", "og:type", "website");
  // og:image 用本域的绝对地址。模板里写死的 myinfostream.com 会在 ai/news
  // 站上造成「分享出去的卡片图链接指向主站」，社交平台会据此判归属。
  out = setMeta(out, "property", "og:image", `https://${hostCfg.host}/favicon.svg`);
  out = setMeta(out, "name", "twitter:title", title);
  out = setMeta(out, "name", "twitter:description", desc);
  out = setLink(out, "canonical", canonical);

  // html lang 属性跟着站点默认语言走
  out = out.replace(/<html\s+lang="[^"]*"/i, () => `<html lang="${escapeXml(hostCfg.defaultLang)}"`);

  // robots：预览域名严格 noindex，正式域名放开并指向 sitemap
  out = dropRobots(out);
  const robots = isPreview
    ? "noindex, nofollow"
    : "index, follow, max-image-preview:large";
  out = setMeta(out, "name", "robots", robots);
  if (!isPreview) {
    out = setLink(out, "sitemap", `https://${hostCfg.host}/sitemap.xml`);
  }

  // 注入配置。放在 </head> 前，前端 script 加载时它一定已执行。
  const cfgPayload = {
    key: hostCfg.key,
    host: hostCfg.host,
    title: hostCfg.title,
    titleEn: hostCfg.titleEn,
    tagline: hostCfg.tagline || "",
    taglineEn: hostCfg.taglineEn || hostCfg.tagline || "",
    desc,
    defaultLang: hostCfg.defaultLang,
    langs: hostCfg.langs,
    tabs: (hostCfg.tabs || []).map((t) => ({
      id: t.id, i18n: t.i18n, sources: t.sources || [],
    })),
    entries: hostCfg.entries || [],
    siblings: hostCfg.siblings || [],
    isMain: !!hostCfg.isMain,
    mode: hostCfg.isMain ? "portal" : "topic",
    preview: isPreview,
    canonical,
  };
  out = out.replace(/<\/head>/i, () => `  ${configScript(cfgPayload)}\n</head>`);

  // E-E-A-T 实体信任：注入官方 WebSite 与 Organization 结构化数据 (JSON-LD)
  const schemaPayload = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": `${hostCfg.title} · ${hostCfg.titleEn}`,
    "url": canonical,
    "description": desc,
    "publisher": {
      "@type": "Organization",
      "name": hostCfg.title,
      "alternateName": hostCfg.titleEn,
      "url": canonical,
      "logo": `https://${hostCfg.host}/favicon.svg`,
      "sameAs": [
        "https://github.com/zidier215",
        "https://github.com/zidier215/info-stream",
        "https://calcguide.tech",
        "https://techminds.cn",
        "https://zidier215.github.io"
      ],
      "contactPoint": {
        "@type": "ContactPoint",
        "email": "contact@myinfostream.com",
        "contactType": "customer service"
      }
    }
  };
  const schemaStr = JSON.stringify(schemaPayload, null, 2)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e");
  if (/<script type="application\/ld\+json">[\s\S]*?<\/script>/i.test(out)) {
    out = out.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/i, `<script type="application/ld+json">\n${schemaStr}\n  </script>`);
  } else {
    out = out.replace(/<\/head>/i, () => `  <script type="application/ld+json">\n${schemaStr}\n  </script>\n</head>`);
  }

  // 首屏 0 毫秒秒开：若服务端取到了静态快照，直接内联注入 window.__INITIAL_DATA__
  if (opt.initialFeed && Array.isArray(opt.initialFeed.items) && opt.initialFeed.items.length) {
    const feedJson = JSON.stringify(opt.initialFeed)
      .replace(/</g, "\\u003c")
      .replace(/>/g, "\\u003e")
      .replace(/\u2028/g, "\\u2028")
      .replace(/\u2029/g, "\\u2029");
    out = out.replace(/<\/head>/i, () => `  <script>window.__INITIAL_DATA__ = ${feedJson};</script>\n</head>`);
  }

  // 兄弟站点互链（页脚用），也让搜索引擎发现这是同一实体的三个子站
  for (const sib of hostCfg.siblings || []) {
    out = out.replace(/<\/head>/i, () =>
      `  <link rel="alternate" hreflang="x-sibling" href="https://${sib}/">\n</head>`);
  }

  return out;
}