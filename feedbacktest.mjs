// feedbacktest.mjs —— 验证用户在线反馈与站长邮件投递接口及路由
import { onRequest as feedbackApiFn } from "./functions/api/feedback.js";
import { onRequest as contactPageFn } from "./functions/contact.js";
import { onRequest as feedbackRedirectFn } from "./functions/feedback.js";
import { readFileSync } from "node:fs";

const RAW_CONTACT = readFileSync(new URL("./contact.html", import.meta.url), "utf8");

const env = {
  ASSETS: {
    async fetch(req) {
      const u = new URL(req.url);
      if (u.pathname === "/contact.html") {
        return new Response(RAW_CONTACT, { status: 200, headers: { "Content-Type": "text/html" } });
      }
      return new Response("Not Found", { status: 404 });
    },
  },
};

let fail = 0;
const ok = (cond, label) => {
  if (!cond) fail++;
  console.log(`  ${cond ? "OK  " : "FAIL"} ${label}`);
};

console.log("===== 测试 1: POST /api/feedback 正常提交反馈 =====");
const postRes = await feedbackApiFn({
  request: new Request("https://myinfostream.com/api/feedback", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "cf-connecting-ip": "1.2.3.4",
    },
    body: JSON.stringify({
      email: "test.reader@example.com",
      name: "热心读者",
      category: "功能与产品建议",
      message: "希望增加深色模式偏好保存功能，页面排版非常清爽！",
    }),
  }),
  env: {},
});

const postData = await postRes.json();
ok(postRes.status === 200, "HTTP 200 成功响应");
ok(postData.success === true, "返回 success=true");
ok(typeof postData.id === "string" && postData.id.startsWith("fb_"), "生成唯一定位工单 ID");

console.log("\n===== 测试 2: Honeypot 蜜罐防刷检测 =====");
const botRes = await feedbackApiFn({
  request: new Request("https://myinfostream.com/api/feedback", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "cf-connecting-ip": "2.2.2.2",
    },
    body: JSON.stringify({
      email: "spam.bot@spam.com",
      name: "Spam Bot",
      message: "Buy cheap backlinks now!",
      _honey: "I am a malicious bot filling hidden fields",
    }),
  }),
  env: {},
});
const botData = await botRes.json();
ok(botRes.status === 200 && botData.success === true, "蜜罐命中时返回伪成功状态（成功欺骗爬虫并不发信）");

console.log("\n===== 测试 3: 输入校验（邮箱与长度拦截） =====");
const errEmailRes = await feedbackApiFn({
  request: new Request("https://myinfostream.com/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json", "cf-connecting-ip": "3.3.3.3" },
    body: JSON.stringify({ email: "invalid-email", message: "合法的测试消息内容" }),
  }),
  env: {},
});
ok(errEmailRes.status === 400, "非法邮箱拦截 (HTTP 400)");

const errLenRes = await feedbackApiFn({
  request: new Request("https://myinfostream.com/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json", "cf-connecting-ip": "3.3.3.4" },
    body: JSON.stringify({ email: "valid@example.com", message: "短" }),
  }),
  env: {},
});
ok(errLenRes.status === 400, "短内容拦截 (HTTP 400)");

console.log("\n===== 测试 4: 非法请求方法拦截 =====");
const getRes = await feedbackApiFn({
  request: new Request("https://myinfostream.com/api/feedback", { method: "GET" }),
  env: {},
});
ok(getRes.status === 405, "GET 方法拦截 (HTTP 405 Method Not Allowed)");

console.log("\n===== 测试 5: /contact Clean URL 落地页直出 =====");
const contactRes = await contactPageFn({
  request: new Request("https://myinfostream.com/contact", { headers: { host: "myinfostream.com" } }),
  env,
});
const contactHtml = await contactRes.text();
ok(contactRes.status === 200, "/contact 响应 HTTP 200");
ok(contactHtml.includes("contact@myinfostream.com"), "包含站长指定邮箱 contact@myinfostream.com");
ok(contactHtml.includes('id="feedbackForm"'), "包含在线发送邮件反馈表单");
ok(contactHtml.includes('class="top-nav"'), "包含全站同步的顶部导航栏");

console.log("\n===== 测试 6: /feedback 别名 301 重定向至 /contact =====");
const fbRedirectRes = await feedbackRedirectFn({
  request: new Request("https://myinfostream.com/feedback"),
});
ok(fbRedirectRes.status === 301, "/feedback 响应 HTTP 301 重定向");
ok(fbRedirectRes.headers.get("location").endsWith("/contact"), "重定向目标为 /contact");

process.exit(fail === 0 ? 0 : 1);

