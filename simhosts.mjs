// simhosts.mjs —— SIM 模式下的假域名 → 127.0.0.1 解析规则（三个出图/端到端脚本共用）
//
// 存在的理由：
//   app.js 的 isLocal() 判的是 hostname。直接打 127.0.0.1 / localhost 会让它
//   切到 demo 演示池，真实取数链路整个被绕过 —— 那样测出来的「全绿」什么也证明不了。
//   所以必须用一个假域名访问，让浏览器认为「这是线上域名」，实际解析到本机。
//
// 为什么五站都要列：
//   只映射 myinfostream.test 的话，localsim 收到的 Host 只有主站，
//   子站形态（game / hot 的三态 tab、分榜对照）在浏览器里根本渲染不出来。
//   漏映射一个域名的症状很隐蔽：脚本不报错，截图出的是主站，只是内容不对。
export const SIM_HOSTS = [
  "myinfostream.test",
  "ai.myinfostream.test",
  "news.myinfostream.test",
  "game.myinfostream.test",
  "hot.myinfostream.test",
];

// 每个域名一条独立的 MAP 规则，用逗号分隔。
// 注意：写成 `MAP a b c 127.0.0.1`（一次列多个）不会被解析成多个域名，
// 实测直接 ERR_NAME_NOT_RESOLVED —— 症状是「脚本不报错，只是域名解析不了」。
export const SIM_RULE = SIM_HOSTS.map((h) => `MAP ${h} 127.0.0.1`).join(", ");

// --no-proxy-server 不能省。
//   这台机器的环境里有 HTTP_PROXY / HTTPS_PROXY（127.0.0.1:59005）且没有 NO_PROXY，
//   Chromium 会照单全收，把 *.myinfostream.test 的请求也发给那个代理。代理当然解析不了
//   这五个假域名，于是回 502 —— 症状是「脚本时好时坏，有时整页 body 是空的」，
//   像是页面自己崩了，实际一个请求都没打到本机。
//   更坑的是它间歇性失败：代理进程在就在通、不在就 502，跑十次里可能只错一次，
//   很容易被当成随机抖动忽略掉，然后某天 CI/回归突然集体变红。
//   假域名的语义就是「必须解析到本机」，走任何中转都会破坏这个前提，所以直接禁掉。
//   （localsim 里的上游 fetch 不受影响：Node 原生 fetch 不读 HTTP_PROXY 环境变量。）
export const simArgs = () => [
  `--host-resolver-rules=${SIM_RULE}`,
  "--no-proxy-server",
];

// 各站在 SIM 模式下的入口。
// label 用短名："main" / "ai" / "news" / "game" / "hot"。
export const simURL = (label = "main", port = 8788) =>
  label === "main"
    ? `http://myinfostream.test:${port}/`
    : `http://${label}.myinfostream.test:${port}/`;