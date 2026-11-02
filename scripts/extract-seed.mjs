// scripts/extract-seed.mjs
// 将用户提供的 50 篇精选 AI 论文档案提取为结构化的 JSON 与 SQL 种子文件
import { readFileSync, writeFileSync } from "node:fs";

const html = `<!DOCTYPE html>
<html lang="zh-CN">
...
`;

