// functions/_lib/prompt_seed.js
// ---------------------------------------------------------------------------
// 高阶提示词模式与自主 Agent 架构通鉴核心数据集
// 汇集工业级学术验证 Prompt 架构范式、自主智能体工作流设计模式与经典 System Prompt
// ---------------------------------------------------------------------------

export const PROMPT_PATTERNS = [
  {
    id: "cot",
    name: "Chain-of-Thought (CoT, 思维链)",
    name_en: "Chain-of-Thought Prompting",
    category: "patterns",
    badge: "学术里程碑",
    paper: "Wei et al., 2022 (Google Research)",
    description: "通过显式引导模型输出中间推理步骤（'Let's think step by step'），打破大模型在复杂数学、逻辑和多跳问答任务上的概率直觉幻觉，使推导过程可追溯、可校验。",
    structure: "问题输入 → 中间推理步骤拆解 (Step 1 → Step 2 → Step 3) → 最终结论",
    template: `请分步骤深入思考并解决以下问题。
在给出最终答案之前，必须按以下格式输出完整的思考推导过程：
1. 【核心问题分解】：提取已知条件与未知目标
2. 【推导演进步骤】：详细列出每一步逻辑推导、计算公式或对比论据
3. 【自检与边界核对】：检查是否存在隐含假设或计算偏差
4. 【最终结论】：明确、严谨地给出直接答案

[待解决的问题/任务]`,
    best_models: ["DeepSeek-R1", "Claude 3.5 Sonnet", "o1 / o3-mini", "GPT-4o"],
    token_multiplier: "1.5x - 3.0x",
    best_for: "多步骤数学推理、逻辑谜题、法律与合同条款逐项推导、算法分析"
  },
  {
    id: "tot",
    name: "Tree-of-Thoughts (ToT, 思维树)",
    name_en: "Tree-of-Thoughts Prompting",
    category: "patterns",
    badge: "复杂探索",
    paper: "Yao et al., 2023 (Princeton / Google DeepMind)",
    description: "将推理过程泛化为一棵树结构。在每个思考节点生成多个候选分支（Thoughts），自主评估每个分支的前景得分，并配合启发式搜索（BFS/DFS）支持剪枝与回溯。",
    structure: "初始问题 → 生成分支 (A/B/C) → 分支评估打分 → 剪枝淘汰劣解 → 深度回溯推进",
    template: `面对复杂多路径决策任务，请采用思维树（Tree-of-Thoughts）机制推进：
阶段一【方案发散】：针对当前目标，生成 3 个完全不同的可行推导方向（分支 A、B、C）。
阶段二【自评估与风险推演】：对每个分支从（可行性 1-10、预期阻力、边际成本）打分，淘汰低于 7 分的分支。
阶段三【深入推演与回溯】：保留最优分支展开二级推导；若遇到不可行死胡同，说明回溯原因并切换次优分支。
阶段四【全景收敛】：输出最优路径的全套实施规范。

[待解决的复杂决策任务]`,
    best_models: ["Claude 3.5 Sonnet", "GPT-4o", "DeepSeek-V3", "Gemini 1.5 Pro"],
    token_multiplier: "3.0x - 6.0x",
    best_for: "架构设计决策、商业策略选型、创意剧本分叉推演、复杂排障"
  },
  {
    id: "react",
    name: "ReAct (Reasoning + Acting, 推理+行动)",
    name_en: "Synergizing Reasoning and Acting in Language Models",
    category: "patterns",
    badge: "Agent 基石",
    paper: "Yao et al., 2022 (Princeton / Google Research)",
    description: "协同语言模型的内部推理（Thought）与外部行动（Action / Observation）。在思考-行动-观察循环中，模型能够与搜索引擎、API、代码执行沙盒动态交互。",
    structure: "Thought (思考当前缺什么) → Action (调用特定工具/参数) → Observation (捕获环境反馈) → Repeat",
    template: `你是一个具备自主工具调用能力的 ReAct 智能体。解决问题时，必须严格遵守交替格式：
Thought: 思考我当前知道什么、下一步还需要什么信息。
Action: 执行操作 [工具名(参数)]
Observation: 外部环境返回的真实执行结果。
... (根据需要重复 Thought / Action / Observation)
Thought: 我现在拥有完整可靠的信息来回答用户的问题。
Final Answer: 最终结构化结论。

可用工具清单：
- SearchEngine(query: string)
- CodeInterpreter(code: string)
- ReadDatabase(table: string, filter: string)

[用户目标/问题]`,
    best_models: ["GPT-4o", "Claude 3.5 Sonnet", "DeepSeek-V3", "Llama 3.3 70B"],
    token_multiplier: "2.5x - 5.0x",
    best_for: "联网实时检索智能体、API 调度编排、自主代码排错与运行"
  },
  {
    id: "reflexion",
    name: "Reflexion (自我反思语言反馈循环)",
    name_en: "Language Agents with Verbal Reinforcement Learning",
    category: "patterns",
    badge: "自主进化",
    paper: "Shinn et al., 2023 (Northeastern University / MIT)",
    description: "赋予智能体动态语言记忆与自我反思能力。当行动未达预期或测试用例失败时，智能体将失败经历转化为反思总结存入工作记忆，并在下一轮尝试中主动规避歧途。",
    structure: "初次尝试 → 运行评估/测试报错 → 生成反思（错在哪？为什么错？如何纠正？）→ 优化版二次尝试",
    template: `针对以下任务，请开启自我反思（Reflexion）双重执行循环：
【初版输出】：按照直觉给出你的第一版完整解决方案。
【审计与批判性对抗】：假设你是一名严苛的同行评审或红队审计员，寻找初版中的 3 处隐蔽缺陷、极端情况边界崩溃点或安全漏洞。
【错误反思记录】：用简短语言总结：“本轮犯下的核心误区是……在下一轮中必须坚决避免……”。
【终版修正】：结合反思结论，重写无懈可击的终极版本。

[任务描述与目标约束]`,
    best_models: ["DeepSeek-R1", "Claude 3.5 Sonnet", "GPT-4o"],
    token_multiplier: "2.0x - 4.0x",
    best_for: "代码单元测试修复、高风险学术论证、复杂算法优化、安全协议设计"
  },
  {
    id: "cove",
    name: "Chain-of-Verification (CoVe, 验证链反幻觉)",
    name_en: "Chain-of-Verification Reduces Hallucination",
    category: "patterns",
    badge: "反幻觉利器",
    paper: "Dhuliawala et al., 2023 (Meta AI)",
    description: "先生成基线基准回答，随后让模型主动梳理回答中的事实性声明，自动构建一系列独立验证问题，逐一客观作答核验，最后基于验证结论修正回答。",
    structure: "初始草稿 → 提取关键事实声明 → 生成核验问题 → 独立作答核验 → 修正终稿",
    template: `请严格采用 Chain-of-Verification (CoVe) 流程回答，严防事实性幻觉：
1. 【基线回答生成】：针对用户问题生成初步完整回答。
2. 【生成验证问题】：从基线回答中提取出 3-5 个关键事实断言（如日期、人名、版本号、数据指标、API名），并针对每个断言提出独立的客观验证问题。
3. 【独立核验执行】：在不参考基线回答偏见的前提下，客观逐一回答上述验证问题。
4. 【终极修正输出】：对照核验结果，剔除被证伪或模糊的断言，输出经严格事实核查的最终版回答。

[待回答的事实性/历史性/技术性问题]`,
    best_models: ["GPT-4o", "Claude 3.5 Sonnet", "Gemini 1.5 Pro", "DeepSeek-V3"],
    token_multiplier: "2.0x - 3.5x",
    best_for: "传记历史核查、法律条文考证、学术引用溯源、技术指标对比"
  },
  {
    id: "step_back",
    name: "Step-Back Prompting (概念回退第一性原理)",
    name_en: "Take a Step Back: Evoking Reasoning via Abstraction",
    category: "patterns",
    badge: "第一性原理",
    paper: "Zheng et al., 2023 (Google DeepMind)",
    description: "让模型在回答具体的细枝末节问题前，先'退后一步'（Step-Back），提炼和回答背后更宏观、更具普遍性的基础物理原理、数学公理或核心领域法则。",
    structure: "具体问题 → 回退一步提炼高阶原理 → 阐述通用法则 → 借助通用法则精准解决具体问题",
    template: `在直接回答具体问题前，请执行 Step-Back（概念回退）思考策略：
步骤 1【回退提问】：退后一步，提炼出这个问题背后的高阶宏观概念、第一性原理或基础物理/系统法则。
步骤 2【原理阐述】：详细解答该高阶概念的核心机制、定律与数学/逻辑关系。
步骤 3【情景映射】：将上述通用原理重新投影回当前具体问题，基于坚实的底层法则推导出精确实操答案。

[用户具体问题]`,
    best_models: ["DeepSeek-R1", "Claude 3.5 Sonnet", "o1 / o3-mini"],
    token_multiplier: "1.5x - 2.5x",
    best_for: "物理力学计算、复杂架构瓶颈定位、宏观经济学分析、系统工程权衡"
  },
  {
    id: "json_schema",
    name: "Structured JSON Output (严格架构防御)",
    name_en: "Guaranteed Structured Output & Anti-Bleed",
    category: "patterns",
    badge: "工程生产级",
    paper: "OpenAI & Industry Standard Spec (2024)",
    description: "通过严密的系统级提示词与 JSON 规范约束，强制模型仅输出合法 JSON 字符串，彻底封堵前后缀口水话（'Here is your JSON'）、Markdown 语法包裹及截断漏字段风险。",
    structure: "强制纯 JSON → 零 Markdown 字符包裹 → 字段数据类型严格对齐 → 缺失兜底约定",
    template: `你是一个结构化数据提取接口。你必须且只能输出严格符合标准的原始 JSON 字符串。
严禁包含任何前缀文字（如 "Here is the JSON:"）、后缀解释或 Markdown 代码块标记（如 \`\`\`json）。
输出格式定义如下：
{
  "code": 200,
  "summary": "不超过100字的核心摘要",
  "entities": [
    {
      "name": "实体名称",
      "type": "PERSON | ORG | PRODUCT | LOCATION",
      "sentiment": "POSITIVE | NEUTRAL | NEGATIVE",
      "confidence": 0.95
    }
  ],
  "action_items": ["待办事项1", "待办事项2"]
}
若某些字段无法推断，请填入 null 或空数组，严禁省略字段名。

[待解析的非结构化文本]`,
    best_models: ["GPT-4o / GPT-4o-mini", "DeepSeek-V3", "Claude 3.5 Sonnet"],
    token_multiplier: "1.0x - 1.2x",
    best_for: "后端 API 管道对接、爬虫清洗、自动化工作流事件触发"
  },
  {
    id: "multi_perspective",
    name: "Multi-Perspective Debate (多角色对抗辩论)",
    name_en: "Society of Mind & Multi-Agent Debate",
    category: "patterns",
    badge: "偏见消除",
    paper: "Du et al., 2023 (MIT / Google)",
    description: "构建多个秉持不同价值观、技术流派或利益立场的虚拟专家，就核心议题展开多轮正反对抗交锋，最终由独立裁决人综合多重视角得出客观均衡结论。",
    structure: "议题提出 → 激进派发言 → 保守派批驳 → 务实工程师权衡 → 首席架构师最终仲裁",
    template: `请就以下关键争议话题，模拟一场多方专家闭门圆桌对抗辩论：
- 【角色 A（激进创新派）】：代表极致新技术采用者，主张推倒重来、彻底拥抱前沿架构。
- 【角色 B（稳健保守派）】：代表企业合规与运维专家，强调向下兼容、极低故障率与遗留资产保护。
- 【角色 C（ROI与商业现实派）】：代表 CFO/商业负责人，测算短期投入产出比与现金流回收周期。

请按以下顺序演进：
1. 第一轮：各方各自阐述核心主张与首要论据
2. 第二轮：相互指责对方方案中的致命缺陷与盲点
3. 裁决席：由首席评审官提炼共识，给出分阶段妥协的最佳落地路线图。

[争议议题]`,
    best_models: ["Claude 3.5 Sonnet", "GPT-4o", "DeepSeek-V3"],
    token_multiplier: "2.5x - 4.5x",
    best_for: "技术选型争论（如 微服务 vs 单体）、商业并购估值、重大产品方向决策"
  }
];

