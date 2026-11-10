import fs from "fs";
import { execSync } from "child_process";

let proxyFlag = "";
try {
  execSync('curl.exe -x http://127.0.0.1:7890 -sI --connect-timeout 2 "https://ai.myinfostream.com/"', { stdio: "ignore" });
  proxyFlag = "-x http://127.0.0.1:7890";
  console.log("Using proxy: http://127.0.0.1:7890");
} catch {
  console.log("Using direct connection");
}

const w45Papers = JSON.parse(fs.readFileSync("data/w45-papers.json", "utf8"));
console.log(`Total W45 papers to upload: ${w45Papers.length}`);

// 分批上传，每批 25 篇
const chunkSize = 25;
let successCount = 0;

for (let i = 0; i < w45Papers.length; i += chunkSize) {
  const batch = w45Papers.slice(i, i + chunkSize);
  const batchFile = `data/temp_w45_batch_${i}.json`;
  fs.writeFileSync(batchFile, JSON.stringify({ papers: batch }), "utf8");

  try {
    const cmd = `curl.exe -4 ${proxyFlag} -s -X POST -H "Content-Type: application/json" --data-binary "@${batchFile}" "https://ai.myinfostream.com/api/papers?action=batch_insert"`;
    const res = execSync(cmd, { encoding: "utf8" });
    const json = JSON.parse(res);
    if (json.success) {
      successCount += batch.length;
      console.log(`✓ Batch ${Math.floor(i / chunkSize) + 1}/${Math.ceil(w45Papers.length / chunkSize)} uploaded: ${batch.length} papers`);
    } else {
      console.error(`✗ Batch failed:`, json);
    }
  } catch (err) {
    console.error(`✗ Batch ${i} request error:`, err.message);
  } finally {
    if (fs.existsSync(batchFile)) fs.unlinkSync(batchFile);
  }
}

console.log(`\n=== W45 Upload Completed: ${successCount} / ${w45Papers.length} papers uploaded into Cloudflare D1 ===`);

// 校验周概览与 W45 查询
try {
  const overviewRes = execSync(`curl.exe -4 ${proxyFlag} -s "https://ai.myinfostream.com/api/papers?weeks_overview=1"`, { encoding: "utf8" });
  const overview = JSON.parse(overviewRes);
  console.log("D1 Available Weeks Count:", overview.total_weeks);
  console.log("Latest Week in D1:", overview.latest_week);
  console.log("Latest Week Details:", overview.weeks?.find(w => w.week === "2026-W45"));
} catch (e) {
  console.error("Overview check failed:", e.message);
}

try {
  const w45Res = execSync(`curl.exe -4 ${proxyFlag} -s "https://ai.myinfostream.com/api/papers?week=2026-W45"`, { encoding: "utf8" });
  const w45 = JSON.parse(w45Res);
  console.log("\nVerify /api/papers?week=2026-W45:");
  console.log("- Total papers:", w45.total);
  console.log("- Starred papers:", w45.stats?.starred);
  console.log("- Sources count:", w45.stats?.sources);
  console.log("- Daily distribution:", w45.daily?.map(d => `${d.date}: ${d.count}`).join(", "));
} catch (e) {
  console.error("W45 check failed:", e.message);
}

