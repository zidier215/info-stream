// functions/_lib/budget.js
// ---------------------------------------------------------------------------
// 超时预算表 —— 全站唯一的真相来源。
//
// 为什么要有这个文件（2026-10-22）：
//   同一天内出了 **三次**「内层超时 > 外层 deadline」的事故，症状都是
//   「接口返回 200、JSON 合法、就是 0 条」，而且每次都极难定位：
//
//     1. gnews.js   fetchText 8000ms  vs sources.js SOURCE_DEADLINE 6000ms
//        → 所有 Google News 源被判空。world/ai tab 随机 0 条。
//     2. 修复时把外层调到 11000ms，最坏延迟变成 11+4=15s，
//        线上实测 AI tab 顶到 23.4 秒 —— 白屏等十几秒。
//     3. sources.js arxiv() 里的 fetchText 9000ms
//        → 又一次内层比外层长 1 秒，**arXiv 论文源从那时起一直是死的**，
//          但因为同 tab 里 ai-news 仍有数据，页面看不出异常。
//
//   三次的共同根因不是「忘了调数值」，而是 **超时值散落在三个文件里，
//   大小关系只能靠人脑记住**。谁改其中一处，另外两处都不会被提醒。
//
// 所以这里的做法：把所有超时集中声明，sources.js / gnews.js 一律从此处取值，
// 再由 guardtest.mjs 断言不变式。改预算只需要改这一个文件，且改坏了测试立刻红。
//
// 不变式（invariant）：
//   max(所有内层 HTTP 超时)  <  SOURCE_DEADLINE
//   SOURCE_DEADLINE + RETRY  <=  WORST_CASE
// 任何一条被破坏，对应的源就会静默返回空数组，而不是报错。
// ---------------------------------------------------------------------------

/** 抓单个上游的硬超时（fetchText / fetchJSON 的第三个参数） */
export const HTTP_TIMEOUT = {
  /** Google News RSS。边缘到 news.google.com 常态 1~3s */
  gnews: 6000,
  /** arXiv API。export.arxiv.org 常年慢，给得比 GN 宽一点 */
  arxiv: 6500,
  /** 汇率源（er-api / frankfurter）。这是个纯计算接口，毫秒级返回，
   *  给长预算没有意义 —— 上游真慢了早该降级掉，别拖住整个 tab。 */
  fx: 3500,
  /** 其他零散上游的默认值 */
  default: 6000,
};

/**
 * 局部 deadline：包在「一组并行子请求」外面用的，比单源 deadline 更短。
 * 这些子请求各自都很快（汇率、币价这类结构化 API），等满 8 秒纯属浪费用户时间。
 * 同理必须 < SOURCE_DEADLINE —— 它们和外层是嵌套关系，不是并列关系。
 */
export const SUB_DEADLINE = {
  /** 汇率多端点互备：任一成功即可 */
  fx: 2500,
  /** 市场行情（外汇 + 币价两条线并行） */
  market: 3000,
};

/**
 * 外层 deadline：整个「一个源」的预算。
 * 必须严格大于所有内层 HTTP_TIMEOUT，否则源会被外层先判死。
 */
export const SOURCE_DEADLINE = 8000;

/** 第一轮全空后的重试预算。比第一轮短 —— 重试是用来救「差几秒」的，
 *  上游真挂了的话重试同样会挂，不该为此再让用户多等一轮。 */
export const RETRY_DEADLINE = 3000;

/**
 * 最坏情况端到端延迟上限。单源路径 = 第一轮 + 重试轮。
 * 用来对照实测：线上超过 WORST_CASE 的请求说明有别的开销（冷启动/重连），
 * 该看边缘缓存而不是继续加超时。
 */
export const WORST_CASE = SOURCE_DEADLINE + RETRY_DEADLINE; // 11000ms