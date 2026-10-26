// diag-edge.mjs —— 对比「本地网络」与「CF 边缘」对同一 tab 的取数结果
import { onRequest as feed } from "./functions/api/feed.js";
const req = (host, qs) => new Request(`https://${host}/api/feed?${qs}`, {
  headers: { host, origin: `https://${host}` },
});
const CASES = [
  ["myinfostream.com", "world", "zh"],
  ["myinfostream.com", "fun", "zh"],
  ["myinfostream.com", "ai", "zh"],
  ["myinfostream.com", "brief", "zh"],
];
for (const [host, tab, lang] of CASES) {
  const t0 = Date.now();
  try {
    const res = await feed({ request: req(host, `tab=${tab}&lang=${lang}`), env: {} });
    const b = await res.json();
    const c = {};
    for (const x of (b.items || [])) c[x.source] = (c[x.source] || 0) + 1;
    console.log(`[LOCAL] ${host} ${tab}: n=${(b.items||[]).length} stale=${b.stale} ${Date.now()-t0}ms | ${JSON.stringify(c)}`);
  } catch (e) {
    console.log(`[LOCAL] ${host} ${tab}: THROW ${String(e).slice(0,160)}`);
  }
}
