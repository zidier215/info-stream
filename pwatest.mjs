// pwatest.mjs —— PWA Manifest 与 Service Worker 自动化测试套件
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

console.log("=== 1. 测试 Web App Manifest 完整性 ===");
const manifestPath = "./manifest.webmanifest";
assert.ok(existsSync(manifestPath), "manifest.webmanifest 文件存在");
const manifestContent = readFileSync(manifestPath, "utf8");
const manifest = JSON.parse(manifestContent);

assert.equal(manifest.name, "信息河 · InfoStream", "manifest.name 正确");
assert.equal(manifest.short_name, "信息河", "manifest.short_name 正确");
assert.equal(manifest.display, "standalone", "manifest.display 为 standalone");
assert.equal(manifest.start_url, "/", "manifest.start_url 为 /");
assert.ok(Array.isArray(manifest.icons) && manifest.icons.length > 0, "包含有效 icons 数组");
assert.ok(manifest.icons.some(i => i.src === "/favicon.svg"), "icon 指向 /favicon.svg");
assert.ok(Array.isArray(manifest.shortcuts) && manifest.shortcuts.length >= 5, "shortcuts 包含 5 大长青树专题快捷方式");
console.log(`  OK Manifest 验证通过，包含 ${manifest.shortcuts.length} 个桌面/手机长按快捷入口`);

console.log("\n=== 2. 测试 Service Worker 脚本完整性 ===");
const swPath = "./assets/sw.js";
assert.ok(existsSync(swPath), "assets/sw.js 文件存在");
const swContent = readFileSync(swPath, "utf8");
assert.ok(swContent.includes("CACHE_NAME"), "包含 CACHE_NAME 声明");
assert.ok(swContent.includes("PRECACHE_ASSETS"), "包含 PRECACHE_ASSETS 静态预缓存列表");
assert.ok(swContent.includes("addEventListener(\"install\""), "包含 install 事件监听");
assert.ok(swContent.includes("addEventListener(\"activate\""), "包含 activate 事件监听");
assert.ok(swContent.includes("addEventListener(\"fetch\""), "包含 fetch 请求拦截处理");
assert.ok(swContent.includes("Stale-While-Revalidate"), "包含 Stale-While-Revalidate 缓存策略");
console.log("  OK Service Worker 离线缓存引擎逻辑完备");

console.log("\n=== 3. 测试 HTML 模板 PWA 元数据标签注入 ===");
const htmlFiles = ["index.html", "wealth.html", "opensource.html", "ship.html", "prompt.html", "fire.html", "truth.html"];
for (const file of htmlFiles) {
  const content = readFileSync(file, "utf8");
  assert.ok(content.includes('rel="manifest" href="/manifest.webmanifest"'), `${file} 包含 manifest 引用`);
  assert.ok(content.includes('name="apple-mobile-web-app-capable" content="yes"'), `${file} 支持 iOS 全屏 Web App`);
  assert.ok(content.includes('name="theme-color"'), `${file} 包含 theme-color 顶栏配色`);
}
console.log(`  OK ${htmlFiles.length} 个核心页面均已规范注入 PWA 与 iOS 主屏幕支持标签`);

console.log("\n=== 4. 测试 Service Worker 客户端注册机制 ===");
const bookmarkContent = readFileSync("./assets/bookmark.js", "utf8");
assert.ok(bookmarkContent.includes("navigator.serviceWorker.register(\"/assets/sw.js\")"), "bookmark.js 自动注册 /assets/sw.js");
console.log("  OK 全站已由 bookmark.js 无缝托管 Service Worker 自动生命周期注册");

console.log("\nALL PWA TESTS PASSED!");

