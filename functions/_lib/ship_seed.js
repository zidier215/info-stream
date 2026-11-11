// functions/_lib/ship_seed.js
// ---------------------------------------------------------------------------
// 出海造筏与一人公司出海全景图谱种子数据 (Ship & Solopreneur Global Stack)
// 包含：全球收款通道横评、海外合规实体、冷启动分发矩阵、极限低成本技术栈、商业硬规律
// ---------------------------------------------------------------------------

export const PAYMENTS_DATA = [
  {
    id: "pay_stripe",
    name: "Stripe",
    type: "Payment Gateway (直连支付网关)",
    model: "自主主体商户",
    rate_desc: "2.9% + $0.30 (海外卡额外 +1%–1.5%)",
    payout_cycle: "2–7 个工作日自动提现至绑定银行",
    setup_barrier: "需海外公司（如美/英/中国香港等）或海外税号",
    tax_vat_support: "需额外开启 Stripe Tax (每笔加收 0.5%)，自行申报各州/国税款",
    chargeback_risk: "拒付率超过 1% 立即封店冻结资金 180 天",
    best_for: "拥有海外注册实体、月营收稳定在 $5,000 以上、追求最低综合费率的中后期团队",
    verdict: "出海事实上的黄金标准，API 体验无可比拟，但对个人/合规门槛极高，税务需自行申报。"
  },
  {
    id: "pay_lemonsqueezy",
    name: "Lemon Squeezy",
    type: "Merchant of Record (名义商户代收代缴)",
    model: "MoR 全包模式 (现已被 Stripe 收购)",
    rate_desc: "5% + $0.50 (订阅模式下每笔，无月租)",
    payout_cycle: "每周结算 (支持提现到 Wise / PayPal / 离岸银行)",
    setup_barrier: "极低，支持个人护照申请，无需海外注册公司",
    tax_vat_support: "100% 自动代扣代缴全球各地区 VAT/消费税，免除跨境税务审计风险",
    chargeback_risk: "由 LemonSqueezy 集中承担商户风控，个人不承担单一主体封店风险",
    best_for: "独立开发者、一人公司、Micro-SaaS、数字产品出海冷启动首选",
    verdict: "独立出海起步的最佳利器！虽然单笔费率略高于 Stripe，但免去注册公司与申报跨国税务的巨大心智成本。"
  },
  {
    id: "pay_paddle",
    name: "Paddle",
    type: "Merchant of Record (企业级代收代缴)",
    model: "MoR 全包模式",
    rate_desc: "5% + $0.50 (高流水可申请定制费率)",
    payout_cycle: "每月定时结算（满 $100 自动打款）",
    setup_barrier: "中等偏高，审核严格，需提供真实产品体验地址与明确退款政策",
    tax_vat_support: "全面代扣代缴全球税收，支持全球多币种本地化结算与发票合规",
    chargeback_risk: "内置高强度防欺诈风控引擎",
    best_for: "成熟 B2B 软件出海、企业级订阅 SaaS、年流水 $50k+ 以上团队",
    verdict: "欧洲老牌 MoR 巨头，审核较为挑剔，但系统稳定性与大企业采购信誉背书极强。"
  },
  {
    id: "pay_creem",
    name: "Creem / Dodo Payments",
    type: "Modern AI-Native MoR (新一代轻量级代收)",
    model: "MoR 极速代收",
    rate_desc: "4.9% + $0.40 (更低的轻量级抽成)",
    payout_cycle: "T+2 快速结算",
    setup_barrier: "极简，专为 AI Agent、个人独立出海项目设计，数小时极速过审",
    tax_vat_support: "内置全球税务合规处理",
    chargeback_risk: "灵活的微支付与反欺诈过滤",
    best_for: "新一代 AI 微应用、一次性 Token 充值付费包、小型独立工具站",
    verdict: "专为这一轮 AI 出海浪潮崛起的新型轻量支付工具，审核极快，避免了传统大厂繁重的企业资质审查。"
  }
];

