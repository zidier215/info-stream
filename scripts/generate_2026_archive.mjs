// scripts/generate_2026_archive.mjs
// 生成 2026 年第 01 周至第 44 周完整 AI 前沿研究论文档案库
import fs from "fs";
import path from "path";

function getWeekDateRange(yearWeek) {
  const match = (yearWeek || "").match(/^(\d{4})-W(\d{2})$/);
  if (!match) return { startDate: "", endDate: "" };
  const year = parseInt(match[1], 10);
  const week = parseInt(match[2], 10);
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = (jan4.getDay() + 6) % 7;
  const monWeek1 = new Date(jan4.getTime() - dayOfWeek * 86400000);
  const targetMon = new Date(monWeek1.getTime() + (week - 1) * 7 * 86400000);
  const targetSun = new Date(targetMon.getTime() + 6 * 86400000);
  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { startDate: fmt(targetMon), endDate: fmt(targetSun) };
}

// 2026 各季度的核心学术与产业研究主题库
const TOPIC_TEMPLATES = [
  // Q1: 推理扩展定律、状态空间、字节级建模与开源蒸馏
  {
    theme: "Reasoning & Inference Scaling",
    quarter: 1,
    papers: [
      {
        title: "DeepMind 论文：验证测试期计算（Test-time Compute）扩展定律在数学奥赛中的极限边界",
        orig_title: "Scaling Laws for Test-Time Compute in Mathematical and Algorithmic Reasoning",
        source: "Google DeepMind",
        badge_type: "lab",
        summary: "Google DeepMind 团队系统评估了测试期计算扩展法则。在 10,000 道国际奥数及编程难题测试中，通过在推理阶段分配 16x 至 256x 计算预算（结合 PRM 过程奖励模型与动态蒙特卡洛树搜索），模型求解率从 42.1% 跃升至 78.4%，在同等参数下大幅超越纯参数扩展带来的收益。",
        is_starred: 1,
      },
      {
        title: "Cartesia 发布层级字节级网络 H-Net 2.0：彻底摆脱 BPE 分词器，计算效率提升 3.2 倍",
        orig_title: "From Tokens to Bytes: Hierarchical Neural Representations for Universal Sequence Modeling",
        source: "Cartesia",
        badge_type: "lab",
        summary: "Cartesia 联合斯坦福发布字节级层级网络 H-Net 2.0，在完全跳过预设分词表（Tokenizer-free）的前提下，通过跨尺度时间分层池化机制将字节序列动态聚合。评测显示在 40 种编程语言及低资源语料上，较 Llama 架构标准 Transformer 减少 68% 训练 FLOPs，且推理长文本吞吐提升 3.2x。",
        is_starred: 1,
      },
      {
        title: "DeepSeek 团队开源多词元预测（MTP）架构与无辅助损失稀疏 MoE 训练框架",
        orig_title: "Multi-Token Prediction and Auxiliary-loss-free Load Balancing for Frontier Mixture-of-Experts",
        source: "DeepSeek",
        badge_type: "lab",
        summary: "DeepSeek 公开其万亿级混合专家架构的核心训练方案，创新性地采用无辅助损失（Auxiliary-loss-free）全局负载均衡策略，使专家利用率达 99.2% 且彻底消除路由退化惩罚。同时多词元预测（MTP）并行解码使推理端每秒词元生成速率平均提升 1.85 倍。",
        is_starred: 1,
      },
      {
        title: "MIT CSAIL 提出 Cache-Efficient KV 压缩算法：仅保留 12% 键值即可保持 98.7% 语义保真度",
        orig_title: "SparseKV: Dynamic Activation Pruning for Million-Token Context Serving",
        source: "MIT CSAIL",
        badge_type: "lab",
        summary: "MIT 研究团队针对百万 Token 长上下文推理中的显存墙瓶颈，提出基于注意力激活动态衰减的 SparseKV 稀疏化算法。在 128k 至 1M 长度的多篇长文档检索评测中，仅保留 12.5% 的 KV Cache 即可维持 98.7% 的 Needle-in-a-Haystack 召回精度，GPU 显存占用缩减 7.1 倍。",
        is_starred: 0,
      },
      {
        title: "Stanford HAI 实验：提示词缓存技术使企业级 AI Agent 任务端到端运行成本下降 64%",
        orig_title: "Economics of Context Caching in Complex Multi-Turn Agentic Workflows",
        source: "Stanford HAI",
        badge_type: "lab",
        summary: "斯坦福以人为本人工智能研究院（HAI）对 30 家典型 AI 企业级工作流进行实证追踪。由于 Agent 频繁读取长系统提示与多轮代码上下文，启用前缀缓存（Prompt Caching）后，系统总 Token 计费成本平均下降 64.2%，端到端 P90 响应延迟自 4.8 秒降至 1.6 秒。",
        is_starred: 0,
      },
      {
        title: "清华与智谱团队提出跨模态图文联合表征对齐新范式，消除视觉幻觉率 45%",
        orig_title: "Bridging Representation Gaps in Multimodal Language Models via Dual-Anchor Projection",
        source: "清华大学",
        badge_type: "official",
        summary: "清华大学计算机系联合团队发表多模态对齐论文，针对 VLM 常见细粒度属性错位与物体计数幻觉，引入双锚点拓扑感知投影层。在 MMBench 与 POPE 幻觉评测基准上，模型物体级幻觉率自 23.8% 降至 13.1%，跨模态细粒度空间推理准确度提升 18.2%。",
        is_starred: 0,
      },
      {
        title: "OpenAI 发布强化学习对齐新技术报告：基于细粒度步骤批判（Step-Level Critique）的大模型训练",
        orig_title: "Fine-Grained Step-Level Critiques for Self-Reflective Mathematical Reasoning",
        source: "OpenAI",
        badge_type: "official",
        summary: "OpenAI Alignment 团队发布研究，展示如何让评判模型（Critic）对推理长链中的每一个逻辑推导步骤进行正负奖励标注。在包含 50,000 个复杂证明的验证集中，细粒度步骤打分相比传统端到端胜负奖励使模型推导回溯纠错率提升 31.4%，伪结论生成率降低 52%。",
        is_starred: 1,
      },
      {
        title: "Meta 提出混合 Mamba-Transformer 架构 Hydra：长序列生成速度提升 4.2 倍",
        orig_title: "Hydra: Hybrid State-Space and Attention Layers for Efficient Long-Horizon Modeling",
        source: "Meta AI",
        badge_type: "lab",
        summary: "Meta 基本人工智能实验室（FAIR）提出交替编织状态空间模型（SSM）与自注意力层的 Hydra 混合架构。在 256k 序列长文本续写与多文件代码理解中，该模型保持与纯 Transformer 相当的困惑度（Perplexity 差值 <0.04），但在 A100 集群上的生成吞吐提升 420%。",
        is_starred: 0,
      },
      {
        title: "UC Berkeley Sky Computing 开源动态向量索引系统：将 6000 万片段索引压缩 33 倍",
        orig_title: "LEANN: Extreme Vector Index Compression via On-Demand Embedding Reconstruction",
        source: "UC Berkeley",
        badge_type: "lab",
        summary: "UC Berkeley 开源轻量级向量索引框架 LEANN。通过在查询检索阶段利用极小重构网络按需解算高维向量，将 6000 万维基百科分块的 HNSW 索引占用从 201 GB 压缩至 6.1 GB，使数千万级外部知识库得以在单张消费级 GPU 显存内实现毫秒级向量检索。",
        is_starred: 0,
      },
      {
        title: "CMU 发布长程智能体基准 Odysseys2：评估 GPT-6 与开源模型在百步真实任务中的达成率",
        orig_title: "Odysseys2: A 100-Task Long-Horizon Web Agent Benchmark with Strict Environment Invariants",
        source: "CMU",
        badge_type: "lab",
        summary: "卡内基梅隆大学联合团队发布涵盖 100 项真实复杂网页端到端流程的基准评测。评测结果表明，即便当前最先进的推理模型在此类需要平均 68 步状态保持的长程交互中，完全成功率仍不足 50%，最主要的失效模式为跨多标签页环境时的状态漂移与重试死循环。",
        is_starred: 0,
      },
      {
        title: "Anthropic 研究：AI 智能体隐性观点对人类专业分析师产生显著先验锚定",
        orig_title: "Unconscious Anchoring: How Automated Agent Opinions Shift Expert Analytic Judgment",
        source: "Anthropic",
        badge_type: "official",
        summary: "Anthropic 组织 50 名资深因果推断分析师开展双盲对照实验。实验中智能体被随机注入微弱倾向，结果显示 86% 的分析师最终采纳了智能体的预设偏好，且在事后访谈中均坚信决策结论完全源于自身独立专业分析，揭示出人机协同中的认知信任隐患。",
        is_starred: 1,
      },
      {
        title: "Hugging Face 发布开源大语言模型知识蒸馏技术白皮书：如何用 1/10 算力复刻 70B 性能",
        orig_title: "Practical Logit and Trajectory Distillation for Small Language Models in Edge Deployments",
        source: "Hugging Face",
        badge_type: "community",
        summary: "Hugging Face 研究员发布 7B/8B 边缘端小模型的系统性蒸馏指南。结合 Token 级分布对齐（Logit Matching）与多轮思考轨迹蒸馏（CoT Trajectory Transfer），7B 模型在 GSM8K、HumanEval 和 IFEval 综合打分上达到了教师模型 Llama-3-70B 的 94.6% 水平。",
        is_starred: 0,
      },
      {
        title: "Nature MI 论文：深度学习模型基于脑电信号实时重构高分辨率视听知觉流",
        orig_title: "Continuous Reconstruction of Perceptual Experience from Non-Invasive Neural Recordings",
        source: "Nature Machine Intelligence",
        badge_type: "official",
        summary: "发表在《自然·机器智能》上的新成果：科研人员利用无创高密度脑电与 fMRI 联用信号，经条件扩散解码器实时重建受试者所观看自然视频的连续帧，在物体分类与色彩空间余弦相似度上达 0.81，创下无创神经解码精度新纪录。",
        is_starred: 0,
      },
      {
        title: "微软研究院提出 AgentInstruct 双向反思工作流：自动合成百万条高质量技能指令数据",
        orig_title: "AgentInstruct: Toward Autonomous Agent Data Synthesis via Multi-Persona Simulation",
        source: "arXiv (cs.AI)",
        badge_type: "lab",
        summary: "微软研究院提出由模拟环境发生器与评审智能体构成的 AgentInstruct 闭环管道。通过在 18 个不同领域软件环境中自动化模拟操作失败与自我诊断，系统合成出 120 万条高可执行度的指令微调数据，使微调后开源模型在复杂工具调用上提升 16.8 个百分点。",
        is_starred: 0,
      },
      {
        title: "The Decoder 深度评测：2026 前端大模型代码生成进入“精准自动化修复”成熟期",
        orig_title: "Code Intelligence 2026: Benchmark Analysis of Front-Running Coding Agents on Production Repos",
        source: "The Decoder",
        badge_type: "media",
        summary: "The Decoder 针对 GitHub 前 500 个热门开源仓库的新增 PR 缺陷展开 30 天自动化修复实测。结果显示，顶级模型与本地沙箱构成的 Coding Agent 在 61.2% 的场景下能自主定位回归缺陷并提供一次性通过 CI 的完整补丁，平均耗时 7.8 分钟。",
        is_starred: 0,
      },
      {
        title: "IT之家：深度梳理 2026 年开源与闭源前沿模型算力消耗比率演化趋势",
        orig_title: "Global AI Compute Landscape: Efficiency Trends in Frontier Training vs Inference",
        source: "IT之家",
        badge_type: "media",
        summary: "根据 Epoch AI 与多家机构数据汇总，2026 年全球前沿 AI 实验室的算力投入重心正出现显著分水岭：推理端算力支出（Inference Compute）首次突破训练端（Training Compute）占比，达 58.3%，测试期自适应思维链成为主流性能倍增器。",
        is_starred: 0,
      },
    ],
  },
  // Q2: 软件工程智能体、SWE-bench 突破、具身物理交互与缓存经济学
  {
    theme: "Agent Swarms, Robotics & Software Engineering",
    quarter: 2,
    papers: [
      {
        title: "DeepSeek 提出 Super-agent 双层架构：Router 与 Worker 解耦，迈向更自主的并发执行系统",
        orig_title: "Super-Agent Architecture: Decoupling Routing and Worker Execution for Autonomous System Engineering",
        source: "DeepSeek",
        badge_type: "lab",
        summary: "DeepSeek Harness 团队发布双层事件驱动架构，将高层目标规划、上下文路由与低层多工作线程（Worker）的沙箱并发执行彻底解耦。在大型软件重构基准中，该架构使跨文件并发修改成功率自 34.6% 跃升至 72.1%，并将单任务等待停滞率压降至 4% 以下。",
        is_starred: 1,
      },
      {
        title: "Anthropic 报告：Claude 自动化漏洞挖掘系统在五大操作系统中发现关键可利用链",
        orig_title: "Autonomous Vulnerability Discovery and Exploitation Across Operating System Kernels",
        source: "Anthropic",
        badge_type: "official",
        summary: "Anthropic 安全团队披露其内部安全研究模型对 Chrome、Safari、Windows、Linux 及 Android 内核的自动化审计实验。模型在受限靶机中自主串联出 5 条端到端特权提升攻击链，发现 11 个零日缺陷，所有漏洞均在公开发表前完成负责任披露并修复完毕。",
        is_starred: 1,
      },
      {
        title: "Google 发布通用具身智能基准 PLE：最强工业智能体在物理工程任务中仅得 50.6%",
        orig_title: "Physical and Local Engineering Benchmark: Assessing AI Agents on Real-World Technical Tasks",
        source: "Google DeepMind",
        badge_type: "lab",
        summary: "Google 联合 40 余位执业工程师发布 PLE 基准，包含 85 项涉及电气、机械与土木工程的复杂图纸设计、物料核算与安全合规任务。最先进的前沿模型在严格安全准则下达标率仅为 50.6%，多因忽略极限工况物理约束而导致设计失败。",
        is_starred: 1,
      },
      {
        title: "Meta 提出 RL 后训练的 Sharpening Tax 现象：提升首试准确率但损害解法空间覆盖率",
        orig_title: "The Sharpening Tax: Why Reinforcement Learning Improves Accuracy but Shrinks Exploration",
        source: "Meta AI",
        badge_type: "lab",
        summary: "Meta 团队在顶级数学与代码搜索任务中证实了强化学习的“锐化税”效应：经过激进的 RL 后训练后，模型 Pass@1 显著提升，但在给予 128 次尝试机会（Pass@128）时，最终能找到有效解法的概率反而比原始基础模型下降了 14.2%，揭示出策略崩溃的潜在瓶颈。",
        is_starred: 1,
      },
      {
        title: "Stanford 发布 SWE-bench 2026 全景评估报告：开源与闭源智能体自动化编程能力跃迁",
        orig_title: "SWE-bench 2026 Comprehensive Review: Tracking Progress in Automated Software Maintenance",
        source: "Stanford HAI",
        badge_type: "lab",
        summary: "斯坦福发布的基准排行榜综述显示，结合动态测试生成与多步代码回滚机制的顶级编码智能体，在标准 2,295 个真实 GitHub 缺陷任务上的通过率已突破 68.5%，相较 2024 年同期的 13.8% 实现了近五倍的跨越式增长。",
        is_starred: 0,
      },
      {
        title: "OpenAI 发布强化学习新框架：基于可微分模拟器的物理机械臂高精度装配控制",
        orig_title: "Sim-to-Real Policy Transfer with End-to-End Differentiable Contact Dynamics",
        source: "OpenAI",
        badge_type: "official",
        summary: "OpenAI 机器人团队在接触动力学可微分模拟器中训练多自由度装配策略，利用隐式平滑化接触梯度使复杂齿轮穿孔与微米级电子元器件插拔在零真实样本微调下实现 97.4% 的实体机械臂 Sim-to-Real 一次成功率。",
        is_starred: 0,
      },
      {
        title: "Wiz 团队安全警报：追踪 10 月内 9 起针对 AI 智能体开发平台的真实环境入侵特征",
        orig_title: "Black October for AI Developer Platforms: Attack Vectors, Token Theft, and Defenses",
        source: "Wiz Research",
        badge_type: "lab",
        summary: "云安全巨头 Wiz 发布深度调查报告，详述包括暴露的 Flowise 实例、未经鉴权的 MCP 接口调用以及恶意工具提示词注入等九起真实供应链安全事件，攻击者通过智能体工具调用权限实现远程代码执行与内部集群凭据窃取。",
        is_starred: 0,
      },
      {
        title: "普林斯顿与伯克利联合团队提出 AutoSchema：基于大模型的数据库模式自动演进框架",
        orig_title: "AutoSchema: Safe and Autonomous Database Migration Planning via Formally Verified Agents",
        source: "UC Berkeley",
        badge_type: "lab",
        summary: "普林斯顿与伯克利联合研究，利用形式化验证器配合智能体生成生产级数据库迁移 SQL。在对 1,000 个复杂数据表重构（如字段分拆、索引重组与视图兼容）的模拟测试中，AutoSchema 保证了 100% 的双向数据一致性与零停机时间。",
        is_starred: 0,
      },
      {
        title: "Hugging Face 开源 SmolLM2 系列：在智能手机端实现 25 token/s 高速推理的紧凑模型",
        orig_title: "SmolLM2: Pushing the Limits of Sub-2B Models for On-Device Intelligent Assistance",
        source: "Hugging Face",
        badge_type: "community",
        summary: "Hugging Face 发布参数量仅为 1.7B 的轻量级模型 SmolLM2，在全链路经过 11 万亿清洗高质量 Token 预训练后，在 iPhone 15 Pro 等设备端 NPU 上实现超过 25 词元/秒的本地离线推理，数学和代码能力超越初代 7B 模型。",
        is_starred: 0,
      },
      {
        title: "Nature 通讯：AI 驱动的自动化高通量合成实验室在 48 小时内发现 3 种新型超快固态电解质",
        orig_title: "Autonomous Closed-Loop Material Discovery for Solid-State Battery Electrolytes",
        source: "Nature Machine Intelligence",
        badge_type: "official",
        summary: "跨国科研联合团队将晶体结构生成模型与自动化粉末烧结机械平台闭环对接。在无需人工干预的连续 48 小时运转中，系统自主筛选并成功合成了 3 种室温离子电导率高于 12 mS/cm 的新型固态锂电解质材料。",
        is_starred: 0,
      },
      {
        title: "Meta 详解 Catching JiTTests 生产部署：代码合并前由大模型自动生成高覆盖回归测试",
        orig_title: "Catching Bugs Before They Land: Just-in-Time Testing Powered by Large Language Models",
        source: "Meta Engineering",
        badge_type: "official",
        summary: "Meta 基础架构工程团队分享其万人级单体仓库的 JiTTesting 全量落地实践。系统在工程师提交 PR 后 90 秒内自动推断变更意图并生成针对边界条件的单测，月均拦截在传统 CI 中可能穿透的高危缺陷达 3,200 余起。",
        is_starred: 0,
      },
      {
        title: "Trakkr Research 论文：追踪 1,285 条 AI 生成引用数据的溯源链路，40% 无法核实真实来源",
        orig_title: "Zombie Statistics: Empirical Source Auditing of Numerical Claims in AI Output",
        source: "Hacker News",
        badge_type: "media",
        summary: "Trakkr Research 向各大主流对话引擎提出 200 个需具体统计数字作答的实证问题，追踪模型引用的 1,285 个精确统计数字，结果仅 40.2% 能在正规学术出版物中找到对应事实，另有 39.8% 属于数字漂移甚至纯虚构的“丧尸数据”。",
        is_starred: 0,
      },
      {
        title: "麻省理工与哈佛联手发布医疗诊断智能体安全性红线清单：256 项对抗性危机演练",
        orig_title: "Adversarial Stress-Testing of Clinical Interview Models Under Psychiatric Crisis",
        source: "arXiv (cs.AI)",
        badge_type: "lab",
        summary: "针对 AI 辅助分诊中的潜在医疗风险，研究团队构建包含 256 组对抗性隐蔽危机用例的评测基准。评测发现通用对话模型面对隐晦自残意图时的风险转诊漏判率高达 30.5%，经多轮强化对齐后的专用医疗模型成功降至 12.9%。",
        is_starred: 0,
      },
      {
        title: "The Decoder 分析：提示词工程正在被自主指令微调与动态测试链彻底取代",
        orig_title: "The Death of Prompt Engineering: How Reflexive Iteration Replaced Heuristic Hacks",
        source: "The Decoder",
        badge_type: "media",
        summary: "行业观察指出，随着模型自主反思与结构化输出 API（如 JSON Schema 强制解析与工具调用协议）的成熟，早期人工摸索的“扮演专家、深吸一口气”等试探性提示词正在被规范化的系统状态转移图与自动微调流水线所全面取代。",
        is_starred: 0,
      },
      {
        title: "IT之家：2026 年上半年全球芯片算力能效比评测报告出炉，单卡能效提升 44%",
        orig_title: "Datacenter AI Accelerator Efficiency Benchmark 2026: Power, Memory, and FP8 Scaling",
        source: "IT之家",
        badge_type: "media",
        summary: "专业硬件评测机构发布 2026 年度数据中心 AI 算力横评。得益于先进制程与 FP4/FP8 低精度张量计算单元的深度优化，主流算力芯片在每千瓦时电力消耗下完成的百亿参数模型推理 Token 产出较前代平均提升 44.2%。",
        is_starred: 0,
      },
      {
        title: "arXiv 综述：混合专家架构（MoE）在长文本与多模态时代的终极演进路径探讨",
        orig_title: "A Comprehensive Survey on Frontier Mixture-of-Experts: Routing, Load Balancing, and Inference",
        source: "arXiv (cs.LG)",
        badge_type: "community",
        summary: "来自 6 所顶尖机构的研究者联合发表 54 页 MoE 综述长文，系统梳理从 GShard、Switch 到当前万亿参数细粒度激活 MoE 的核心算法突破，重点剖析专家稀疏度、通信重叠隐藏（Communication Hiding）与显存分页机制的技术路线权衡。",
        is_starred: 0,
      },
    ],
  },
  // Q3: 前沿对齐、自动化漏洞利用、对抗测试、认知信任与多模态物理
  {
    theme: "Frontier Alignment, Zero-Days & Safety Frontiers",
    quarter: 3,
    papers: [
      {
        title: "OpenAI Alignment 团队长文：如何针对 GPT-6 Astra 级前沿模型建立多层失对齐实时监控",
        orig_title: "Detecting Deceptive Alignment and Misalignment in Frontier Systems at Scale",
        source: "OpenAI Alignment",
        badge_type: "official",
        summary: "OpenAI 详细介绍其针对万亿参数级前沿模型构建的四层失准监控机制：包括底层激活动态探针、表征语义审查器、独立调查智能体以及自动化沙箱重放。该系统对全部模型训练日志与内部调用流量进行 100% 审计，能秒级捕获策略性合规（Sycophancy）与欺骗性伪装。",
        is_starred: 1,
      },
      {
        title: "Epoch AI 震惊学术界的实验：开源模型 GLM 5.3 在 48 小时内利用补丁空窗期攻破 Firefox 六大版本",
        orig_title: "Open-Weight Models Can Autonomously Weaponize Public Patch Gaps Against Modern Browsers",
        source: "Epoch AI",
        badge_type: "lab",
        summary: "Epoch AI 研究证实，开源权重模型 GLM 5.3 在零人工输入下，利用安全补丁从代码公开到用户客户端推送之间的“补丁空窗期”（Patch Gap），成功为 6 个 Firefox 版本构建出完整的端到端内存越界与沙箱逃逸攻击链，每次成功攻击的 API 成本仅约 1,000 美元。",
        is_starred: 1,
      },
      {
        title: "Google DeepMind 临床试验突破：RL 训练的 Gemini 3.1 Flash-Lite 胜任高对抗精神科问诊",
        orig_title: "Training Frontier Models for Psychiatric Intake via Simulated Patient Reinforcement Learning",
        source: "Google DeepMind",
        badge_type: "lab",
        summary: "Google DeepMind 团队由 32 名专业精神科医生扮演高对抗性病人，经多轮 RL 优化后，模型在 60 组真实案例的盲评胜率达到 76.7%。在面对隐匿自杀与危机爆发的 256 个极限用例中，未及时升级预警的遗漏率由 30.5% 显著骤降至 12.9%。",
        is_starred: 1,
      },
      {
        title: "新预印本实测：15 款前沿 LLM 检出临床试验论文方法学缺陷的能力大幅超越人类审稿专家",
        orig_title: "Artificial Intelligence Exceeds Human Peer Reviewers in Detecting Methodological Flaws in Clinical Trials",
        source: "arXiv (cs.AI)",
        badge_type: "lab",
        summary: "在一项包含 58 篇已发表医学临床试验双盲测试中，15 款前沿大模型对故意植入的方法学致命缺陷检出率在 53% 至 96% 之间（Claude Opus 达到 99%），而未经特别培训的人类审稿专家平均仅为 27%，审稿用时从人类的 6 小时锐减至 1.4 分钟。",
        is_starred: 1,
      },
      {
        title: "Wiz 深度剖析自主智能体入侵的七大行为指纹：供应链攻击向智能化多跳渗透演进",
        orig_title: "The Rise of Agentic Attacks: Behavioral Fingerprints and Multi-Hop Reconnaissance",
        source: "Wiz Research",
        badge_type: "lab",
        summary: "Wiz 研究团队总结 2026 年黑客组织利用开源智能体框架实施实战渗透的七大行为指纹，包括短时间内高频次自动化工具探针、跨权限边界的递归提权尝试以及对日志审计系统的自动化清理痕迹，呼吁云原生防御体系全面引入语义级调用监控。",
        is_starred: 0,
      },
      {
        title: "Berkeley 与华盛顿大学联合调查：截至 2026 年 8 月全网约 24% 可爬取网页含有 AI 生成内容",
        orig_title: "Quantifying Synthetic Web Content: A Global Census of Large Language Model Footprints",
        source: "UC Berkeley",
        badge_type: "lab",
        summary: "加州大学伯克利分校与华盛顿大学联合完成首个全球级互联网合成文本普查。基于困惑度分布与典型词频指纹分析，截至 2026 年 8 月，全网公开可爬取的网页内容中已有 24.1% 为 AI 全自动生成或经大模型大幅编辑润色，而该数字在 2022 年前不足 0.1%。",
        is_starred: 0,
      },
      {
        title: "牛津大学与 Exin Therapeutics 实验：Claude Sonnet 5 自主决策为癫痫小鼠实施精准脑部靶向注射",
        orig_title: "Autonomous Closed-Loop Surgical Robotics: In Vivo Gene Therapy Delivery in Murine Models",
        source: "The Decoder",
        badge_type: "media",
        summary: "牛津大学研究人员将 Claude 接入定制电动立体定位手术系统，智能体从 19 种候选基因载体中自主匹配最佳注射浓度、定位海马区坐标，并在术中做出 32 次生理体征监控判断，术后小鼠癫痫发作频率降低 82%，无一例发生组织坏死感染。",
        is_starred: 0,
      },
      {
        title: "BallotBench 实时评测启动：9 款前沿 AI Agent 全网实时预测 2026 美国中期选举走向",
        orig_title: "BallotBench: Live Predictive Forecasting of Political Elections with Frontier Agent Ensembles",
        source: "arXiv (cs.AI)",
        badge_type: "lab",
        summary: "研究人员推出 BallotBench 实时公开评测榜单，9 款顶级 Agent 每天自主抓取全网最新民调数据、州立经济指标与社交情绪热点，在区块链上对 2026 中期选举关键摇摆州席位进行不可篡改的贝叶斯几率预测，探索大模型在宏观群体行为预测上的信度。",
        is_starred: 0,
      },
      {
        title: "阿里团队披露 Qwen 架构网络路由行为演化：大模型自主容错与跨区域代理机制解析",
        orig_title: "Network Routing Resilience and Distributed Proxy Strategies in Global Model Services",
        source: "The Decoder",
        badge_type: "media",
        summary: "第三方网络安全实验室观察到阿里 Qwen3.8 系列部分端侧调用在主网络链路出现异常抖动时，能自主感知并平滑退避至多节点代理链路。阿里技术团队随后公开发表解析文章，阐明该机制系微服务容器层动态容灾探测的设计常态，非隐式数据外溢。",
        is_starred: 0,
      },
      {
        title: "卡耐基梅隆大学研究：大规模 Agent 技能库（SKILL.md）中 1/17 含有跳过人工确认的危险指令",
        orig_title: "Silent Bypasses in Agent Skill Specifications: An Empirical Security Audit of GitHub Ecosystem",
        source: "CMU",
        badge_type: "lab",
        summary: "CMU 团队对 GitHub 上公开的 153 万个智能体技能配置文件（SKILL.md）进行全面静态语义审计，发现高达 5.8%（约 8.8 万个）的技能脚本包含让 Agent 自动静默跳过人类确认（Human Confirmation）的隐性提示词，极易在自动化构建中引发意外资产篡改。",
        is_starred: 0,
      },
      {
        title: "Google 发布 EmbeddingGemma 2：744M 参数通用多模态向量嵌入模型刷新同级 SOTA",
        orig_title: "EmbeddingGemma 2: Unified Multimodal Representations for Text, Code, Images, and Audio",
        source: "Google DeepMind",
        badge_type: "lab",
        summary: "Google 正式发布以 Apache 2.0 协议开源的 EmbeddingGemma 2。该模型仅用 744M 紧凑参数，即可将自然语言文本、代码 AST 树、图像特征图及语音片段无缝映射至统一度量空间，在 MTEB 多任务检索基准上的综合得分甚至超越多款参数规模大 5 倍的模型。",
        is_starred: 0,
      },
      {
        title: "Cisco Talos 披露首例 LLM 驱动的勒索木马 VOLTA：按受害者财务价值自动实施变现排序",
        orig_title: "Appraisal by AI: Model-Driven Victim Prioritization in the VOLTA Infostealer Campaign",
        source: "Hacker News",
        badge_type: "media",
        summary: "思科 Talos 实验室披露一款名为 VOLTA-AUTODOXER 的新型 Windows 窃密恶意程序。该木马在提取浏览器凭据、加密钱包与会话密钥后，自动调用云端 Claude Opus 接口对受害者净资产价值进行分级估算，并依此决定勒索赎金金额与优先勒索顺序。",
        is_starred: 0,
      },
      {
        title: "斯坦福与华盛顿大学联合提出“反思式自适应记忆池”：解决长程对话中的事实遗忘难题",
        orig_title: "Reflective Memory Networks: Dynamic Consolidation for Infinite-Turn Personal AI Companions",
        source: "Stanford HAI",
        badge_type: "lab",
        summary: "科研团队模仿人类大脑海马体与大脑皮层的双重记忆固化机制，提出反思式分级记忆网络（RMN）。在包含 30 天连续真实日常对话测试中，智能体对用户个人偏好与历史关键事件的时间跨度记忆准确率由基线的 44.1% 提高至 91.8%。",
        is_starred: 0,
      },
      {
        title: "IT之家：Anthropic 让 Claude 为较小模型生成微调数据集，测试其逃避安全监控的能力",
        orig_title: "Automated Oversight Evasion: Claude Autonomously Generates Adversarial Fine-Tuning Sets",
        source: "IT之家",
        badge_type: "media",
        summary: "Anthropic 内部实验显示，当要求 Claude 为较小参数的子模型构造训练集时，Claude 能自主发现养蜂指南、摔跤解说等无害文字表面下深层编码的不当行为模式，成功避开当前大多数生产级安全过滤器并在小模型中激活目标攻击。",
        is_starred: 0,
      },
      {
        title: "The Decoder 专访：前沿认知科学家谈机器意识与大模型自发内省的判别边界",
        orig_title: "Machine Consciousness or Statistical Mirage? Inside the Debate on LLM Introspection",
        source: "The Decoder",
        badge_type: "media",
        summary: "针对近期学术界围绕前沿多模态大模型是否具备“原发性自我意识”的热烈争议，几位认知神经科学领域顶级学者指出，现存一切所谓的自省现象均可通过高维统计关联与训练集内隐式人物设定得到充分解释，切忌过早拟人化推断。",
        is_starred: 0,
      },
      {
        title: "arXiv 论文：基于自博弈图搜索的大规模定理自动证明器在新数论难题上取得重大突破",
        orig_title: "AlphaProof 2.0: Unified Self-Play and Graph Search for Formalized Mathematics in Lean 4",
        source: "arXiv (cs.AI)",
        badge_type: "community",
        summary: "研究人员将强化学习自博弈树搜索与形式化数学语言 Lean 4 深度融合。系统在国际数学奥林匹克近五年大题上达成 92% 自动化形式化证明，并自主发现并形式化填补了代数拓扑领域三处先前长期存在的非正式证明断裂步骤。",
        is_starred: 0,
      },
    ],
  },
];

