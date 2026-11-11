// functions/_lib/fire_seed.js
// ---------------------------------------------------------------------------
// 全球指数化投资与经典资产配置模型核心数据集 (/fire)
// 包含四大传世资产配置模型、爱尔兰 UCITS vs 美股 ETF 跨境税构图谱与 FIRE 提领法则
// ---------------------------------------------------------------------------

export const PORTFOLIO_MODELS = [
  {
    id: "dalio_all_weather",
    name: "雷·达利欧全天候组合 (Ray Dalio's All Weather)",
    name_en: "All Weather Portfolio",
    badge: "风险平价典范",
    author: "Ray Dalio (Bridgewater Associates)",
    cagr_historical: "7.8% (1973–2025)",
    max_drawdown: "-12.5% (2008 次贷危机仅回撤 -3.9%)",
    sharpe_ratio: "0.72",
    thesis: "任何资产类别在特定经济环境下都会承受剧烈损失。通过平衡对经济增长（高/低）和通货膨胀（高/低）四个象限的风险敞口，实现不依赖预测未来的穿越周期稳定增长。",
    allocations: [
      { asset: "长期美国国债 (20+ 年 TLT / IDTL)", weight: 40, role: "通货紧缩与经济衰退时的强劲避险压舱石" },
      { asset: "全美/全球宽基股票 (VTI / CSPX)", weight: 30, role: "经济超预期繁荣与企业利润扩张时的收益引擎" },
      { asset: "中期美国国债 (7-10 年 IEF / CBU0)", weight: 15, role: "降低波动率、提供流动性与再平衡资金源" },
      { asset: "实物黄金 (GLD / SGLN)", weight: 7.5, role: "恶性通货膨胀、货币购买力贬值与地缘极端动荡护城河" },
      { asset: "大宗商品商品指数 (DBC / GSG)", weight: 7.5, role: "原材料供给冲击与成本推动型通胀爆发时的价格上涨补偿" }
    ],
    rebalance_rule: "每年固定一次再平衡，或任意资产权重偏离目标 > 5% 时动态再平衡。",
    best_for: "极度厌恶本金大幅回撤、追求稳健被动复利、已累积相当本金的中产家庭与退休初期人群。"
  },
  {
    id: "permanent_portfolio",
    name: "哈利·布朗永久投资组合 (Harry Browne's Permanent Portfolio)",
    name_en: "Permanent Portfolio",
    badge: "数学极简对称",
    author: "Harry Browne (1981)",
    cagr_historical: "6.9% (1970–2025)",
    max_drawdown: "-14.2% (近50年极罕见连亏)",
    sharpe_ratio: "0.68",
    thesis: "宏观经济只存在四种基本状态：繁荣、通胀、紧缩、衰退。各配置 25% 四大资产，彼此呈现强负相关或非相关性，无论发生任何金融海啸，总有某项资产在飙升覆盖其余损失。",
    allocations: [
      { asset: "宽基成长股票 (标普500 / VOO / CSPX)", weight: 25, role: "繁荣期爆发点，捕获人类商业文明增长" },
      { asset: "超长期美国国债 (TLT / IDTL)", weight: 25, role: "通缩与萧条期表现最佳，降息带来巨额资本利得" },
      { asset: "实物金条/黄金 ETF (GLD / SGLN)", weight: 25, role: "恶性滞胀期主力，法币信用破产的终极避难所" },
      { asset: "现金 / 1-3个月超短债 (BIL / SGOV)", weight: 25, role: "衰退期提供坚实安全垫，暴跌时拥有绝对廉价筹码再平衡" }
    ],
    rebalance_rule: "宽带触发制：当某资产比重突破 35% 或跌破 15% 时触发再平衡恢复至 25% 对称态。",
    best_for: "极简主义者、无暇盯盘的工程师、不愿花费心力研究财报但要求资产永续不灭的投资者。"
  },
  {
    id: "bogleheads_3_fund",
    name: "约翰·博格尔三基金组合 (Bogleheads 3-Fund Portfolio)",
    name_en: "Bogleheads 3-Fund Portfolio",
    badge: "指数投资圣经",
    author: "John C. Bogle (The Vanguard Group)",
    cagr_historical: "9.2% (1975–2025)",
    max_drawdown: "-35.4% (2008年曾发生显著回撤)",
    sharpe_ratio: "0.61",
    thesis: "不要试图在草堆里找一根针，买下整个草堆！以接近于零的管理费率（<0.05%），通过三只低成本宽基指数基金买下全球资本市场全部股票与投资级债券，杜绝任何主动管理经理的高昂中介抽水。",
    allocations: [
      { asset: "本国/全美全市场股票 (VTI / CSPX)", weight: 50, role: "分享全球核心商业企业盈利增长的主动力" },
      { asset: "国际除美全市场股票 (VXUS / EXUS)", weight: 30, role: "对冲单一国家货币贬值与主权宏观地缘风险" },
      { asset: "全市场综合投资级债券 (BND / AGGH)", weight: 20, role: "压低剧烈回撤斜率，提供现金分红再投资" }
    ],
    rebalance_rule: "通过每月新增定投资金流优先补充欠配资产，避免卖出产生资本利得税。",
    best_for: "长期财富累积期（20-45岁年轻人群）、高储蓄率职场人、深信人类长期生产力向上的价值投资派。"
  },
  {
    id: "golden_butterfly",
    name: "黄金蝴蝶组合 (Golden Butterfly Portfolio)",
    name_en: "Golden Butterfly Portfolio",
    badge: "改良版高胜率",
    author: "Tyler (Portfolio Charts)",
    cagr_historical: "8.1% (1970–2025)",
    max_drawdown: "-15.8% (历史最长恢复期仅 2.3 年)",
    sharpe_ratio: "0.76",
    thesis: "在哈利·布朗永久组合的基础上引入‘小型价值股（Small Cap Value）’引擎。既保留了抗衡经济灾难的坚固黄金与长期国债防线，又借助小盘价值因子的历史长期风险溢价大幅提振复合年化收益率。",
    allocations: [
      { asset: "大盘核心股票 (VOO / CSPX)", weight: 20, role: "稳健的大市值全球龙头利润分红" },
      { asset: "小盘价值股票 (VBR / AVUV)", weight: 20, role: "法玛-弗兰奇三因子长期超额风险溢价" },
      { asset: "长期国债 (TLT / IDTL)", weight: 20, role: "通缩危机与流动性休克时的对冲主力" },
      { asset: "短期国债 (SHY / SGOV)", weight: 20, role: "抗加息冲击的绝对安全流动性源泉" },
      { asset: "实物黄金 (GLD / SGLN)", weight: 20, role: "通胀失控与信用货币购买力对冲" }
    ],
    rebalance_rule: "每年末根据目标权重 20% 均匀度触发再平衡。",
    best_for: "追求比永久组合更高复合增速、同时要求极短回撤修复期的中期稳健投资者。"
  }
];

