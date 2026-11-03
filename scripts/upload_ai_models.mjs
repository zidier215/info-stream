// scripts/upload_ai_models.mjs
// 将 2023 - 2026 年行业划时代 48 款大模型完整数据集持久化录入 Cloudflare D1
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

const archiveData = JSON.parse(fs.readFileSync("data/ai-models-archive.json", "utf8"));
console.log(`Total AI models to upload: ${archiveData.length}`);

const batchFile = "data/temp_models_batch.json";
fs.writeFileSync(batchFile, JSON.stringify({ models: archiveData }), "utf8");

try {
  const cmd = `curl.exe -4 ${proxyFlag} -s -X POST -H "Content-Type: application/json" --data-binary "@${batchFile}" "https://ai.myinfostream.com/api/models?action=batch_insert"`;
  const res = execSync(cmd, { encoding: "utf8" });
  const json = JSON.parse(res);
  if (json.success) {
    console.log(`✓ Successfully uploaded ${json.inserted} models into Cloudflare D1!`);
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
  const overviewRes = execSync(`curl.exe -4 ${proxyFlag} -s "https://ai.myinfostream.com/api/models?overview=1"`, { encoding: "utf8" });
  const overview = JSON.parse(overviewRes);
  console.log("\n=== Online D1 Models Verification ===");
  console.log("Storage:", overview.storage);
  console.log("Total Models:", overview.total_models);
  console.log("Frontier Count:", overview.frontier_count);
  console.log("Open Weights Count:", overview.open_weights_count);
  console.log("Max Arena ELO:", overview.max_elo);
  console.log("Max Context Window:", overview.max_context);
  console.log("Orgs Covered:", overview.orgs?.map(o => `${o.org}(${o.count}款)`).join(", "));
  console.log("Years Covered:", overview.years?.map(y => `${y.year}(${y.count}款)`).join(", "));
} catch (e) {
  console.error("Verification error:", e.message);
}
