// scripts/upload_2026_archive.mjs
// 将 2026 年第 01 周至第 44 周完整论文档案分批持久化导入 Cloudflare D1
import fs from "fs";
import { execSync } from "child_process";

let proxyFlag = "";
try {
  execSync('curl.exe -x http://127.0.0.1:7890 -sI --connect-timeout 2 "https://www.myinfostream.com/"', { stdio: "ignore" });
  proxyFlag = "-x http://127.0.0.1:7890";
  console.log("Using proxy: http://127.0.0.1:7890");
} catch {
  console.log("Using direct connection");
}

const archiveData = JSON.parse(fs.readFileSync("data/papers-2026-archive.json", "utf8"));
console.log(`Total papers to upload: ${archiveData.length}`);

// 分批上传，每批 50 篇
const chunkSize = 50;
let successCount = 0;

for (let i = 0; i < archiveData.length; i += chunkSize) {
  const batch = archiveData.slice(i, i + chunkSize);
  const weekLabel = batch[0]?.year_week || `batch_${i}`;
  const batchFile = `data/temp_batch_${i}.json`;
  fs.writeFileSync(batchFile, JSON.stringify({ papers: batch }), "utf8");

  try {
    const cmd = `curl.exe -4 ${proxyFlag} -s -X POST -H "Content-Type: application/json" --data-binary "@${batchFile}" "https://ai.myinfostream.com/api/papers?action=batch_insert"`;
    const res = execSync(cmd, { encoding: "utf8" });
    const json = JSON.parse(res);
    if (json.success) {
      successCount += batch.length;
      console.log(`✓ Batch ${Math.floor(i / chunkSize) + 1}/${Math.ceil(archiveData.length / chunkSize)} (${weekLabel}) uploaded: ${batch.length} papers`);
    } else {
      console.error(`✗ Batch failed:`, json);
    }
  } catch (err) {
    console.error(`✗ Batch ${i} request error:`, err.message);
  } finally {
    if (fs.existsSync(batchFile)) fs.unlinkSync(batchFile);
  }
}

console.log(`\n=== Upload Completed: ${successCount} / ${archiveData.length} papers uploaded into D1 ===`);

// 校验周概览与总数
const overviewRes = execSync(`curl.exe -4 ${proxyFlag} -s "https://ai.myinfostream.com/api/papers?weeks_overview=1"`, { encoding: "utf8" });
const overview = JSON.parse(overviewRes);
console.log("D1 Available Weeks Count:", overview.total_weeks);
console.log("Latest Week:", overview.latest_week);
console.log("Sample Week 01:", overview.weeks?.find(w => w.week === "2026-W01"));
console.log("Sample Week 44:", overview.weeks?.find(w => w.week === "2026-W44"));