export const ETF_TAX_EFFICIENCY = [
  {
    id: "sp500",
    category: "标普500 (S&P 500)",
    us_etf: "VOO (Vanguard S&P 500 ETF)",
    us_expense: "0.03%",
    us_domicile: "美国 (US)",
    us_withholding_tax: "30% (无条约国) / 10% (中美租税协定)",
    us_estate_tax_risk: "高危！超过 $60,000 美元资产面临最高 40% 美国联邦遗产税！",
    ucits_etf: "CSPX (iShares) / VUAA (Vanguard)",
    ucits_expense: "0.07%",
    ucits_domicile: "爱尔兰 (Ireland)",
    ucits_withholding_tax: "15% (爱尔兰-美国协定，直接在基金内部代扣扣除)",
    ucits_dividend_type: "累积型 (Accumulating - 股息自动零损耗内部再投资)",
    ucits_advantage: "彻底免除美国遗产税风险；非美居民无需每年就分红申报繁琐报税；15% 协定税率直接锁定。"
  },
  {
    id: "all_world",
    category: "全球全市场股票 (All-World Equities)",
    us_etf: "VT (Vanguard Total World Stock)",
    us_expense: "0.07%",
    us_domicile: "美国 (US)",
    us_withholding_tax: "30% 股息预扣税 (非美居民)",
    us_estate_tax_risk: "高危！受美国遗产税管辖。",
    ucits_etf: "VWRA (Vanguard FTSE All-World) / FWRA (Invesco)",
    ucits_expense: "0.15% / 0.22%",
    ucits_domicile: "爱尔兰 (Ireland)",
    ucits_withholding_tax: "内部优化多边协定税率",
    ucits_dividend_type: "累积型 (自动买入全球 4000+ 家上市公司)",
    ucits_advantage: "真正一键持有全球经济增长；无须手动再平衡；免美国遗产税；终生持有一只基金即可退休。"
  },
  {
    id: "nasdaq100",
    category: "纳斯达克100科技龙头 (Nasdaq-100)",
    us_etf: "QQQ (Invesco QQQ Trust)",
    us_expense: "0.20%",
    us_domicile: "美国 (US)",
    us_withholding_tax: "30% / 10% 股息预扣税",
    us_estate_tax_risk: "高危！受美国遗产税管辖。",
    ucits_etf: "CNDX (iShares Nasdaq 100) / EQQQ (Invesco)",
    ucits_expense: "0.30%",
    ucits_domicile: "爱尔兰 (Ireland)",
    ucits_withholding_tax: "15% 美股股息优惠预扣税",
    ucits_dividend_type: "累积型 (股息直接复利注入基金净值)",
    ucits_advantage: "免除分红派发换汇损失；离岸资产隔离保护；杜绝跨国遗产冻结纠纷。"
  },
  {
    id: "gold",
    category: "实物现货黄金 (Physical Gold)",
    us_etf: "GLD (SPDR Gold Shares) / IAU (iShares Gold)",
    us_expense: "0.40% / 0.25%",
    us_domicile: "美国 (US)",
    us_withholding_tax: "无分红 (无预扣税)",
    us_estate_tax_risk: "仍属于美国属地资产（US-situs asset），超额触发遗产税！",
    ucits_etf: "SGLN (iShares Physical Gold ETC) / 4GLD (Xetra-Gold)",
    ucits_expense: "0.12%",
    ucits_domicile: "爱尔兰 / 英国 (ETC)",
    ucits_withholding_tax: "0% (不涉及股息)",
    ucits_dividend_type: "伦敦金库 100% 对应实物金条托管",
    ucits_advantage: "费率比 GLD 便宜近 70%（仅 0.12%）；物理金库位于英国与欧洲；完全脱离美国司法长臂管辖。"
  }
];

