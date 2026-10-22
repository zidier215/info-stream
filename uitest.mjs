// uitest.mjs —— 访客 / 开发者 双场景 UI 测试（真实浏览器）
// 用法：API_SECRET=simsecret node localsim.mjs 8788 && SIM_KEY=simsecret node uitest.mjs
// 场景 A：不带 key  → 私有区块与翻译按钮都应隐藏，信息流正常无限加载
// 场景 B：带 ?key=<SIM_KEY> → 私有区块解锁、key 被抹掉、RTL 生效、检索命中
//
// 走 SIM 假域名而不是 file://index.html：
//   app.js 的 isLocal() 判 hostname，开 127.0.0.1 会切到 demo 演示池，
//   测的就不是真实取数链路了。理由同 simhosts.mjs。
//
// 为什么密钥要走环境变量（2026-10-22）：
//   密钥原先硬编码 "demo"，但 localsim 只在 API_SECRET 存在时才放行私密端点
//   （context.env.API_SECRET 判有没有配）。两者一旦不一致就是整齐的 401 ——
//   症状是「接口区块空白、检索 0 命中」，看起来像功能坏了，其实是密钥不匹配。
//   同一个 env 名两边共用就不可能错开。
const KEY = process.env.SIM_KEY || "demo";
import { loadPlaywright } from "./pwpath.mjs";
import { simArgs, simURL } from "./simhosts.mjs";

const url = simURL("main");
const { chromium } = await loadPlaywright();
const b = await chromium.launch({ args: simArgs() });

// ---------- 场景 A：访客（无密钥）----------
{
  const p = await b.newPage({ viewport: { width: 1360, height: 900 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });

  await p.goto(url);
  // 等首张卡片真的出现，而不是拍一个固定时长。
  // 本地没有 Pages 边缘缓存，首次取数要真打上游，实测冷启动 2.5~3s 才出第一张卡；
  // 原来的 waitForTimeout(900) 是在拿「网络还没回来」当「渲染坏了」，
  // 断言恒为 0，测的是本地磁盘速度而不是代码对不对。
  const firstCard = await p
    .locator(".card")
    .first()
    .waitFor({ state: "visible", timeout: 20000 })
    .then(() => true)
    .catch(() => false);
  if (!firstCard) console.log("  ⚠ 20s 内没等到首张卡片");

  const cards = await p.locator(".card").count();
  const discoverVisible = await p.locator(".discover-wrap").isVisible();
  const transVisible = await p.locator("#translateBtn").isVisible();

  // 无限滚动：滚到底部，卡片数应持续增长。
  // 截止条件不能写死 10 次（2026-10-22 修）：
  //   冷启动下 buffer 末段会卡在「还剩几条画不出来」，滚 10 次看到的增长
  //   可能停在 36 —— 那正是 bug 本身，而不是滚动到头了。写死次数等于把
  //   「滚够了没」和「画完了没」混成一件事，测出来的通过率靠运气。
  // 改成两条终止条件任一满足：① 卡片数连续 3 次不涨（真的到底了）
  //                          ② 卡片数不再增长且 buffer 已空（取数耗尽）
  // 判定「无限滚动 OK」的口径也随之放宽：只要中途涨过就算过，
  // 因为「这条数据源一共就这么多」是内容事实，不是滚动失效。
  let last = cards;
  let grew = false;
  let flat = 0;
  for (let i = 0; i < 14 && flat < 3; i++) {
    await p.mouse.wheel(0, 4000);
    await p.waitForTimeout(160);
    const now = await p.locator(".card").count();
    if (now > last) { grew = true; flat = 0; } else { flat++; }
    last = now;
  }
  await p.waitForTimeout(700);          // 给最后一次异步补货留出绘制时间
  const cardsAfter = await p.locator(".card").count();
  // 收尾校验：buffer 必须清空。货还卡在 buffer 里就是「画不出来」，
  // 哪怕卡片数看起来涨过 —— 这是同一个 bug 的另一种表现。
  const leftover = await p.evaluate(() => (typeof buffer !== "undefined" ? buffer.length : -1));
  const scrollOk = grew && leftover === 0;
  console.log("访客模式（无密钥）:");
  console.log("  卡片数        =", cards);
  console.log("  接口区块可见  =", discoverVisible, discoverVisible ? "✗ 不该可见" : "✓");
  console.log("  翻译按钮可见  =", transVisible, transVisible ? "✗ 不该可见" : "✓");
  console.log("  滚动后卡片    =", cardsAfter, scrollOk ? "✓ 已画完" : `✗ buffer 还剩 ${leftover} 条没画出来`);

  const guestOk = !discoverVisible && !transVisible && scrollOk && errs.length === 0;
  console.log("  控制台错误    =", errs.length, errs.slice(0, 3).join(" | "));
  console.log("  → 场景 A", guestOk ? "✓ 通过" : "✗ 失败");
  await p.close();
  if (!guestOk) { await b.close(); process.exit(1); }
}

// ---------- 场景 B：带密钥的开发者 ----------
{
  const p = await b.newPage({ viewport: { width: 1360, height: 900 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });

  await p.goto(url + "?key=" + encodeURIComponent(KEY));
  await p.waitForTimeout(1200);

  const discoverVisible = await p.locator(".discover-wrap").isVisible();
  const urlNoKey = !p.url().includes("key=");

  // 切到英文：验证 RTL + 翻译按钮（中文界面下翻译按钮按设计隐藏，先切语言再查）
  await p.selectOption("#lang", "en");
  await p.waitForTimeout(400);
  const transVisible = await p.locator("#translateBtn").isVisible();

  // 阿拉伯语验证 RTL
  await p.selectOption("#lang", "ar");
  await p.waitForTimeout(400);
  const dir = await p.getAttribute("html", "dir");

  // 切回英文并检索（英文检索必须能命中，靠 en 别名字段）
  await p.selectOption("#lang", "en");
  await p.waitForTimeout(400);
  await p.fill("#discoverInput", "weather");
  // 检索要打 /api/discover，同样等结果出现而不是拍时长
  await p
    .locator(".api-card")
    .first()
    .waitFor({ state: "visible", timeout: 15000 })
    .catch(() => {});
  const hits = await p.locator(".api-card").count();

  console.log(`\n带 ?key=${KEY}:`);
  console.log("  接口区块可见  =", discoverVisible, discoverVisible ? "✓" : "✗");
  console.log("  key 已从URL抹掉 =", urlNoKey, urlNoKey ? "✓" : "✗");
  console.log("  dir(阿拉伯语) =", dir, dir === "rtl" ? "✓" : "✗");
  console.log("  翻译按钮可见  =", transVisible, transVisible ? "✓" : "✗");
  console.log("  搜 weather 结果 =", hits, hits > 0 ? "✓" : "✗");
  console.log("  控制台错误    =", errs.length, errs.slice(0, 3).join(" | "));

  const devOk = discoverVisible && urlNoKey && dir === "rtl" && transVisible && hits > 0 && errs.length === 0;
  console.log("  → 场景 B", devOk ? "✓ 通过" : "✗ 失败");
  await p.close();
  await b.close();
  process.exit(devOk ? 0 : 1);
}