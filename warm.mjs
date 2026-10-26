/**
 * 边缘缓存预热 —— 只发请求，不改任何代码/配置。
 *
 * 目的：把 L2（caches.default，边缘隔离区缓存）填上，让首批真实访客
 *       不用等 8~11 秒的上游抓取。首次请求必然 miss（真抓上游），
 *       第二次请求才是缓存命中路径。
 *
 * 实现说明：Node 原生 fetch（undici）**不读 HTTPS_PROXY 环境变量**，
 *          直连 Cloudflare 在本机会 30~45s 超时。所以这里用 curl 子进程，
 *          显式走系统代理 http://127.0.0.1:59940。
 *
 * 用法：node warm.mjs [--second]
 *   --second  再跑一轮，验证第二次是否变快（命中 L1/L2）
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { HOSTS } from "./functions/_lib/hosts.js";

const pexec = promisify(execFile);
const PROXY = "http://127.0.0.1:59940";
const SECOND = process.argv.includes("--second");
const ROUND = SECOND ? 2 : 1;

function fmt(ms) {
  return ms >= 1000 ? (ms / 1000).toFixed(2) + "s" : ms + "ms";
}

// 本机代理对部分子域解析不了（game.myinfostream.com 实测 NX），
// 代理自己解析失败时 curl 只会报 "Could not resolve host"。
// 回退方案：nslookup 拿真实 IP，用 --connect-to 让代理连到该 IP，
// 但 SNI / Host 仍用原域名 —— 绕过代理的 DNS，不影响 CF 侧的路由判定。
async function resolveIp(host) {
  try {
    const { stdout } = await pexec("nslookup", [host, "8.8.8.8"], { encoding: "utf8" });
    const ips = [...stdout.matchAll(/Address(?:es)?:\s*(.*)/g)]
      .flatMap((m) => m[1].trim().split(/\s+/))
      .filter((s) => /^\d{1,3}(\.\d{1,3}){3}$/.test(s));
    return ips[0] || null;
  } catch {
    return null;
  }
}

async function curlOnce(host, path, extra = []) {
  return pexec(
    "curl",
    [
      "-4", "--noproxy", "*", "-s", "-m", "50", "-x", PROXY,
      "-H", "Accept: application/json",
      "-w", "\n__META__%{http_code}",
      ...extra,
      `https://${host}${path}`,
    ],
    { maxBuffer: 32 * 1024 * 1024, encoding: "utf8" }
  );
}

async function hit(url) {
  const t0 = Date.now();
  const u = new URL(url);
  let stdout = null;
  let err = null;
  try {
    ({ stdout } = await curlOnce(u.host, u.pathname + u.search));
  } catch (e) {
    err = (e.stderr || e.message || "").toString().split("\n").pop().slice(0, 90);
  }
  // 代理解析失败 → 换 IP 直连重试一次
  if (err && /resolve|Could not resolve/i.test(err)) {
    const ip = await resolveIp(u.host);
    if (ip) {
      try {
        ({ stdout } = await curlOnce(u.host, u.pathname + u.search, ["--connect-to", `${u.host}:443:${ip}:443`]));
        err = null;
      } catch (e2) {
        err = (e2.stderr || e2.message || "").toString().split("\n").pop().slice(0, 90);
      }
    }
  }
  const ms = Date.now() - t0;
  if (stdout == null) return { status: 0, ms, count: null, stale: null, err };
  const i = stdout.lastIndexOf("__META__");
  if (i < 0) return { status: 0, ms, count: null, stale: null, err: err || "no-meta" };
  const status = parseInt(stdout.slice(i + 8).trim(), 10) || 0;
  const body = stdout.slice(0, i).trim();
  let j = null;
  try { j = JSON.parse(body); } catch {}
  if (!j) return { status, ms, count: null, stale: null, err: body.slice(0, 120) };
  return { status, ms, count: j.count, stale: j.stale, err: j.error || null };
}

const plan = [];
for (const [, cfg] of Object.entries(HOSTS)) {
  for (const tab of cfg.tabs || []) plan.push({ host: cfg.host, tab: tab.id });
}

console.log(`预热目标：${plan.length} 个 tab（第 ${ROUND} 轮，代理 ${PROXY}）\n`);
const results = [];
for (const p of plan) {
  const url = `https://${p.host}/api/feed?tab=${p.tab}`;
  const r = await hit(url);
  results.push({ ...p, ...r });
  const flag = r.status === 200 ? (r.stale ? "STALE" : "ok   ") : "FAIL ";
  console.log(
    `[${flag}] ${p.host.padEnd(26)} ${p.tab.padEnd(8)} http=${String(r.status).padEnd(4)} ` +
    `count=${String(r.count ?? "-").padEnd(4)} ${fmt(r.ms).padStart(7)} ${r.err || ""}`
  );
  // 串行 + 间隔，避免把「真抓取」限流桶(30/分)打满
  await new Promise((r2) => setTimeout(r2, 1200));
}

const ok = results.filter((r) => r.status === 200);
const total = ok.reduce((s, r) => s + (r.count || 0), 0);
const slow = ok.filter((r) => r.ms > 3000);
console.log(`\n===== 第 ${ROUND} 轮汇总 =====`);
console.log(`成功 ${ok.length}/${results.length}｜条目合计 ${total}｜>3s 的 ${slow.length} 个`);
if (slow.length) console.log("慢 tab: " + slow.map((r) => `${r.host.replace(".myinfostream.com", "")}/${r.tab}=${fmt(r.ms)}`).join(", "));
const fail = results.filter((r) => r.status !== 200);
if (fail.length) console.log("失败: " + fail.map((r) => `${r.host.replace(".myinfostream.com", "")}/${r.tab}=${r.status}${r.err ? " " + r.err : ""}`).join(", "));