export const INCORPORATION_DATA = [
  {
    id: "inc_wyoming",
    region: "美国怀俄明州 (Wyoming LLC)",
    setup_cost: "$150–$300 (一次性代办注册)",
    annual_cost: "$62 / 年 (州政府年审费) + 代理地址费约 $50/年",
    tax_rate: "无州所得税，单人穿透式报税 (Pass-through)",
    privacy: "极高（州公开数据库不强制公开股东姓名）",
    bank_account: "可配套开通 Mercury / Relay 商业银行账户",
    best_for: "一人公司自负盈亏、被动现金流收入、不需要拿外部风投资金的独立开发者",
    summary: "性价比之王！维护费用全美最低之一，法律保护强，隐私极好，是一人出海的最稳地基。"
  },
  {
    id: "inc_delaware",
    region: "美国特拉华州 (Delaware C-Corp / LLC)",
    setup_cost: "$300–$600 (注册费用)",
    annual_cost: "$300+ / 年 (特许经营税 Franchise Tax 起步)",
    tax_rate: "C-Corp 需缴纳联邦企业所得税 (21%) + 州特许税",
    privacy: "中等",
    bank_account: "美国主流大行与硅谷风投默认首选",
    best_for: "计划融资拿硅谷 VC、进 YC 孵化器、未来谋求美股上市或被大厂并购的初创团队",
    summary: "投资人指定的标准法人壳。如果只是个人小本经营，每年数百美金固定特许税容易成为沉重包袱。"
  },
  {
    id: "inc_singapore",
    region: "新加坡私人有限公司 (Pte. Ltd.)",
    setup_cost: "$800–$1,500 (法定要求挂靠新加坡本地董事)",
    annual_cost: "$2,000–$4,000 / 年 (本地董事挂靠、秘书与法定审计开销)",
    tax_rate: "实际有效税率可低至 8.5%–17% (离岸经营免税协定多)",
    privacy: "严格透明 (ACRA 官方登记)",
    bank_account: "DBS / OCBC / UOB 新加坡本地大行",
    best_for: "年流水在 $500,000 以上、有亚太跨国业务实体、需要合规家族办公室或身份规划的成熟业务",
    summary: "信誉声誉极好，但维护门槛极高，非初学者出海造筏第一站。"
  },
  {
    id: "inc_uk",
    region: "英国有限公司 (UK LTD)",
    setup_cost: "£50–£150 (官方注册成本仅 £12–£50)",
    annual_cost: "£13 / 年 (确认声明 Confirmation Statement)",
    tax_rate: "小型企业税率 19%（按利润实缴）",
    privacy: "公开透明 (Companies House 公开全部董事信息)",
    bank_account: "极易配合 Wise Business / Revolut Business 开户",
    best_for: "预算极其有限、需要快速拿海外正规公司主体对接 Stripe/PayPal 的个体创业者",
    summary: "设立速度快（数小时下照），成本低到可以忽略不计，但注意董事信息公开且需每年按时做沉寂申报。"
  }
];

export const DISTRIBUTION_DATA = [
  {
    id: "dist_ph",
    name: "Product Hunt",
    type: "launch",
    category_cn: "全球首发主阵地",
    free: true,
    weight: "⭐⭐⭐⭐⭐",
    url: "https://www.producthunt.com",
    tactics: "太平洋时间 00:01 发布；提前 2 周预热 Teaser；准备高品质动图与清晰定价；核心不是当天票数，而是冲进 Top 5 获取次日全球 Newsletter 邮件百万级流量曝光！",
    mistakes: "禁止在微信群求无脑点赞刷票（系统会判定为垃圾流量降权封禁），必须由拥有真实历史活跃账号的全球猎手（Hunter）支持。"
  },
  {
    id: "dist_hn",
    name: "Hacker News (Show HN)",
    type: "community",
    category_cn: "极客工程师大本营",
    free: true,
    weight: "⭐⭐⭐⭐⭐",
    url: "https://news.ycombinator.com",
    tactics: "标题格式严格使用【Show HN: 产品名 – 一句话解决的硬核问题】；不吹嘘空话，直接说开源/技术栈/技术难题；首条自述留言必须坦诚、专业、无营销感。",
    mistakes: "严禁任何形式的刷票自嗨；严禁过度商业化文案；极客用户会无情剖析代码、安全漏洞与隐私政策，必须真诚沟通并迅速修复反馈。"
  },
  {
    id: "dist_reddit",
    name: "Reddit 垂类社区 (Subreddits)",
    type: "community",
    category_cn: "垂直社区渗透",
    free: true,
    weight: "⭐⭐⭐⭐",
    url: "https://www.reddit.com",
    tactics: "主攻 r/SideProject, r/IndieHackers, r/SaaS, r/Entrepreneur 等板块；采用【我是怎么做出来的 + 遇到的 3 个惨痛教训】叙事，提供干货再附带产品链接。",
    mistakes: "直接发推广硬广会被版主（Mod）秒删封号；账号必须有一定 Karma 值积累，回复必须详尽专业。"
  },
  {
    id: "dist_twitter",
    name: "Twitter / X (Build in Public)",
    type: "social",
    category_cn: "公开创业个人 IP",
    free: true,
    weight: "⭐⭐⭐⭐⭐",
    url: "https://x.com",
    tactics: "带 #buildinpublic #indiehackers 标签；每天公开真实数据（MRR、访问量、踩坑反思、退款率）；把整个创业过程当成连续剧演给潜在用户与同行看。",
    mistakes: "不要只发广告，要发有争议的洞见、清晰的架构截图或对比测试视频。"
  },
  {
    id: "dist_directories",
    name: "全球 50+ 免费 AI/SaaS 收录导航站",
    type: "seo_directory",
    category_cn: "高权重反向外链矩阵",
    free: true,
    weight: "⭐⭐⭐⭐",
    url: "TheresAnAIForThat / Futurepedia / Toolify / Uneed / MicroLaunch",
    tactics: "整理统一的英文 Product Name, 80字短描述, 200字长描述, 3张 1200x630 高清截图；批量提交，一次性建立 30+ 优质 DoFollow 反向链接，奠定 Google 域名权重基础。",
    mistakes: "不要花钱买垃圾 SEO 机器外链，只提交高质量、真实有排名的主流垂直目录。"
  }
];

