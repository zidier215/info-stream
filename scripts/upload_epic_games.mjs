// scripts/upload_epic_games.mjs
// 将 2019 - 2026 年 Epic 历年免费游戏完整数据集持久化录入 Cloudflare D1
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

const archiveData = JSON.parse(fs.readFileSync("data/epic-games-archive.json", "utf8"));
console.log(`Total Epic games to upload: ${archiveData.length}`);

const batchFile = "data/temp_epic_batch.json";
fs.writeFileSync(batchFile, JSON.stringify({ games: archiveData }), "utf8");

try {
  const cmd = `curl.exe -4 ${proxyFlag} -s -X POST -H "Content-Type: application/json" --data-binary "@${batchFile}" "https://game.myinfostream.com/api/games?action=batch_insert"`;
  const res = execSync(cmd, { encoding: "utf8" });
  const json = JSON.parse(res);
  if (json.success) {
    console.log(`✓ Successfully uploaded ${json.inserted} games into Cloudflare D1!`);
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
  const overviewRes = execSync(`curl.exe -4 ${proxyFlag} -s "https://game.myinfostream.com/api/games?overview=1"`, { encoding: "utf8" });
  const overview = JSON.parse(overviewRes);
  console.log("\n=== Online D1 Verification ===");
  console.log("Storage:", overview.storage);
  console.log("Total Games:", overview.total_games);
  console.log("Total USD Value:", `$${overview.total_value_usd}`);
  console.log("Total RMB Value:", `¥${overview.total_value_rmb}`);
  console.log("3A Count:", overview.aaa_count);
  console.log("Years Covered:", overview.years?.map(y => `${y.year}(${y.count}款)`).join(", "));
} catch (e) {
  console.error("Verification error:", e.message);
}

