// scripts/upload_hot_events.mjs
// 将 2020 - 2026 年互联网破圈大事件与年度热搜历史通鉴持久化录入 Cloudflare D1
import fs from "fs";
import { execSync } from "child_process";

let proxyFlag = "";
try {
  execSync('curl.exe -x http://127.0.0.1:7890 -sI --connect-timeout 2 "https://www.google.com"', { stdio: "ignore" });
  proxyFlag = "-x http://127.0.0.1:7890";
  console.log("Using proxy: http://127.0.0.1:7890");
} catch {
  console.log("Using direct connection");
}

const archiveData = JSON.parse(fs.readFileSync("data/hot-events-archive.json", "utf8"));
console.log(`Total hot events to upload: ${archiveData.length}`);

const batchFile = "data/temp_trends_batch.json";
fs.writeFileSync(batchFile, JSON.stringify({ events: archiveData }), "utf8");

try {
  const cmd = `curl.exe -4 ${proxyFlag} -s -X POST -H "Content-Type: application/json" --data-binary "@${batchFile}" "https://hot.myinfostream.com/api/trends?action=batch_insert"`;
  const res = execSync(cmd, { encoding: "utf8" });
  const json = JSON.parse(res);
  if (json.success) {
    console.log(`✓ Successfully uploaded ${json.inserted} events into Cloudflare D1!`);
  } else {
    console.error("✗ Upload failed:", json);
  }
} catch (err) {
  console.error("✗ Request error:", err.message);
} finally {
  if (fs.existsSync(batchFile)) fs.unlinkSync(batchFile);
}

// 验证在线概览
try {
  const overviewRes = execSync(`curl.exe -4 ${proxyFlag} -s "https://hot.myinfostream.com/api/trends?overview=1"`, { encoding: "utf8" });
  const overview = JSON.parse(overviewRes);
  console.log("\n=== Online D1 Trends Verification ===");
  console.log("Storage:", overview.storage);
  console.log("Total Events:", overview.total_events);
  console.log("Epoch Defining Count:", overview.epoch_count);
  console.log("Peak Heat Max:", overview.peak_heat_max);
  console.log("Categories:", overview.categories?.map(c => `${c.category}(${c.count}件)`).join(", "));
  console.log("Years Covered:", overview.years?.map(y => `${y.year}(${y.count}件)`).join(", "));
} catch (e) {
  console.error("Verification error:", e.message);
}
