// 直接调用 Pages Functions handler，验证守卫行为（不依赖 wrangler）
// 路径用 import.meta.url 相对解析：写死绝对路径换台机器就直接跑不起来。
const base = new URL("./functions/api/", import.meta.url).href;
const feed = (await import(base + 'feed.js')).onRequest;
const discover = (await import(base + 'discover.js')).onRequest;
const translate = (await import(base + 'translate.js')).onRequest;

function req(path, { origin, key, ip } = {}) {
  const h = new Headers();
  if (origin) h.set('Origin', origin);
  if (key) h.set('x-api-secret', key);
  h.set('CF-Connecting-IP', ip || '1.2.3.4');
  return new Request('https://example.pages.dev' + path, { headers: h });
}

async function show(title, p) {
  const r = await p;
  let body = '';
  try { const j = await r.json(); body = JSON.stringify(j).slice(0, 90); } catch { body = '(non-json)'; }
  console.log(String(title).padEnd(46), '→', r.status, body);
  return r;
}

console.log('=== A. 未配置 API_SECRET（默认状态）===');
await show('feed 无 Origin（正常访问）', feed({ request: req('/api/feed?cat=all'), env: {} }));
await show('discover 无密钥', discover({ request: req('/api/discover?q=weather'), env: {} }));
await show('translate 无密钥', translate({ request: req('/api/translate?q=hi&to=en'), env: {} }));

console.log('\n=== B. 跨站盗用（带非同源 Origin）===');
await show('feed Origin=https://evil.com', feed({ request: req('/api/feed?cat=all', { origin: 'https://evil.com' }), env: {} }));
await show('feed Origin=同源（应放行）', feed({ request: req('/api/feed?cat=all', { origin: 'https://example.pages.dev' }), env: {} }));

console.log('\n=== C. 配置了密钥 API_SECRET=secret123 ===');
const env = { API_SECRET: 'secret123' };
await show('discover 带对密钥（头）', discover({ request: req('/api/discover?q=weather', { key: 'secret123' }), env }));
await show('discover 带对密钥（?key=）', discover({ request: req('/api/discover?q=weather&key=secret123'), env }));
await show('discover 密钥错误', discover({ request: req('/api/discover?q=weather', { key: 'wrong' }), env }));
await show('translate 带对密钥', translate({ request: req('/api/translate?q=hello&to=es', { key: 'secret123' }), env }));

console.log('\n=== D. 限流（FEED_LIMIT=3，同一 IP 连打 6 次）===');
const lim = { FEED_LIMIT: '3' };
for (let i = 1; i <= 6; i++) {
  const r = await feed({ request: req('/api/feed?cat=all', { ip: '9.9.9.9' }), env: lim });
  console.log(`  第${i}次 →`, r.status);
}

console.log('\n=== E. ALLOW_NO_ORIGIN=1 时 curl 可用 ===');
await show('feed 跨源 Origin + ALLOW_NO_ORIGIN', feed({ request: req('/api/feed?cat=all', { origin: 'https://evil.com' }), env: { ALLOW_NO_ORIGIN: '1' } }));

console.log('\n=== F. discover 检索命中（英文/中文都应命中）===');
// 换一个 IP：限流是按 IP 记忆滑窗的，前面 A~E 已把 1.2.3.4 用满
for (const q of ['', 'weather', '汇率', 'anime', 'free weather api', '翻译']) {
  const r = await discover({ request: req(`/api/discover?q=${encodeURIComponent(q)}`, { key: 'secret123', ip: '7.7.7.7' }), env });
  const j = await r.json();
  console.log(`  q="${q}"`.padEnd(30), '→', r.status, 'count=' + j.count, (j.items || []).slice(0, 2).map((i) => i.name).join(', '));
}

console.log('\n=== G. 响应头不应再有 CORS 通配 ===');
const r = await feed({ request: req('/api/feed?cat=all'), env: {} });
console.log('  Access-Control-Allow-Origin =', JSON.stringify(r.headers.get('access-control-allow-origin')));
console.log('  Cache-Control              =', JSON.stringify(r.headers.get('cache-control')));