export const STACK_DATA = [
  {
    id: "stk_hosting",
    category: "基础设施与托管",
    chosen: "Cloudflare Pages + Workers",
    free_tier: "无限免费请求流量，全球 300+ 边缘机房 0ms 接入",
    monthly_cost_usd: 0,
    advantage: "真正的零成本抗高并发，不会像传统云服务器那样被恶意刷量刷爆银行卡信用卡。"
  },
  {
    id: "stk_database",
    category: "数据库与认证鉴权",
    chosen: "Supabase (免费版) / Cloudflare D1",
    free_tier: "500MB 免费存储，50,000 月活跃用户 (MAU)，内置 Auth 与实时订阅",
    monthly_cost_usd: 0,
    advantage: "纯正 PostgreSQL，出海随时可迁移；免去自己运维数据库集群与备份的心智开销。"
  },
  {
    id: "stk_email",
    category: "交易与营销邮件",
    chosen: "Resend / Amazon SES",
    free_tier: "Resend 免费 3,000 封/月；Amazon SES 每万封仅 $1.00",
    monthly_cost_usd: 0,
    advantage: "开发者友好，送达率高，支持 React Email 现代化排版，不花冤枉钱买昂贵 SaaS。"
  },
  {
    id: "stk_analytics",
    category: "网站分析与埋点",
    chosen: "PostHog (开源托管版) / Umami",
    free_tier: "每月免费赠送 1,000,000 事件 (Events) 追踪与录屏回放",
    monthly_cost_usd: 0,
    advantage: "满足欧洲 GDPR 隐私合规，无需在页面上弹出烦人的全屏 Cookie 授权条。"
  },
  {
    id: "stk_feedback",
    category: "用户反馈与支持",
    chosen: "Formbricks / 自建在线直达信箱",
    free_tier: "完全免费无限制",
    monthly_cost_usd: 0,
    advantage: "直接将用户原声和报错归档至数据库与站长邮箱，闭环产品快速迭代。"
  }
];

export const SHIP_RULES = [
  {
    num: 1,
    title: "分发优先于代码 (Distribution Before Code)",
    desc: "在写下一行代码前，先确保知道前 100 个付费客户在哪。先做一个极简落地页或预热推特，如果连 10 个有效邮箱意向都拿不到，代码写得再优雅也是空转。"
  },
  {
    num: 2,
    title: "尽早收费，不要自欺欺人做免费善人",
    desc: "免费用户的夸奖毫无意义，只有真金白银刷卡买单才是唯一可靠的产品需求验证（PMF）。从 Day 1 就挂出价格表，宁愿只有 3 个月付客户，也不要 3000 个白嫖用户。"
  },
  {
    num: 3,
    title: "控制固定月费，保持极低的死亡线",
    desc: "一人公司的生命力在于低成本试错。充分利用 Cloudflare、Supabase 等全球免费额度，将每月服务器固定账单压缩在 $0–$20 以内，这样你可以存活三年慢慢等风来。"
  },
  {
    num: 4,
    title: "深耕小众利基（Niche），做大厂看不上的池塘霸主",
    desc: "不要尝试做下一个 Google 或 Notion。寻找一个特定人群痛点（如'为跨境电商独立站自动生成发票'或'为临床医生一键提取病历摘要'），在这个领域做到第一名即可年入数十万美元。"
  },
  {
    num: 5,
    title: "退款率与反欺诈是出海的第一道死穴",
    desc: "海外信用卡盗刷（Carding）极为普遍。起步必须使用 LemonSqueezy 或开启 Stripe 3DS 强验证，一旦拒付争议率（Dispute Rate）超过 0.9%，商户账户会被连根拔起并列入黑名单。"
  },
  {
    num: 6,
    title: "Build in Public 构建信任壁垒",
    desc: "大公司无法公开脆弱，但独立创业者可以。真实展示研发进度、踩坑挫折和第一个 $10 收入，真诚是抵抗巨头复制和建立忠诚粉丝最稀缺的武器。"
  }
];
