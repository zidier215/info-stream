// functions/feedback.js
// ---------------------------------------------------------------------------
// /feedback 别名路由：301 规范重定向至 /contact 统一联系与在线反馈中心
// ---------------------------------------------------------------------------

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const targetUrl = new URL(url.toString());
  targetUrl.pathname = "/contact";
  return Response.redirect(targetUrl.toString(), 301);
}