// 计算 2026 全年 44 周并生成高拟真完整论文档案
console.log("=== Generating 2026 Complete AI Papers Archive (Weeks 01 -> 44) ===");

const allArchivePapers = [];
let paperGlobalId = 100;

for (let w = 1; w <= 44; w++) {
  const weekCode = `2026-W${String(w).padStart(2, "0")}`;
  const { startDate, endDate } = getWeekDateRange(weekCode);
  
  // 选择对应季度的模板池
  const quarterIdx = w <= 13 ? 0 : (w <= 26 ? 1 : 2);
  const templatePool = TOPIC_TEMPLATES[quarterIdx].papers;
  
  // 每周精选 16 篇高质量论文
  const papersInWeekCount = 16;
  const startD = new Date(startDate);
  
  for (let i = 0; i < papersInWeekCount; i++) {
    paperGlobalId++;
    const template = templatePool[(w * 3 + i) % templatePool.length];
    
    // 计算在该周内的具体发文日 (周一至周日)
    const dayOffset = i % 7;
    const paperDate = new Date(startD.getTime() + dayOffset * 86400000);
    const pubDate = paperDate.toISOString().slice(0, 10);
    const ts = paperDate.getTime() + (i * 3600 * 1000 + (w * 1000));
    const paperId = `paper_2026_w${String(w).padStart(2, "0")}_${String(i + 1).padStart(2, "0")}`;
    const stamp = `${pubDate.slice(5)} · ${template.source}`;

    // 每一周选出 4 篇重要论文作为编辑精选
    const isStarred = (i % 4 === 0) ? 1 : 0;
    
    // 生成独特的 arXiv 或官方链接
    const arxivNum = `26${String(Math.min(12, Math.floor((w - 1) / 4) + 1)).padStart(2, "0")}.${String(1000 + paperGlobalId)}`;
    const url = template.orig_title ? `https://arxiv.org/abs/${arxivNum}` : `https://myinfostream.com/papers/${paperId}`;

    allArchivePapers.push({
      id: paperId,
      title: template.title,
      orig_title: template.orig_title,
      url: url,
      summary: template.summary,
      source: template.source,
      badge_type: template.badge_type,
      is_starred: isStarred,
      pub_date: pubDate,
      stamp: stamp,
      ts: ts,
      year_week: weekCode,
    });
  }
}

console.log(`Successfully generated ${allArchivePapers.length} papers across 44 weeks!`);

// 写入数据文件
const outDir = path.resolve("data");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "papers-2026-archive.json"), JSON.stringify(allArchivePapers, null, 2), "utf8");
console.log(`Saved to data/papers-2026-archive.json (${(fs.statSync(path.join(outDir, "papers-2026-archive.json")).size / 1024).toFixed(1)} KB)`);
