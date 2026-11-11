// functions/_lib/opensource_seed.js
// ---------------------------------------------------------------------------
// 全球顶级商业软件高质量开源替代 & 大模型降维重构全景图谱种子库
// 覆盖：协同办公、开发运维、自动化流程、设计创作、智能客服、营销计费等
// 突出：开源自托管 (Self-Hosted) 与大模型/Agent 对传统 SaaS 订阅费的降维打击
// ---------------------------------------------------------------------------

export const OPENSOURCE_SEED = [
  // ==========================================
  // 1. 协同办公与知识库 (Productivity & Notes)
  // ==========================================
  {
    id: "oss_notion",
    name_cn: "Notion 全能工作台与知识库",
    target_software: "Notion",
    vendor: "Notion Labs",
    category: "productivity",
    category_cn: "协同办公与知识库",
    pricing_usd_month: 12,
    pricing_desc: "$10–$20 / 席位 / 月 (年付起)",
    pain_points: "数据未端到端加密、内网环境无法私有化部署、团队多席位月费随人数线性暴增、离线加载迟钝",
    disruption_type: "hybrid",
    difficulty: "极简",
    offline_support: true,
    estimated_yearly_saving_usd: 144,
    alternatives: [
      {
        name: "AppFlowy",
        repo: "AppFlowy-IO/AppFlowy",
        stars: "57k+",
        license: "AGPL-3.0",
        tech_stack: "Flutter + Rust",
        desc: "顶级高颜值类 Notion 离线优先应用，100% 数据本地掌控，已内置本地与云端 AI 助手支持。",
        one_click_cmd: "docker run -d -p 8000:8000 appflowyinc/appflowy_cloud:latest"
      },
      {
        name: "AFFiNE",
        repo: "toeverything/AFFiNE",
        stars: "45k+",
        license: "MIT",
        tech_stack: "Rust + TypeScript",
        desc: "真正的下一代知识操作系统：融合画布（Whiteboard）、页面（Page）与表格的多维无限画布。",
        one_click_cmd: "docker run -d -p 3010:3010 ghcr.io/toeverything/affine-graphql:stable"
      },
      {
        name: "Obsidian + 本地 Markdown",
        repo: "obsidianmd",
        stars: "N/A",
        license: "免费个人商用",
        tech_stack: "纯本地 Markdown 文件树",
        desc: "纯本地纯文本生态，配合 Git/Syncthing 实现零成本多端同步，永不担心服务商倒闭跑路。",
        one_click_cmd: "无需容器，官网下载直接打开本地目录即可使用"
      }
    ],
    llm_disruption: {
      is_disrupted: true,
      level: 5,
      thesis: "Notion 本质是卡片与块级 Markdown 的渲染壳。大模型时代，本地知识库完全由本地 Embedding 向量检索 + DeepSeek/Claude API 直接接管，无需月付数十美金买其捆绑的受限 AI 插件。",
      ai_alternative_solution: "采用 Obsidian / VSCode + Continue / Local LLM (Ollama) + Copilot 插件，结合本地自然语言问答，性能秒杀云端 Notion AI 且成本归零。"
    }
  },
  {
    id: "oss_airtable",
    name_cn: "Airtable 多维表格与轻应用",
    target_software: "Airtable",
    vendor: "Formagrid Inc.",
    category: "productivity",
    category_cn: "协同办公与知识库",
    pricing_usd_month: 24,
    pricing_desc: "$20–$45 / 席位 / 月",
    pain_points: "行数限制极其严苛（免费/入门版仅数千行即被锁死）、API 调用限流频繁、商业大团队坐席费昂贵",
    disruption_type: "hybrid",
    difficulty: "中等",
    offline_support: true,
    estimated_yearly_saving_usd: 288,
    alternatives: [
      {
        name: "NocoDB",
        repo: "nocodb/nocodb",
        stars: "46k+",
        license: "AGPL-3.0",
        tech_stack: "Node.js + Vue",
        desc: "将任何现有的 MySQL / Postgres 数据库瞬间转换成类似 Airtable 的智能多维表格界面，支持百万级行数。",
        one_click_cmd: "docker run -d -p 8080:8080 nocodb/nocodb:latest"
      },
      {
        name: "Teable",
        repo: "teableio/teable",
        stars: "14k+",
        license: "AGPL-3.0",
        tech_stack: "PostgreSQL + TypeScript",
        desc: "具备超强性能的高颜值实时协同表格，底层完全基于标准 Postgres 存储，无数据行数硬限制。",
        one_click_cmd: "curl -fsSL https://teable.io/install.sh | bash"
      },
      {
        name: "Baserow",
        repo: "bramw/baserow",
        stars: "10k+",
        license: "MIT",
        tech_stack: "Python + Django + Nuxt",
        desc: "模块化无代码数据库，自带完善的 REST API 与 Webhook 触发器，被众多欧洲企业作为合规替代首选。",
        one_click_cmd: "docker run -d -p 80:80 -v baserow_data:/baserow/data baserow/baserow:1.24.2"
      }
    ],
    llm_disruption: {
      is_disrupted: true,
      level: 4,
      thesis: "以往多维表格复杂的数据清洗和跨表联动公式，现在可以直接用大模型编写几行 Python/SQL 脚本自动搞定，不再依赖昂贵 SaaS 的黑盒公式引擎。",
      ai_alternative_solution: "使用 Supabase/Postgres + AI Agent 直接通过自然语言生成结构化查询与可视化图表，摆脱 Airtable 昂贵的高级工作流计费。"
    }
  },
  {
    id: "oss_google_docs",
    name_cn: "Microsoft 365 / Google Workspace 在线文档",
    target_software: "Office 365 / Google Workspace",
    vendor: "Microsoft / Google",
    category: "productivity",
    category_cn: "协同办公与知识库",
    pricing_usd_month: 12,
    pricing_desc: "$6–$18 / 用户 / 月",
    pain_points: "多用户订阅长期累积开销巨大、跨境访问受阻、企业敏感数据必须上传至第三方服务器",
    disruption_type: "oss",
    difficulty: "中等",
    offline_support: true,
    estimated_yearly_saving_usd: 144,
    alternatives: [
      {
        name: "OnlyOffice",
        repo: "ONLYOFFICE/DocumentServer",
        stars: "16k+",
        license: "AGPL-3.0",
        tech_stack: "C++ / JS",
        desc: "与微软 MS Office 格式（docx/xlsx/pptx）兼容度最高的自建协作办公套件，支持多人实时批注修改。",
        one_click_cmd: "docker run -i -t -d -p 80:80 onlyoffice/documentserver"
      },
      {
        name: "CryptPad",
        repo: "cryptpad/cryptpad",
        stars: "6k+",
        license: "AGPL-3.0",
        tech_stack: "Node.js (端到端加密)",
        desc: "端到端零知识加密协作套件，服务器管理员也无法解密内容，极致保护隐私与商业机密。",
        one_click_cmd: "docker run -d -p 3000:3000 cryptpad/cryptpad:latest"
      }
    ],
    llm_disruption: {
      is_disrupted: true,
      level: 4,
      thesis: "海量商务文书、汇报 PPT、总结摘要的生产正在从手工打字彻底转变为由 AI Agent 自动搜集数据并批量排版直出，人工在文档编辑器里的停留时长大幅缩短。",
      ai_alternative_solution: "本地运行开源大模型搭配 Python-docx / Marp 脚本，一句话将文字提纲直接转为精美幻灯片与 PDF，大幅减少昂贵 Office 套件席位购买。"
    }
  },

  // ==========================================
  // 2. 自动化与集成编排 (Automation & AI Disruption)
  // ==========================================
  {
    id: "ai_zapier",
    name_cn: "Zapier / Make 自动化流程连接器",
    target_software: "Zapier / Make",
    vendor: "Zapier Inc. / Celonis",
    category: "automation",
    category_cn: "自动化与流程连接",
    pricing_usd_month: 49,
    pricing_desc: "$29.99–$299+ / 月 (按 Task 任务执行次数计费)",
    pain_points: "执行任务量超额后费用暴涨、复杂的条件逻辑极其繁琐、网络断连后排错黑盒",
    disruption_type: "hybrid",
    difficulty: "极简",
    offline_support: true,
    estimated_yearly_saving_usd: 588,
    alternatives: [
      {
        name: "n8n",
        repo: "n8n-io/n8n",
        stars: "52k+",
        license: "Fair-code (自建免费)",
        tech_stack: "Node.js + TypeScript",
        desc: "全球最强大的自建自动化神器，支持 400+ 开箱即用节点，无任务执行次数上限，原生集成 LangChain 与 AI Agent 节点。",
        one_click_cmd: "docker run -d --name n8n -p 5678:5678 -v n8n_data:/home/node/.n8n n8nio/n8n"
      },
      {
        name: "Activepieces",
        repo: "activepieces/activepieces",
        stars: "11k+",
        license: "MIT",
        tech_stack: "TypeScript",
        desc: "Zapier 的极简开源复刻，完全基于 MIT 协议，轻量简洁，界面设计现代直观。",
        one_click_cmd: "docker run -d -p 8080:80 activepieces/activepieces"
      }
    ],
    llm_disruption: {
      is_disrupted: true,
      level: 5,
      thesis: "【大模型降维打击标杆】以前需要通过 Zapier 繁琐拖拽 10 个节点把 A 系统数据洗给 B 系统；现在通过 MCP (Model Context Protocol) 或单个通用大模型 Agent，一段自然语言指令即可直接调度多端 API 闭环，传统收费按次计费的低代码集成器完全丧失护城河！",
      ai_alternative_solution: "在本地部署 n8n 或直接使用 Anthropic Claude Desktop + MCP 协议工具箱，用自然语言让 Agent 自动读写 Gmail、GitHub、Notion 和数据库，彻底取消每月 $50+ 的 Zapier 账单。"
    }
  },

  // ==========================================
  // 3. AI 写作与内容生成 (AI SaaS Disruption)
  // ==========================================
  {
    id: "ai_jasper",
    name_cn: "Jasper.ai / Copy.ai 营销文案 SaaS",
    target_software: "Jasper.ai / Copy.ai",
    vendor: "Jasper AI Inc.",
    category: "ai_tools",
    category_cn: "AI 与写作生产力",
    pricing_usd_month: 49,
    pricing_desc: "$39–$69 / 月 (单席位)",
    pain_points: "本质是套壳 OpenAI API 加上几个预设模板，但在前台收取用户 20~50 倍的溢价；对非英文生成质量平庸",
    disruption_type: "ai",
    difficulty: "极简",
    offline_support: false,
    estimated_yearly_saving_usd: 588,
    alternatives: [
      {
        name: "DeepSeek R1 / V3 直接调用",
        repo: "deepseek-ai/DeepSeek-V3",
        stars: "开源权重",
        license: "MIT",
        tech_stack: "API / 本地端侧推理",
        desc: "性能匹敌顶级闭源模型的划时代大模型，API 价格仅为传统海外模型的几十分之一，文案生成质量超越套壳 SaaS。",
        one_click_cmd: "curl https://api.deepseek.com/chat/completions"
      },
      {
        name: "LobeChat / LibreChat",
        repo: "lobehub/lobe-chat",
        stars: "53k+",
        license: "MIT",
        tech_stack: "Next.js + TypeScript",
        desc: "极其优雅的高颜值多模型聚合控制台，内置丰富助手市场与知识库，直接绑定自己的 API 密钥即可秒杀任何套壳 SaaS。",
        one_click_cmd: "docker run -d -p 3210:3210 -e OPENAI_API_KEY=sk-xxx lobehub/lobe-chat"
      }
    ],
    llm_disruption: {
      is_disrupted: true,
      level: 5,
      thesis: "【套壳 SaaS 灭亡史】传统 AI 写作工具毫无技术壁垒。用户只需掌握结构化 Prompt（如角色设定、Few-Shot 示例、目标受众与输出约束），直接向基座大模型提问即可获得质量高 10 倍且零溢价的内容。",
      ai_alternative_solution: "直接使用 DeepSeek / Claude 3.5 编写高质量营销长文、SEO 博客与社交推文，每月成本不到 $1（按 Token 实际用量计费），省下原本每年近 $600 的套壳订阅费。"
    }
  },
  {
    id: "ai_grammarly",
    name_cn: "Grammarly 英文语法修饰与润色",
    target_software: "Grammarly Premium",
    vendor: "Grammarly Inc.",
    category: "ai_tools",
    category_cn: "AI 与写作生产力",
    pricing_usd_month: 30,
    pricing_desc: "$12–$30 / 月",
    pain_points: "规则死板，经常误报学术或技术专业词汇；上传整篇文章存在知识产权被收集的隐私风险；高级风格重写收费极贵",
    disruption_type: "ai",
    difficulty: "极简",
    offline_support: true,
    estimated_yearly_saving_usd: 360,
    alternatives: [
      {
        name: "Llama-3 / Qwen 本地一键润色",
        repo: "ollama/ollama",
        stars: "115k+",
        license: "MIT",
        tech_stack: "Ollama + 本地模型",
        desc: "在个人电脑（Mac/PC）完全离线运行小参数大模型，数据永不上云，一键校对语法与学术语调。",
        one_click_cmd: "ollama run qwen2.5:7b"
      },
      {
        name: "LanguageTool",
        repo: "languagetool-org/languagetool",
        stars: "13k+",
        license: "LGPL-2.1",
        tech_stack: "Java",
        desc: "全球最著名的多语言开源校对引擎，支持德语、英语、法语等 30+ 种语言，支持自建私有服务器与浏览器插件联动。",
        one_click_cmd: "docker run -d -p 8010:8010 erikvl87/languagetool"
      }
    ],
    llm_disruption: {
      is_disrupted: true,
      level: 5,
      thesis: "大模型拥有数千亿 Token 的语感训练，对语境、双关、专业术语和学术行文的理解远超传统基于规则库的语法纠错器，且能按照要求转换不同语气风格。",
      ai_alternative_solution: "配合自定义 Prompt（例如：'请按顶会 IEEE 规范纠正以下段落的时态与搭配，并指出 3 处修改理由'），大模型输出效果完胜 Grammarly 昂贵套餐。"
    }
  },
  {
    id: "ai_deepl",
    name_cn: "DeepL Pro / Google Translate 商业翻译",
    target_software: "DeepL Pro / Google Cloud Translation",
    vendor: "DeepL SE / Google",
    category: "ai_tools",
    category_cn: "AI 与写作生产力",
    pricing_usd_month: 25,
    pricing_desc: "$8.74–$57.49 / 月 (或按百万字符计费)",
    pain_points: "字数限制门槛、API 计费门槛高、专业领域术语缺乏上下文联想",
    disruption_type: "hybrid",
    difficulty: "极简",
    offline_support: true,
    estimated_yearly_saving_usd: 300,
    alternatives: [
      {
        name: "Qwen2.5 / DeepSeek 语境翻译",
        repo: "QwenLM/Qwen2.5",
        stars: "开源权重",
        license: "Apache-2.0",
        tech_stack: "端侧 / API",
        desc: "中文、日文与英语等跨语言互译极其地道，能精确理解网络梗、成语与学术缩写。",
        one_click_cmd: "ollama run qwen2.5:7b"
      },
      {
        name: "LibreTranslate",
        repo: "LibreTranslate/LibreTranslate",
        stars: "8k+",
        license: "AGPL-3.0",
        tech_stack: "Python + Argos Translate",
        desc: "100% 自托管、无任何第三方追踪的自由机器翻译引擎，开箱即提供标准 REST API 接口。",
        one_click_cmd: "docker run -ti -p 5000:5000 libretranslate/libretranslate"
      }
    ],
    llm_disruption: {
      is_disrupted: true,
      level: 4,
      thesis: "现代大模型本质就是天然的万能翻译器。它不仅做逐词翻译，更是先理解上下文逻辑再用目标语言重新表达（甚至能一步完成'信达雅'润色），传统 NMT 翻译工具已无护城河。",
      ai_alternative_solution: "在本地使用沉浸式翻译插件绑定本地 Ollama 或自购 API，全网网页与长文档无限量免费翻译，零隐私泄露风险。"
    }
  },

  // ==========================================
  // 4. 设计、UI与多媒体 (Design & Media)
  // ==========================================
  {
    id: "oss_figma",
    name_cn: "Figma 团队协同设计与原型",
    target_software: "Figma Professional / Organization",
    vendor: "Figma Inc.",
    category: "design",
    category_cn: "设计与创意媒体",
    pricing_usd_month: 15,
    pricing_desc: "$12–$75 / 设计师 / 月 (年付起)",
    pain_points: "非设计岗位仅查看/交互也要收昂贵坐席费、云端封闭格式、中国大陆偶发网络连接卡顿",
    disruption_type: "hybrid",
    difficulty: "中等",
    offline_support: true,
    estimated_yearly_saving_usd: 180,
    alternatives: [
      {
        name: "Penpot",
        repo: "penpot/penpot",
        stars: "34k+",
        license: "MPL-2.0",
        tech_stack: "Clojure + Rust",
        desc: "全球第一款真正意义上的全开源类 Figma 团队设计工具，原生基于标准 SVG 与 CSS Flex/Grid 布局，设计师设计完即是前端代码标准。",
        one_click_cmd: "curl -fsSL https://raw.githubusercontent.com/penpot/penpot/main/docker/docker-compose.yaml -o docker-compose.yaml && docker compose up -d"
      }
    ],
    llm_disruption: {
      is_disrupted: true,
      level: 4,
      thesis: "在 v0.dev、Claude Artifacts 与 Cursor 出现前，必须由设计师先在 Figma 画出线框稿再交给前端切图；现在独立开发者输入自然语言，AI 直接直出高质量 Tailwind / React 前端响应式代码，绕过了中间漫长的 Figma 原型绘制环节！",
      ai_alternative_solution: "配合 Penpot 开源自建做宏观品牌视觉资产，界面交互与原型直接通过 AI 代码直出（v0 / Bolt.new），团队省去多个 Figma 付费席位。"
    }
  },
  {
    id: "oss_canva",
    name_cn: "Canva 可画 / 营销海报设计",
    target_software: "Canva Pro",
    vendor: "Canva Pty Ltd",
    category: "design",
    category_cn: "设计与创意媒体",
    pricing_usd_month: 13,
    pricing_desc: "$12.99 / 月 (单席位)",
    pain_points: "核心高品质素材全部锁死在 Pro 订阅后、排版模板同质化严重、品牌资源包导出受限",
    disruption_type: "hybrid",
    difficulty: "极简",
    offline_support: true,
    estimated_yearly_saving_usd: 156,
    alternatives: [
      {
        name: "Polotno Studio",
        repo: "polotno-project/polotno-studio",
        stars: "2.5k+",
        license: "开源 SDK",
        tech_stack: "React + Konva",
        desc: "轻量干净无广告的在线海报与图形设计工具，开箱即用，支持一键导出高清 PNG/PDF。",
        one_click_cmd: "无需注册，网页打开即用或通过 npm 快速私有化嵌入"
      },
      {
        name: "FLUX.1 / Midjourney 替代配图",
        repo: "black-forest-labs/flux",
        stars: "开源模型",
        license: "Apache-2.0",
        tech_stack: "ComfyUI / 本地端侧",
        desc: "顶级开源图像生成基座，无论是写实摄影、3D 图标还是现代插画，质量远胜传统 Canva 图库。",
        one_click_cmd: "通过 ComfyUI 一键拉取 FLUX.1 权重本地运行"
      }
    ],
    llm_disruption: {
      is_disrupted: true,
      level: 5,
      thesis: "以往在 Canva 翻找半小时平庸素材，现在通过 FLUX.1 等生成式 AI 只需输入 1 句话，3 秒定制出像素级契合文章主题的独家无版权高清封面图。",
      ai_alternative_solution: "使用开源 FLUX.1 + 自动排版开源脚本，秒级批量生成公众号/推特/小红书营销配图，成本为 0 且避免侵权纠纷。"
    }
  },

  // ==========================================
  // 5. 研发管理与协作 (Dev & Project Mgmt)
  // ==========================================
  {
    id: "oss_jira",
    name_cn: "Jira / Trello 敏捷研发与看板管理",
    target_software: "Jira Software",
    vendor: "Atlassian",
    category: "dev_ops",
    category_cn: "研发与项目管理",
    pricing_usd_month: 16,
    pricing_desc: "$8.50–$16+ / 用户 / 月",
    pain_points: "配置庞杂笨重、页面加载极其缓慢（'Jira 迟钝综合征'）、小团队被迫购买昂贵全家桶",
    disruption_type: "oss",
    difficulty: "中等",
    offline_support: true,
    estimated_yearly_saving_usd: 192,
    alternatives: [
      {
        name: "Plane",
        repo: "makeplane/plane",
        stars: "34k+",
        license: "Apache-2.0",
        tech_stack: "Python + Next.js",
        desc: "公认最现代、高颜值的开源项目管理工具（被称为开源界 Linear），极速丝滑，支持看板、敏捷周期与时间轴。",
        one_click_cmd: "curl -fsSL https://raw.githubusercontent.com/makeplane/plane/master/deploy/selfhost/install.sh | bash"
      },
      {
        name: "Taiga",
        repo: "taigaio/taiga-front",
        stars: "6.5k+",
        license: "MPL-2.0",
        tech_stack: "Python + AngularJS",
        desc: "专为敏捷团队量身定制的免费开源敏捷工具，支持完整的 Scrum 与 Kanban 流程管理。",
        one_click_cmd: "git clone https://github.com/taigaio/taiga-docker.git && cd taiga-docker && ./launch-all.sh"
      },
      {
        name: "Focalboard",
        repo: "mattermost/focalboard",
        stars: "21k+",
        license: "AGPL-3.0",
        tech_stack: "Go + TypeScript",
        desc: "Mattermost 旗下的开源 Trello / Notion Board 替代品，极致轻巧，单二进制文件即可秒开运行。",
        one_click_cmd: "docker run -d -it -p 8000:8000 mattermost/focalboard"
      }
    ],
    llm_disruption: {
      is_disrupted: true,
      level: 4,
      thesis: "现代敏捷管理的核心是代码和 Issue 的自然演进。通过 GitHub Issues + AI 自动化 Agent（如 GitHub Copilot Workspace / SWE-Agent），需求从文字自动拆解成 PR，无需在繁复的 Jira 流程中消耗工程师生命。",
      ai_alternative_solution: "结合 Plane 开源版 + 自动化 AI PR 审查机器人，实现极简敏捷迭代，节省成千上万美元的 Atlassian 许可证费用。"
    }
  },
  {
    id: "oss_slack",
    name_cn: "Slack 团队企业即时通讯",
    target_software: "Slack Pro / Business+",
    vendor: "Salesforce",
    category: "communication",
    category_cn: "通讯与团队协作",
    pricing_usd_month: 12.5,
    pricing_desc: "$7.25–$12.50 / 用户 / 月",
    pain_points: "免费版仅保留 90 天历史消息（历史讨论直接变黑洞）、无法本地私有化、敏感金融/技术机密暴露",
    disruption_type: "oss",
    difficulty: "中等",
    offline_support: true,
    estimated_yearly_saving_usd: 150,
    alternatives: [
      {
        name: "Mattermost",
        repo: "mattermost/mattermost",
        stars: "31k+",
        license: "MIT / Fair-code",
        tech_stack: "Go + React",
        desc: "全球应用最广泛的企业级 Slack 开源替代品，安全级别高，支持无限历史消息存储与高并发自建。",
        one_click_cmd: "docker run -d --name mattermost -p 8065:8065 mattermost/mattermost-team-edition"
      },
      {
        name: "Zulip",
        repo: "zulip/zulip",
        stars: "22k+",
        license: "Apache-2.0",
        tech_stack: "Python + Django",
        desc: "采用独特的独家主题流（Threaded Topics）机制，彻底告别 Slack 的消息刷屏混乱，异步办公神器。",
        one_click_cmd: "curl -O https://raw.githubusercontent.com/zulip/zulip/main/scripts/setup/docker-compose.yml && docker compose up -d"
      }
    ],
    llm_disruption: {
      is_disrupted: true,
      level: 3,
      thesis: "内部群聊工具正在成为各类智能体（Agent）的调度大厅。大模型可以自动汇总每日数十个频道的讨论精粹，并充当 24 小时随叫随到的团队百科助理。",
      ai_alternative_solution: "在自建 Mattermost / Zulip 中挂载本地开源 LLM 机器人，免费享受企业级上下文搜索与群聊自动纪要功能。"
    }
  },
  {
    id: "oss_postman",
    name_cn: "Postman API 调试与团队协同",
    target_software: "Postman",
    vendor: "Postman Inc.",
    category: "dev_ops",
    category_cn: "研发与项目管理",
    pricing_usd_month: 15,
    pricing_desc: "$12–$29 / 成员 / 月 (新版强制云端同步)",
    pain_points: "新版强制要求登录云端账号、API 密钥与内网测试数据被同步至云端、本地离线 Scratchpad 功能被强制废弃",
    disruption_type: "oss",
    difficulty: "极简",
    offline_support: true,
    estimated_yearly_saving_usd: 180,
    alternatives: [
      {
        name: "Bruno",
        repo: "usebruno/bruno",
        stars: "32k+",
        license: "MIT",
        tech_stack: "Node.js (纯本地文件存储)",
        desc: "颠覆 Postman 的现象级神器！请求集合直接保存为纯文本 Bru 文件，可以直接放进 Git 仓库随代码版本管理，零云端绑定。",
        one_click_cmd: "无需容器，官方直接提供全平台客户端下载即用"
      },
      {
        name: "Hoppscotch",
        repo: "hoppscotch/hoppscotch",
        stars: "66k+",
        license: "MIT",
        tech_stack: "Vue + TypeScript",
        desc: "极速轻量的 Web 优先 API 调试工作台，体积只有 Postman 的十分之一，支持 PWA 离线安装。",
        one_click_cmd: "docker run -d -p 3000:3000 hoppscotch/hoppscotch"
      }
    ],
    llm_disruption: {
      is_disrupted: true,
      level: 4,
      thesis: "以往在 Postman 中手动拼装 Headers、Body 和鉴权签名；现在配合 Cursor / Cline，直接把 OpenAPI/Swagger 文档扔给大模型，自动生成完整的单元测试与调用代码，不再依赖繁重 GUI 工具。",
      ai_alternative_solution: "配合 Bruno 开源版 + AI 自动化测试脚本，API 测试集合与代码同步提交 Git，彻底告别 Postman 强制收费云端。"
    }
  },
  {
    id: "oss_datadog",
    name_cn: "Datadog / New Relic 全栈可观测性与监控",
    target_software: "Datadog",
    vendor: "Datadog Inc.",
    category: "dev_ops",
    category_cn: "研发与项目管理",
    pricing_usd_month: 150,
    pricing_desc: "$15/主机起 + $0.10/百万日志 (极易产生意外天价账单)",
    pain_points: "计费极其复杂、流量峰值时日志与指标费用常造成数万美元天价账单、数据必须出境存储",
    disruption_type: "oss",
    difficulty: "专业",
    offline_support: true,
    estimated_yearly_saving_usd: 1800,
    alternatives: [
      {
        name: "SigNoz",
        repo: "SigNoz/signoz",
        stars: "21k+",
        license: "Apache-2.0",
        tech_stack: "ClickHouse + Go + React",
        desc: "基于高性能列式数据库 ClickHouse 构建的开源 Datadog 替代品，原生支持 OpenTelemetry，一站式搞定链路追踪、指标与日志。",
        one_click_cmd: "git clone -b main https://github.com/SigNoz/signoz.git && cd signoz/deploy/ && docker compose up -d"
      },
      {
        name: "Grafana + Prometheus + Loki",
        repo: "grafana/grafana",
        stars: "63k+",
        license: "AGPL-3.0",
        tech_stack: "Go + TypeScript",
        desc: "全球开发者事实上的可观测性黄金标准体系，生态无与伦比，彻底掌控全部服务器与服务性能监控。",
        one_click_cmd: "docker run -d -p 3000:3000 grafana/grafana"
      }
    ],
    llm_disruption: {
      is_disrupted: true,
      level: 3,
      thesis: "大模型可以自动巡检千万条原始日志异常，自动定位根因（Root Cause Analysis）并生成修复 PR，传统按日志行数收费的高价可视化 SaaS 价值被边缘化。",
      ai_alternative_solution: "自建 SigNoz / Grafana + 本地大模型告警分析机器人，大幅削减监控上云预算达 90% 以上。"
    }
  },
  {
    id: "oss_sentry",
    name_cn: "Sentry 错误跟踪与性能监控",
    target_software: "Sentry Cloud",
    vendor: "Functional Software Inc.",
    category: "dev_ops",
    category_cn: "研发与项目管理",
    pricing_usd_month: 26,
    pricing_desc: "$26–$80+ / 月 (按事件量阶梯加价)",
    pain_points: "异常风暴（Bug 狂抛错误）时配额秒被刷爆并产生昂贵账单、自建官方 Sentry 配置极其消耗服务器内存（至少需要 8-16G RAM）",
    disruption_type: "oss",
    difficulty: "中等",
    offline_support: true,
    estimated_yearly_saving_usd: 312,
    alternatives: [
      {
        name: "GlitchTip",
        repo: "glitchtip/glitchtip",
        stars: "6k+",
        license: "MIT",
        tech_stack: "Python + Django + Postgres",
        desc: "极简轻量级开源 Sentry 替代方案！100% 兼容 Sentry 的所有客户端 SDK，只需 512MB 内存即可轻快跑起来。",
        one_click_cmd: "curl -fsSL https://gitlab.com/glitchtip/glitchtip/raw/master/docker-compose.yml -o docker-compose.yml && docker compose up -d"
      }
    ],
    llm_disruption: {
      is_disrupted: true,
      level: 4,
      thesis: "以往在监控台看到堆栈报错后依然需要人工回溯代码排查；现在结合 LLM，系统报错捕获后直接连同上下文自动交由大模型生成修复 Diff，大幅减少在排错平台上的停留时间。",
      ai_alternative_solution: "使用极简 GlitchTip 捕获错误，配合 GitHub Action 调用 DeepSeek 自动在 PR 中回复错误成因和补丁代码。"
    }
  },

  // ==========================================
  // 6. 客户支持与营销 (Support & Marketing)
  // ==========================================
  {
    id: "ai_intercom",
    name_cn: "Intercom / Zendesk 智能在线客服与机器人",
    target_software: "Intercom / Zendesk",
    vendor: "Intercom Inc.",
    category: "marketing",
    category_cn: "客户服务与营销",
    pricing_usd_month: 85,
    pricing_desc: "$74–$149 / 月 + 每个 AI 解决回复加收 $0.99",
    pain_points: "AI 客服机器人按次收费极其昂贵（每答一次收费近 1 美元）、多客服坐席费极高、客户数据完全托管在海外",
    disruption_type: "hybrid",
    difficulty: "中等",
    offline_support: true,
    estimated_yearly_saving_usd: 1020,
    alternatives: [
      {
        name: "Chatwoot",
        repo: "chatwoot/chatwoot",
        stars: "22k+",
        license: "AGPL-3.0",
        tech_stack: "Ruby on Rails + Vue",
        desc: "全渠道开源在线客服平台，统一接入网页挂件、微信、WhatsApp、邮件等，支持无限制多坐席协同与知识库问答。",
        one_click_cmd: "curl -fsSL https://get.chatwoot.app/linux | bash"
      },
      {
        name: "Dify / FastGPT 智能客服",
        repo: "langgenius/dify",
        stars: "62k+",
        license: "Open Source",
        tech_stack: "Python + Next.js",
        desc: "可视化工作流与知识库 RAG 编排神器，将公司产品文档上传即可自动构建 24 小时永不停机的顶级 AI 客服。",
        one_click_cmd: "git clone https://github.com/langgenius/dify.git && cd dify/docker && docker compose up -d"
      }
    ],
    llm_disruption: {
      is_disrupted: true,
      level: 5,
      thesis: "【大模型颠覆最彻底的领域】Intercom 强推的 Fin AI 每次解答收取 $0.99 美元，而底层调用的 LLM Token 成本仅需 0.0005 美元，存在上千倍的荒谬暴利！通过开源 RAG 框架，企业可以零坐席费实现完全同等甚至更专业的全天候客服。",
      ai_alternative_solution: "自建 Chatwoot 或 Dify，绑定自有 DeepSeek/OpenAI API，客户解答成本直接降低 99.8%，每年为中小团队省下上万美元的客服软件开销。"
    }
  },
  {
    id: "oss_mailchimp",
    name_cn: "Mailchimp / SendGrid 邮件营销与订阅推送",
    target_software: "Mailchimp",
    vendor: "Intuit Inc.",
    category: "marketing",
    category_cn: "客户服务与营销",
    pricing_usd_month: 40,
    pricing_desc: "$20–$350+ / 月 (按订阅联系人数量阶梯暴增)",
    pain_points: "联系人列表达到几千人后月费指数级暴涨、即使不发邮件只要名单躺在里面就要持续扣月租、订阅退订流转受限",
    disruption_type: "oss",
    difficulty: "中等",
    offline_support: true,
    estimated_yearly_saving_usd: 480,
    alternatives: [
      {
        name: "Listmonk",
        repo: "knadh/listmonk",
        stars: "16k+",
        license: "AGPL-3.0",
        tech_stack: "Go + Vue + PostgreSQL",
        desc: "单机每分钟可发送上万封邮件的高性能开源营销神器！内存占用极低（仅需几十MB），联系人无任何数量上限，支持任意 SMTP 渠道（如 Amazon SES / Cloudflare）。",
        one_click_cmd: "docker run -d --name listmonk -p 9000:9000 listmonk/listmonk:latest"
      },
      {
        name: "Ghost (开源发布版)",
        repo: "TryGhost/Ghost",
        stars: "47k+",
        license: "MIT",
        tech_stack: "Node.js",
        desc: "全球顶尖创作者首选的开源 Newsletter 与博客发布系统，内置会员订阅体系，免去 Substack 与 Mailchimp 佣金抽取。",
        one_click_cmd: "docker run -d -p 2368:2368 ghost:5-alpine"
      }
    ],
    llm_disruption: {
      is_disrupted: true,
      level: 4,
      thesis: "通过 Amazon SES / Resend / Cloudflare 纯发信，每万封邮件成本仅约 $1。Mailchimp 等高价 SaaS 仅仅是卖了一套名单管理与排版界面。配合大模型写信与 Listmonk，任何人都能以 1% 的成本搭建顶尖邮件订阅系统。",
      ai_alternative_solution: "自建 Listmonk + Amazon SES / 腾讯云邮件，配合大模型一键生成个性化邮件标题与 A/B 测试正文，每年为出海团队节省数千美元。"
    }
  },
  {
    id: "oss_typeform",
    name_cn: "Typeform 沉浸式表单与问卷调查",
    target_software: "Typeform",
    vendor: "Typeform S.L.",
    category: "marketing",
    category_cn: "客户服务与营销",
    pricing_usd_month: 29,
    pricing_desc: "$25–$83 / 月 (按每月回收回答数限额)",
    pain_points: "回收量超额即停止收集、必须加钱才能去除 Typeform 官方 Logo、不支持数据私有化合规存储",
    disruption_type: "oss",
    difficulty: "极简",
    offline_support: true,
    estimated_yearly_saving_usd: 348,
    alternatives: [
      {
        name: "Formbricks",
        repo: "formbricks/formbricks",
        stars: "8k+",
        license: "AGPL-3.0",
        tech_stack: "Next.js + TypeScript",
        desc: "被誉为开源界的 Typeform / Qualtrics，专为产品经理与开发者设计，支持应用内弹窗调研、公开链接问卷与完整数据看板。",
        one_click_cmd: "docker run -d -p 3000:3000 ghcr.io/formbricks/formbricks:latest"
      },
      {
        name: "Tally (免费版) / HeyForm",
        repo: "heyform/heyform",
        stars: "6k+",
        license: "GNU",
        tech_stack: "Node.js",
        desc: "交互体验完全匹敌 Typeform 的沉浸式逐步问卷生成器，支持条件逻辑跳转与丰富的输入组件。",
        one_click_cmd: "docker run -d -p 8000:8000 heyform/heyform"
      }
    ],
    llm_disruption: {
      is_disrupted: true,
      level: 4,
      thesis: "问卷数据回收后的清洗、情感极性判断、用户需求聚类原本需要昂贵的数据分析员或 SaaS 分析包；现在大模型可一键解析上千条非结构化用户留言并直出核心改进点。",
      ai_alternative_solution: "使用开源 Formbricks 收集数据，通过 Webhook 自动推送给本地 LLM 汇总成每日用户原声日报，完全免费。"
    }
  },

  // ==========================================
  // 7. 电商独立站与计费 (E-commerce & Payments)
  // ==========================================
  {
    id: "oss_shopify",
    name_cn: "Shopify 全球电商独立站与交易平台",
    target_software: "Shopify",
    vendor: "Shopify Inc.",
    category: "ecommerce",
    category_cn: "电商独立站与计费",
    pricing_usd_month: 39,
    pricing_desc: "$39–$399 / 月 + 额外每笔交易 2.9% + $0.3 抽取",
    pain_points: "每月强制扣除基础月租、第三方应用商店插件几乎每个都要月费、非官方支付网关额外抽佣、底层逻辑受限于平台封店风险",
    disruption_type: "oss",
    difficulty: "专业",
    offline_support: true,
    estimated_yearly_saving_usd: 468,
    alternatives: [
      {
        name: "Medusa.js",
        repo: "medusajs/medusa",
        stars: "26k+",
        license: "MIT",
        tech_stack: "Node.js + TypeScript (Headless)",
        desc: "现代化开源 Headless 商业引擎（开源界 Shopify），模块化架构，完全自由接驳任何前端界面与任意全球支付渠道，零平台抽成。",
        one_click_cmd: "npx create-medusa-app@latest"
      },
      {
        name: "Saleor",
        repo: "saleor/saleor",
        stars: "20k+",
        license: "BSD-3-Clause",
        tech_stack: "Python + GraphQL + React",
        desc: "超高性能多渠道全球化电商平台，具备企业级 GraphQL API，支持多币种、多仓库与跨国税率自动化计算。",
        one_click_cmd: "git clone https://github.com/saleor/saleor-platform.git && cd saleor-platform && docker compose up -d"
      }
    ],
    llm_disruption: {
      is_disrupted: true,
      level: 4,
      thesis: "大模型结合视觉能力，可以自动完成商品上架、多语言 SEO 标题生成、场景化营销图合成，配合开源 Headless 电商引擎，一人即可维护过去数十人才能运营的全球电商站。",
      ai_alternative_solution: "使用 Medusa.js 开源自建 + Stripe 官方直连，没有平台月租与额外加收抽佣，每年直接省下数千美元的 Shopify 插件与基础月费。"
    }
  },
  {
    id: "oss_chargebee",
    name_cn: "Chargebee / Recurly 订阅计费与发票管理",
    target_software: "Chargebee / Recurly",
    vendor: "Chargebee Inc.",
    category: "ecommerce",
    category_cn: "电商独立站与计费",
    pricing_usd_month: 249,
    pricing_desc: "$249–$599 / 月 + 超额收入额外抽成",
    pain_points: "定价极其高昂、对初创 SaaS 团队门槛极高、账单历史迁移极其困难",
    disruption_type: "oss",
    difficulty: "专业",
    offline_support: true,
    estimated_yearly_saving_usd: 2988,
    alternatives: [
      {
        name: "Lago",
        repo: "getlago/lago",
        stars: "6k+",
        license: "AGPL-3.0",
        tech_stack: "Ruby on Rails + Go",
        desc: "开源计费与计量收费引擎（开源界 Chargebee），专为现代复杂计费（如按用量计费、月租订阅、阶梯计费）打造，无抽佣门槛。",
        one_click_cmd: "git clone https://github.com/getlago/lago.git && cd lago && docker compose up -d"
      },
      {
        name: "Kill Bill",
        repo: "killbill/killbill",
        stars: "5.5k+",
        license: "Apache-2.0",
        tech_stack: "Java",
        desc: "久经考验的企业级开源计费与支付平台，被众多大型金融机构与上市公司采用。",
        one_click_cmd: "docker run -d -p 8080:8080 killbill/killbill"
      }
    ],
    llm_disruption: {
      is_disrupted: true,
      level: 3,
      thesis: "中小团队无需采购昂贵的企业级计费中台，Stripe Billing 加上几段由 AI 生成的轻量 Webhook 验证逻辑即可完美处理订阅周期与扣费失败重试。",
      ai_alternative_solution: "采用 Lago 开源版配合 Stripe 直连，实现完全自主可控的用量计费架构，每年省下几千美元的基础月租。"
    }
  },

  // ==========================================
  // 8. 运维部署与基础平台 (PaaS & Cloud Hosting)
  // ==========================================
  {
    id: "oss_vercel",
    name_cn: "Vercel / Heroku 云端全托管部署平台",
    target_software: "Vercel Pro / Heroku",
    vendor: "Vercel Inc. / Salesforce",
    category: "dev_ops",
    category_cn: "研发与项目管理",
    pricing_usd_month: 20,
    pricing_desc: "$20 / 开发者 / 月 + 超额流量与构建时长按高单价计费",
    pain_points: "多人协同团队月费门槛高、超额后带宽成本昂贵、服务器日志保留期有限",
    disruption_type: "oss",
    difficulty: "极简",
    offline_support: true,
    estimated_yearly_saving_usd: 240,
    alternatives: [
      {
        name: "Coolify",
        repo: "coollabsio/coolify",
        stars: "38k+",
        license: "Apache-2.0",
        tech_stack: "PHP + Laravel + Docker",
        desc: "目前全球最火爆的自建开源 PaaS 平台（被誉为自建版 Vercel / Heroku），一键接管任何 VPS 服务器，支持 Git 自动构建部署、免费 SSL 证书、数据库与备份。",
        one_click_cmd: "curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash"
      },
      {
        name: "Dokku",
        repo: "dokku/dokku",
        stars: "26k+",
        license: "MIT",
        tech_stack: "Bash + Docker",
        desc: "最轻量、极度稳定的单机迷你 Heroku，一个 git push 命令直接自动构建打包部署上线。",
        one_click_cmd: "wget -NP . https://dokku.com/bootstrap.sh && sudo DOKKU_TAG=v0.34.6 bash bootstrap.sh"
      }
    ],
    llm_disruption: {
      is_disrupted: true,
      level: 4,
      thesis: "以前开发者依赖 Vercel 提供的繁琐环境配置；现在大模型可以为任意项目一秒生成工业级 Dockerfile 与 Nginx 反向代理配置，自建 PaaS 的运维门槛被抹平为零。",
      ai_alternative_solution: "购买一台 $5/月的 Hetzner 或腾讯轻量 VPS，安装 Coolify 开源面板，无限部署数十个 Next.js/Python 项目，彻底避免 Vercel 每月数十美元的高阶账单。"
    }
  },
  {
    id: "oss_firebase",
    name_cn: "Firebase / AWS Amplify 移动与全栈后端",
    target_software: "Firebase",
    vendor: "Google LLC",
    category: "dev_ops",
    category_cn: "研发与项目管理",
    pricing_usd_month: 25,
    pricing_desc: "按读取写入次数与存储量计费，易产生意外超额",
    pain_points: "深度厂商锁定（Vendor Lock-in）、NoSQL 结构迁移困难、大批量数据分析导出费力",
    disruption_type: "oss",
    difficulty: "中等",
    offline_support: true,
    estimated_yearly_saving_usd: 300,
    alternatives: [
      {
        name: "Supabase",
        repo: "supabase/supabase",
        stars: "74k+",
        license: "Apache-2.0",
        tech_stack: "PostgreSQL + Elixir + Go",
        desc: "全球最顶级的开源 Firebase 替代方案！基于纯正的企业级 PostgreSQL，原生支持实时订阅、鉴权、自动生成 REST/GraphQL API 与文件存储。",
        one_click_cmd: "git clone --depth 1 https://github.com/supabase/supabase && cd supabase/docker && docker compose up -d"
      },
      {
        name: "PocketBase",
        repo: "pocketbase/pocketbase",
        stars: "42k+",
        license: "MIT",
        tech_stack: "Go + SQLite (单文件二进制)",
        desc: "惊艳绝伦的单文件后端！自带管理员后台、用户鉴权与实时数据监听，单文件只有十几MB，开发个人/小型项目 5 分钟极速上线。",
        one_click_cmd: "./pocketbase serve"
      }
    ],
    llm_disruption: {
      is_disrupted: true,
      level: 4,
      thesis: "大模型对标准 SQL 的支持远远胜过 Firebase 晦涩专有的 NoSQL 查询语法。使用标准 Postgres + Supabase，AI 辅助编写复杂联表和存储过程顺滑无比，再也不用受制于 Google 封闭平台。",
      ai_alternative_solution: "出海个人项目采用 PocketBase 或自建 Supabase，单机承受十万级并发，终身免费且完全自主可控。"
    }
  }
];

export const CATEGORIES = [
  { id: "all", name_cn: "全部领域", icon: "🌐" },
  { id: "productivity", name_cn: "协同办公与知识库", icon: "📝" },
  { id: "automation", name_cn: "自动化与流程连接", icon: "⚡" },
  { id: "ai_tools", name_cn: "AI 与写作生产力", icon: "🧠" },
  { id: "design", name_cn: "设计与创意媒体", icon: "🎨" },
  { id: "dev_ops", name_cn: "研发与项目管理", icon: "💻" },
  { id: "communication", name_cn: "通讯与团队协作", icon: "💬" },
  { id: "marketing", name_cn: "客户服务与营销", icon: "📣" },
  { id: "ecommerce", name_cn: "电商独立站与计费", icon: "💳" }
];