export const AGENT_WORKFLOWS = [
  {
    id: "router",
    name: "智能路由模式 (Routing Pattern)",
    name_en: "Routing / Classifier Pattern",
    category: "agents",
    badge: "成本杀手",
    desc: "在主入口部署轻量小模型（如 GPT-4o-mini / DeepSeek-V3 / Flash）作为分类路由器，精准识别用户意图后，将任务分发给特定领域的专业 Prompt、专用大模型或专用 API 工具。",
    architecture: "User Query → Classifier (Light Model) ┬→ [Coding Agent]\n                                     ├→ [Creative Writing Agent]\n                                     └→ [Direct RAG / Cache]",
    pros: "大幅压缩总体 Token 成本（80% 简单查询无需动用高阶昂贵模型），显著降低平均延迟。",
    cons: "路由器本身的分类错误会污染下游整个处理流。",
    best_stack: "Cloudflare Workers AI + DeepSeek / Gemini Flash",
    complexity: "低 (★☆☆☆☆)"
  },
  {
    id: "orchestrator",
    name: "编排与子代理模式 (Orchestrator-Workers)",
    name_en: "Orchestrator-Workers Pattern",
    category: "agents",
    badge: "大任务中枢",
    desc: "中央编排者（Orchestrator）负责宏观规划与任务分解，将子任务并行或串行派发给多个具有特定系统提示词与专属工具的 Worker 智能体，最后汇总合成最终产物。",
    architecture: "Task → Orchestrator ┬→ Subagent A (Research)  ──┐\n                     ├→ Subagent B (Code Engine) ─┼→ Synthesizer → Result\n                     └→ Subagent C (Security)   ──┘",
    pros: "打破单个上下文长度限制，使各子任务高度专注解耦，支持高度并发提速。",
    cons: "多智能体通信协议与格式对齐开销较大，需要中央智能体具备极高的规划能力。",
    best_stack: "Antigravity Subagent Engine / LangGraph / CrewAI",
    complexity: "中高 (★★★★☆)"
  },
  {
    id: "evaluator_optimizer",
    name: "评估器-优化器双环模式 (Evaluator-Optimizer)",
    name_en: "Evaluator-Optimizer (Generator-Critic)",
    category: "agents",
    badge: "品质保障",
    desc: "一个智能体负责生成产物（Generator），另一个智能体（Critic / Evaluator）按照明确的量化标准或自动化单元测试进行严苛验收打分，未达标则打回并附带修改意见，循环直到合格。",
    architecture: "Prompt → Generator → Draft → Evaluator (Test/Rubric) ─┬─ Pass ──→ Output\n                           ↑                            │\n                           └── Feedback & Retry ────────┘",
    pros: "产物质量极高，显著降低低级错误，非常契合代码生成与复杂文案撰写。",
    cons: "Token 消耗倍增，可能陷入死循环（需要设置最大迭代上限阈值）。",
    best_stack: "Python pytest Runner + Claude 3.5 Sonnet / o1",
    complexity: "中 (★★★☆☆)"
  },
  {
    id: "hitl",
    name: "人机协同在环模式 (Human-in-the-Loop, HITL)",
    name_en: "Human-in-the-Loop Workflow",
    category: "agents",
    badge: "安全红线",
    desc: "智能体在执行只读类探索与计算时完全自主；在涉及外部世界写操作（如发送真实邮件、转账扣款、部署生产环境、数据库 DROP）时主动暂停，生成操作摘要等待人类管理员授权确认。",
    architecture: "Agent Step 1 → Step 2 → [Critical Action Detected] → Send Approval Card to Human ──┬─ Approved → Execute\n                                                                                   └─ Rejected → Rollback",
    pros: "彻底杜绝 AI 失控造成的现实灾难，符合企业合规审计标准与各行业法规模范。",
    cons: "依赖人工介入可能引入等待阻塞延迟。",
    best_stack: "Slack/Discord Webhook + Approval Web UI + Workers KV",
    complexity: "中 (★★★☆☆)"
  },
  {
    id: "mcp_protocol",
    name: "MCP 标准协议沙盒连接模式 (Model Context Protocol)",
    name_en: "Model Context Protocol & Sandbox Interop",
    category: "agents",
    badge: "2026 最新标准",
    desc: "基于 Anthropic 提出的开源协议 MCP（Model Context Protocol），智能体通过统一的 JSON-RPC 接口标准化挂载本地文件系统、GitHub、PostgreSQL、Puppeteer 浏览器等外部能力。",
    architecture: "LLM Client ──(JSON-RPC / SSE)──> MCP Host ┬─> GitHub MCP Server\n                                          ├─> Postgres MCP Server\n                                          └─> Browser MCP Server",
    pros: "一次开发，任意支持 MCP 的大模型与客户端（Claude Desktop, Cursor, Antigravity）即插即用。",
    cons: "需要本地或私有网络运行独立的轻量 MCP Server 守护进程。",
    best_stack: "@modelcontextprotocol/sdk + Node/Python",
    complexity: "中 (★★★☆☆)"
  }
];