export const FIRE_METHODOLOGY = [
  {
    rule: "Trinity Study 4% 安全提领率 (Safe Withdrawal Rate, SWR)",
    desc: "1998 年由美国三一大学三位金融学教授提出：在 50/50 股债组合下，退休首年提领总净资产的 4%，其后每年按通货膨胀率上调提领金额，在历史长达 30 年的退休周期中，本金耗尽归零的概率低于 5%。",
    formula: "FIRE 目标本金 = 年度支出 × 25 (对应 4% 提领率) 或 年度支出 × 30 (对应 3.33% 极其保守提领率)"
  },
  {
    rule: "动态提领护栏法则 (Guyton-Klinger Guardrails)",
    desc: "当遭遇连续熊市大跌导致当前提领率上升超过上限阈值（如 > 5.5%）时，当年主动缩减生活支出 10%；反之当牛市暴涨提领率跌破下限（如 < 3.2%）时，允许追加年度享乐开支。动态适应市场，大幅提振安全边界至 99.9%。",
    formula: "在经济大下行年份放弃通胀调整，避免熊市被迫在底部割肉变现持仓。"
  },
  {
    rule: "储蓄率决定自由时间 (Shockingly Simple Math of Early Retirement)",
    desc: "达成财务自由的关键不是你赚多少钱，而是你的储蓄率（储蓄占税后收入的百分比）。因为高储蓄率意味着双重杠杆：你每月只需要更低的生活开支来维持满足感，同时拥有更多本金快速复利膨胀。",
    formula: "储蓄率 10% → 需工作 51 年；储蓄率 30% → 需工作 28 年；储蓄率 50% → 需工作 17 年；储蓄率 70% → 仅需 8.5 年达成 FIRE！"
  }
];
