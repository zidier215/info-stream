// functions/api/feedback.js
// ---------------------------------------------------------------------------
// InfoStream 用户在线反馈与站长邮件投递接口
// 支持 Honeypot 蜜罐防爬、边缘 IP 限频、D1 本地存底与邮件实时转寄 (contact@myinfostream.com)
// ---------------------------------------------------------------------------

const TARGET_EMAIL = "contact@myinfostream.com";

// 内存级滑动窗口限流：单 IP 每小时最多提交 5 次
const RATE_LIMIT_MAP = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 5;

function checkRateLimit(ip) {
  const now = Date.now();
  // 惰性清理过期记录，无需后台计时器
  if (RATE_LIMIT_MAP.size > 200) {
    for (const [k, rec] of RATE_LIMIT_MAP.entries()) {
      if (now - rec.start > RATE_LIMIT_WINDOW_MS) {
        RATE_LIMIT_MAP.delete(k);
      }
    }
  }

  const record = RATE_LIMIT_MAP.get(ip);
  if (!record || now - record.start > RATE_LIMIT_WINDOW_MS) {
    RATE_LIMIT_MAP.set(ip, { start: now, count: 1 });
    return true;
  }
  if (record.count >= MAX_PER_WINDOW) {
    return false;
  }
  record.count++;
  return true;
}

async function ensureFeedbackTable(db) {
  if (!db || typeof db.prepare !== "function") return;
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS feedbacks (
        id TEXT PRIMARY KEY,
        name TEXT,
        email TEXT NOT NULL,
        category TEXT,
        message TEXT NOT NULL,
        ip TEXT,
        user_agent TEXT,
        created_at INTEGER NOT NULL
      )
    `).run();
  } catch (err) {
    console.error("ensureFeedbackTable failed:", err?.message);
  }
}

export async function onRequest(context) {
  const { request, env } = context;
  const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "127.0.0.1";
  const userAgent = request.headers.get("user-agent") || "";

  // 跨域预检
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method Not Allowed" }),
      { status: 405, headers: { "Content-Type": "application/json" } }
    );
  }

  // 1. IP 频次限制
  if (!checkRateLimit(ip)) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "提交过于频繁，请稍候再试（单 IP 限制每小时 5 次）。如有紧急事务，请直接邮件发送至 contact@myinfostream.com",
      }),
      { status: 429, headers: { "Content-Type": "application/json" } }
    );
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ success: false, error: "无效的请求格式，需为 JSON" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const {
    name = "",
    email = "",
    category = "综合反馈",
    message = "",
    page_url = "",
    _honey = "", // 蜜罐反垃圾字段
  } = body;

  // 2. 蜜罐防刷检测：若机器填写了隐藏字段，返回假成功以静默淘汰爬虫
  if (_honey && _honey.trim().length > 0) {
    return new Response(
      JSON.stringify({ success: true, message: "反馈已收到，感谢您的支持！" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  // 3. 字段有效性校验
  const cleanEmail = String(email || "").trim();
  const cleanMessage = String(message || "").trim();
  const cleanName = String(name || "").trim().slice(0, 80);
  const cleanCategory = String(category || "综合反馈").trim().slice(0, 60);

  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return new Response(
      JSON.stringify({ success: false, error: "请提供有效的电子邮箱地址，以便我们向您回复" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!cleanMessage || cleanMessage.length < 5) {
    return new Response(
      JSON.stringify({ success: false, error: "反馈内容请至少填写 5 个字符" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (cleanMessage.length > 3000) {
    return new Response(
      JSON.stringify({ success: false, error: "反馈内容超出最大长度限制 (3000字)" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const feedbackId = `fb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = Date.now();

  // 4. 写入 D1 边缘数据库本地持久化归档（若可用）
  if (env && env.DB) {
    try {
      await ensureFeedbackTable(env.DB);
      await env.DB.prepare(`
        INSERT INTO feedbacks (id, name, email, category, message, ip, user_agent, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        feedbackId,
        cleanName,
        cleanEmail,
        cleanCategory,
        cleanMessage,
        ip,
        userAgent.slice(0, 200),
        now
      ).run();
    } catch (dbErr) {
      console.warn("D1 feedback insert warning:", dbErr?.message);
    }
  }

  // 5. 投递邮件至 contact@myinfostream.com
  let mailDispatched = false;
  try {
    const dispatchPayload = {
      name: cleanName || "InfoStream 读者",
      email: cleanEmail,
      _subject: `[InfoStream 反馈] 【${cleanCategory}】来自 ${cleanName || cleanEmail}`,
      category: cleanCategory,
      message: cleanMessage,
      page_url: page_url || "https://myinfostream.com/contact",
      submitted_at: new Date().toISOString(),
      _captcha: "false",
    };

    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 4000);
    try {
      const mailRes = await fetch(`https://formsubmit.co/ajax/${TARGET_EMAIL}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": "InfoStream-Feedback-Worker/1.0",
        },
        body: JSON.stringify(dispatchPayload),
        signal: ctrl.signal,
      });

      if (mailRes.ok) {
        mailDispatched = true;
      } else {
        console.warn("Mail dispatch gateway returned non-200:", mailRes.status);
      }
    } finally {
      clearTimeout(tid);
    }
  } catch (err) {
    console.error("Mail dispatch gateway network error:", err?.message);
  }

  return new Response(
    JSON.stringify({
      success: true,
      id: feedbackId,
      dispatched: mailDispatched,
      message: "您的反馈已成功发送！信息河团队已收到，通常在 24–48 小时内处理回复。",
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store, no-cache",
      },
    }
  );
}

