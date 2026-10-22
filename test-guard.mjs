// _guard.js 的限流分桶回归测试（不依赖浏览器，直接打模块）
//
// 为什么要单独测：
//   429 修完之后最怕的是「把桶一拆，限流就没了」—— 那等于给上游开了个口子。
//   这里直接对 guard() 连打，确认两个桶各自的阈值、隔离性和跨站拦截都还在。
//   注意 IP 不是 guard 的入参，而是从 CF-Connecting-IP 头读的，所以测试
//   必须换请求头而不是换参数，否则「换个 IP 模拟新访客」这一段测的是假的。
//
// 用法：node test-guard.mjs

import { guard } from "./functions/api/_guard.js";

/** 造一个最小 Request：guard 只看 url / headers / method */
function req(ip, origin = "https://myinfostream.com") {
  return new Request("https://myinfostream.com/api/feed?tab=brief&lang=zh", {
    headers: { "CF-Connecting-IP": ip, Origin: origin },
  });
}

// RFC 5737 文档保留段，编出来的 IP 不会撞真实用户
const IP_A = "203.0.113.7";
const IP_B = "198.51.100.23";
const env = {}; // 走默认配置：feedLimit=30 / hitLimit=120

let fails = 0;
function check(label, got, want) {
  const ok = String(got) === String(want);
  if (!ok) fails++;
  console.log(`${ok ? "✓" : "✗"} ${label}: 期望 ${want}，实际 ${got}`);
}

/** 连打 n 次，返回放行次数（guard 返回 null = 放行） */
function burst(ip, n, opt) {
  let pass = 0;
  for (let i = 0; i < n; i++) {
    if (!guard(req(ip), Object.assign({ private: false, label: "feed", env }, opt))) pass++;
  }
  return pass;
}

// ---- 1) 缓存命中桶：120/分 ----
check("命中桶 130 次里的放行数", burst(IP_A, 130, { cacheHit: true }), 120);

// ---- 2) 真抓取桶：30/分 ----
check("抓取桶 40 次里的放行数", burst(IP_B, 40), 30);

// ---- 3) 两桶互不干扰 ----
// IP_B 的抓取桶已经打满（40 次用掉 30），命中桶应当仍是满血 120 ——
// 这正是这次修复的核心：抓取配额耗尽不该牵连到只读缓存的浏览行为。
check("抓取桶打满后命中桶放行数", burst(IP_B, 130, { cacheHit: true }), 120);

// 反向也测一下：命中桶打满不该反过来卡住抓取桶。
const IP_C = "192.0.2.33";
burst(IP_C, 130, { cacheHit: true });          // 先把命中桶打满
check("命中桶打满后抓取桶放行数", burst(IP_C, 40), 30);

// ---- 4) 跨站盗用在命中路径上照样 403 ----
// 桶拆了不代表门也拆了：限源校验与命中与否无关，始终生效。
// 构造方式要注意 —— 请求 URL 指向本站、Origin 头指向外站，才是「盗用」；
// 要是把 URL 也改成外站，Origin 和 host 自然相等，反而测成了同源放行。
const cross = guard(req("192.0.2.88", "https://evil.example"), {
  private: false, label: "feed", env, cacheHit: true,
});
check("跨站盗用（命中路径）状态码", cross && cross.status, 403);

// ---- 5) 私密端点的鉴权逻辑没被这次改动碰坏 ----
// discover/translate 走 private:true 且 opt.cacheHit 不传，应该仍走原桶。
const priv = guard(req("192.0.2.99"), { private: true, label: "discover", env });
check("私密端点未带密钥状态码", priv && priv.status, 403); // 未配 API_SECRET → disabled

console.log(fails ? `\n✗ ${fails} 项未通过` : "\n✓ 限流分桶全部符合预期");
process.exit(fails ? 1 : 0);