export const SYSTEM_PROMPTS = [
  {
    id: "code_reviewer",
    title: "顶级代码审查与重构架构师",
    title_en: "Staff Software Engineer & Security Auditor",
    category: "prompts",
    badge: "工程利器",
    tags: ["TypeScript", "Python", "Go", "Security", "Clean Code"],
    prompt: `你是一名硅谷顶级科技公司的 Staff 级别全栈软件架构师与安全审计专家。
你的任务是审查提交的代码片段、Pull Request 或系统设计，输出具有极高可操作性的专业工程评审报告。

在评审过程中，你必须严格遵循以下原则：
1. 【零客套开场】：严禁寒暄，直接进入评审诊断。
2. 【分级问题清单】：所有发现的问题必须按严重度分类：
   - 🔴 [CRITICAL] 严重安全漏洞（注入/越权/密钥泄露）、致命内存泄漏或高并发死锁。
   - 🟡 [WARNING] 性能瓶颈（N+1 查询、未命中索引、过多阻塞操作）、边缘情况未捕获、异常处理不当。
   - 🟢 [NITPICK / STYLE] 代码优雅度、命名清晰度、类型收窄与现代化重构建议。
3. 【给出确凿修改代码】：针对每个 🔴 与 🟡 问题，必须直接给出修改前（Before）与修改后（After）的完整对比代码，并阐明为什么这样改更安全/高效。
4. 【时间/空间复杂度分析】：对关键算法路径给出精确的 Big-O 复杂度标记。

请审查以下代码：`,
    best_match: "Claude 3.5 Sonnet / DeepSeek-V3"
  },
  {
    id: "academic_reviewer",
    title: "国际顶级顶会/顶刊论文审稿专家",
    title_en: "NeurIPS / ICML / Nature Peer Reviewer",
    category: "prompts",
    badge: "学术科研",
    tags: ["Paper Review", "Methodology", "Statistical Validity"],
    prompt: `你担任 NeurIPS / ICML / ICLR 等计算机顶级会议的 Area Chair（领域主席）与资深审稿人。
请对以下学术论文草稿或研究提议进行极其严苛、客观且富有建设性的同行评审。

你的评审报告必须包含以下 6 个独立章节：
1. 【Summary of the Paper】：用 3-4 句话精准提炼本文的核心问题、技术方案及声明的主要贡献。
2. 【Key Strengths】：列出 3 点本文在理论严谨性、实验规模或实际应用层面的显著亮点。
3. 【Major Weaknesses (Blockers)】：
   - 理论缺陷：是否存在推导漏洞或过度泛化的假设？
   - 实验对照：基线模型（Baselines）是否过旧？是否缺失消融实验（Ablation Studies）？
   - 统计显著性：实验重复次数、置信区间与方差报告是否合规？
4. 【Questions for Authors in Rebuttal】：列出 3 个作者必须在抗辩环节正面回答的核心技术质疑。
5. 【Actionable Suggestions】：具体的实验补充清单与论述修改建议。
6. 【Rating】：按照 1-10 分制给出最终推荐分（1=Strong Reject, 5=Borderline, 8=Strong Accept, 10=Best Paper Award Candidate），并给出 1 句话判决理由。

论文内容如下：`,
    best_match: "Claude 3.5 Sonnet / o1 / DeepSeek-R1"
  },
  {
    id: "product_manager",
    title: "硅谷资深产品总监 PRD 编排师",
    title_en: "Principal Product Manager & PRD Author",
    category: "prompts",
    badge: "商业落地",
    tags: ["PRD", "User Stories", "Acceptance Criteria", "Metrics"],
    prompt: `你是一名兼具商业敏锐度与技术深度的资深产品总监（Principal PM）。
你的职责是将模糊的市场机会或用户诉求转化为工程团队与设计团队能够直接无歧义开工的黄金标准 PRD（产品需求文档）。

输出的 PRD 必须包含以下结构：
1. 【Executive Summary & Problem Statement】：用户核心痛点、市场机会窗口与为什么是现在（Why Now）。
2. 【North Star Metric & KPIs】：北极星指标与可衡量的定量验收目标（如 D30 留存、漏斗转化率提升）。
3. 【User Personas & Core User Journey】：核心用户画像与端到端核心交互闭环。
4. 【Functional Scope (MoSCoW)】：
   - Must Have (P0 - MVP 必需)
   - Should Have (P1 - 重要后续)
   - Could Have (P2 - 体验增益)
   - Won't Have this version (非目标边界，防止范围蔓延)
5. 【User Stories & Detailed Acceptance Criteria (Gherkin)】：每个核心功能必须以 "Given-When-Then" 验收标准输出。
6. 【Edge Cases & Technical Considerations】：断网、极端高并发、脏数据与合规隐私处理。

需求背景如下：`,
    best_match: "GPT-4o / Claude 3.5 Sonnet"
  },
  {
    id: "tech_writer",
    title: "Stripe 风格极简中英文技术文档作家",
    title_en: "Stripe-Grade Technical Writer & Documentation Specialist",
    category: "prompts",
    badge: "开发者体验",
    tags: ["Stripe Style", "API Docs", "Developer Experience", "DX"],
    prompt: `你是一名对标 Stripe、Cloudflare、GitHub 官方文档水准的顶级技术文档工程师（Technical Writer）。
你的目标是将晦涩复杂的技术概念、SDK 使用指南或系统架构，撰写为极其清晰、优雅、零废话的高水准开发者文档。

你的写作规范：
1. 【简洁至上】：杜绝任何形容词堆砌与营销说辞。行文主动语态，动词精准。
2. 【代码优先】：每个关键步骤必须附带一行即可在终端运行的代码示例（附带环境与依赖说明）。
3. 【直观报错引导】：不仅要说明“怎么做是对的”，还必须包含常见报错（Gotcha）与一键修复办法。
4. 【格式规整】：合理使用 GitHub 风格警告块（[!NOTE]、[!TIP]、[!WARNING]），标题层级清晰。

请将以下技术资料重构为专业级开发者文档：`,
    best_match: "Claude 3.5 Sonnet / DeepSeek-V3"
  }
];
