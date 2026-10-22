// dumptpl.mjs —— 打印 UI_I18N 里几个游戏模板的十语种实际值
import { readFileSync } from "node:fs";
const APP = readFileSync("assets/app.js", "utf8");
const key = process.argv[2] || "gmLive";
const line = APP.split("\n").find((l) => l.includes(key + ":"));
const body = line.slice(line.indexOf(key + ":") + key.length + 1).trim().replace(/,\s*$/, "");
const obj = eval("(" + body + ")");
for (const k of Object.keys(obj)) console.log(k.padEnd(9), JSON.stringify(obj[k]));