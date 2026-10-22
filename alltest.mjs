// alltest.mjs —— 一键跑全部测试
// ---------------------------------------------------------------------------
// 用法：
//   node alltest.mjs            # 秒级套件（不联网）
//   node alltest.mjs --full     # 加上会真打上游的 apitest
//   node alltest.mjs --e2e      # 加上真实浏览器端到端（需要先起 localsim）
//
// 为什么要有这个文件：
//   2026-10-22 那次线上空白页，apitest / hosttest / guardtest 全部绿灯。
//   这三个测的都是「接口返回的 JSON 对不对」，没有一个测「数据有没有真的
//   变成 DOM 里的卡片」—— 而用户看到的恰恰是后者。
//   根因不是「测试不够多」，是 **没有人跑一个覆盖全部测试的入口**，
//   于是补写的 webtest 很可能被忘掉。这里把入口固定下来。
//
// 分档说明：
//   秒级  budgettest / timeouttest / hosttest / gametest / guardtest —— 纯本地，不发网络请求
//         edgetest 也不联网，但要等 15s 的 L1 过期，约 20 秒
//   联网  apitest —— 真打 Google News，约 10–20 秒
//   端到端 webtest / staletest —— 真实浏览器，覆盖「数据 → DOM」，只有它们能抓到渲染类 bug
//         gameshot / hotshot —— 子站（game / hot）出图与断言，各 1–2 分钟，出 shot-*.png
// ---------------------------------------------------------------------------
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const full = args.includes("--full");
const e2e = args.includes("--e2e");

function run(name, cmd, cmdArgs) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const p = spawn(cmd, cmdArgs, { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (out += d));
    p.on("close", (code) => {
      // 只在失败时打全文，成功时打尾部摘要，避免刷屏
      const ms = Date.now() - t0;
      const tail = out.trim().split("\n").slice(-4).join("\n");
      console.log(`${code === 0 ? "PASS" : "FAIL"}  ${name.padEnd(12)} ${String(ms).padStart(6)}ms`);
      if (code !== 0) console.log(out);
      else if (process.env.VERBOSE) console.log(tail);
      resolve({ name, code });
    });
  });
}

const SUITES = [
  { name: "budgettest", args: [] },
  // timeouttest 会起一个「故意做坏」的本地上游（发 header 后永久挂住 body），
  // 用来锁住 fetchRaw 的超时保护是否真的覆盖到读 body。纯本地，秒级。
  { name: "timeouttest", args: [] },
  // edgetest 锁 stale-while-error 兜底：mock 掉全部上游 + 补一个内存版 caches，
  // 验证「实时源全挂时回退旧快照并标 stale:true」。
  // 不联网，但要真等 15s 的 L1 过期，所以约 20 秒。
  { name: "edgetest", args: [] },
  { name: "hosttest", args: [] },
  // gametest 锁 Epic 免费游戏源：打折款必须被剔除（discountPercentage !== 0）、
  // 三态分类、以及前端徽章在十种语言下的拼装。纯夹具，不联网。
  { name: "gametest", args: [] },
  { name: "guardtest", args: [] },
  ...(full ? [{ name: "apitest", args: [] }] : []),
  ...(e2e ? [{ name: "webtest", args: ["http://myinfostream.test:8788/"], env: { SIM: "1" } }] : []),
  // staletest 拦截 /api/feed 注入 stale:true，验证前端横幅真的会弹出来 ——
  // 这是「后端标了、前端响了」的跨端约定，两边各写各的最容易一边改了另一边没跟。
  ...(e2e ? [{ name: "staletest", args: [], env: { SIM: "1" } }] : []),
  // 子站的出图套件。放 --e2e 而不是 --full，因为它们要的是「本机渲染的那一屏」，
  // 没有 localsim 就没有 Host 透传，game / hot 的子站形态根本渲染不出来。
  //   gameshot 拦 /api/feed 注入夹具（Epic 每周换货，img URL 会漂移，没法跨轮对比）
  //   hotshot  不拦，走真数据 —— hot 站要断言的是 host→tab→source 整条取数链路，
  //              一夹具就把最容易坏的那一环屏蔽掉了（上一轮 localsim 的 /api/
  //              分支漏做 .test→.com 还原，就是靠它才暴露的）
  // 两个都出图，耗时各 1–2 分钟，是这套里最慢的，所以单独一档。
  ...(e2e ? [{ name: "gameshot", args: [] }] : []),
  ...(e2e ? [{ name: "hotshot", args: [] }] : []),
];

console.log("");
if (!full) console.log("（跳过 apitest：它会真打上游，约 10–20 秒。加 --full 开启）\n");
if (!e2e) console.log("（跳过 webtest：端到端渲染测试。加 --e2e 开启，需先 node localsim.mjs 8788）\n");

const results = [];
for (const s of SUITES) {
  if (s.env) process.env.SIM = s.env.SIM;
  results.push(await run(s.name, process.execPath, [join(ROOT, s.name + ".mjs"), ...s.args]));
}

const bad = results.filter((r) => r.code !== 0);
console.log("");
if (bad.length) {
  console.log(`✗ ${bad.length}/${results.length} 个套件失败: ${bad.map((b) => b.name).join(", ")}`);
  process.exit(1);
}
console.log(`✓ ${results.length}/${results.length} 个套件通过`);