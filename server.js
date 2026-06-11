const path = require("path");
const express = require("express");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const DEFAULT_REASON = "该方向具备进一步技术拆解、文献检索和专利检索价值。";
const MAX_EXPANSION_KEYWORDS = 30;
const aiCache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000;
let lastAIError = "";
const VALID_TYPES = [
  "mechanism",
  "material",
  "structure",
  "control",
  "user_pain",
  "adjacent_field",
  "evaluation",
  "product_opportunity",
  "established_technology",
  "recent_innovation"
];
const SHALLOW_TYPES = VALID_TYPES.slice(0, 8);
const DEEP_TYPES = ["established_technology", "recent_innovation"];

const TYPE_DEFAULTS = {
  mechanism: ["传热传质机理", "多物理场耦合"],
  material: ["功能材料", "表面改性"],
  structure: ["流道结构优化", "模块化结构"],
  control: ["多传感融合", "自适应控制"],
  user_pain: ["能耗与使用成本", "噪声与舒适性"],
  adjacent_field: ["汽车热管理迁移", "生物仿生技术"],
  evaluation: ["全生命周期评价", "可靠性加速测试"],
  product_opportunity: ["预测性维护", "场景化智能模式"]
};

const ENGLISH_DEFAULTS = {
  "传热传质机理": "heat and mass transfer mechanism",
  "多物理场耦合": "multiphysics coupling",
  "功能材料": "functional materials",
  "表面改性": "surface modification",
  "流道结构优化": "flow channel structure optimization",
  "模块化结构": "modular structure",
  "多传感融合": "multi-sensor fusion",
  "自适应控制": "adaptive control",
  "能耗与使用成本": "energy consumption and operating cost",
  "噪声与舒适性": "noise and comfort",
  "汽车热管理迁移": "automotive thermal management transfer",
  "生物仿生技术": "biomimetic technology",
  "全生命周期评价": "life cycle assessment",
  "可靠性加速测试": "accelerated reliability testing",
  "预测性维护": "predictive maintenance",
  "场景化智能模式": "scenario-based intelligent mode"
};

const MOCK_SCENARIOS = [
  {
    match: ["冰箱", "保鲜", "乙烯"],
    center: "冰箱保鲜技术",
    keywords: [
      ["气调保鲜", "controlled atmosphere preservation", "mechanism", "调控氧气与二氧化碳比例以降低果蔬呼吸速率。"],
      ["乙烯控制", "ethylene control", "mechanism", "抑制或降解乙烯可延缓果蔬成熟与衰老。"],
      ["光催化降解", "photocatalytic degradation", "material", "利用催化材料持续分解乙烯与异味分子。"],
      ["低温催化材料", "low-temperature catalytic materials", "material", "适合冰箱低温环境中的高效催化净化。"],
      ["分区微环境", "zoned microenvironment", "structure", "针对不同食材建立独立温湿度与气体环境。"],
      ["真空保鲜舱", "vacuum preservation chamber", "structure", "降低氧化反应并形成差异化产品功能。"],
      ["食材识别", "food recognition", "control", "识别食材类型后自动匹配保鲜策略。"],
      ["动态湿度控制", "dynamic humidity control", "control", "避免失水萎蔫与凝露腐败之间的矛盾。"],
      ["营养损失", "nutrient loss", "user_pain", "从营养保持角度评价真实保鲜价值。"],
      ["冷链物流迁移", "cold-chain logistics transfer", "adjacent_field", "迁移冷链中的监测、气调与包装技术。"],
      ["维生素保留率", "vitamin retention rate", "evaluation", "量化保鲜技术对食材营养品质的影响。"],
      ["保鲜状态可视化", "freshness status visualization", "product_opportunity", "将不可见的保鲜效果转化为用户可感知信息。"]
    ]
  },
  {
    match: ["空调", "除湿", "低能耗"],
    center: "空调低能耗除湿",
    keywords: [
      ["温湿度解耦", "temperature-humidity decoupling", "mechanism", "避免除湿过程中过度降温与再热能耗。"],
      ["膜除湿", "membrane dehumidification", "material", "利用选择性透湿膜实现低品位能驱动除湿。"],
      ["固体吸附剂", "solid desiccant", "material", "通过高容量吸湿材料拓展低温除湿路线。"],
      ["双蒸发温度", "dual evaporation temperature", "structure", "优化显热与潜热负荷匹配。"],
      ["新风旁通结构", "fresh-air bypass structure", "structure", "降低系统阻力并灵活管理新风湿负荷。"],
      ["露点预测控制", "dew-point predictive control", "control", "根据环境变化提前调整除湿能力。"],
      ["人体舒适模型", "thermal comfort model", "control", "以舒适感而非固定温度控制系统。"],
      ["闷湿感", "humid discomfort", "user_pain", "直接对应用户对除湿效果的核心感受。"],
      ["数据中心冷却迁移", "data-center cooling transfer", "adjacent_field", "借鉴高效热湿管理与自然冷却方案。"],
      ["单位除湿能耗", "specific moisture extraction rate", "evaluation", "衡量除湿效率的关键指标。"],
      ["无风感除湿", "draft-free dehumidification", "product_opportunity", "兼顾低能耗、舒适性和产品差异化。"]
    ]
  },
  {
    match: ["洗衣机", "低噪", "脱水"],
    center: "洗衣机低噪音脱水",
    keywords: [
      ["偏心激励", "unbalanced excitation", "mechanism", "识别并抑制脱水阶段的主要振动激励源。"],
      ["阻尼复合材料", "damping composite material", "material", "降低结构振动传递和辐射噪声。"],
      ["仿生减振结构", "biomimetic vibration isolation", "structure", "利用多级隔振结构改善宽频振动。"],
      ["配重布局优化", "counterweight layout optimization", "structure", "降低不平衡负载引起的机体摇摆。"],
      ["负载重分布", "load redistribution", "control", "在升速前主动调整衣物分布。"],
      ["阶次跟踪控制", "order tracking control", "control", "针对转速相关振动进行精准抑制。"],
      ["夜间使用噪声", "night-use noise", "user_pain", "围绕夜间场景定义更严格的声品质目标。"],
      ["汽车主动悬架迁移", "active suspension transfer", "adjacent_field", "借鉴主动减振与状态估计技术。"],
      ["声品质评价", "sound quality evaluation", "evaluation", "比单一分贝值更准确反映用户感知。"],
      ["静音夜洗模式", "silent night washing mode", "product_opportunity", "将低噪控制能力转化为明确产品场景。"]
    ]
  },
  {
    match: ["烤箱", "温控", "精准"],
    center: "烤箱精准温控",
    keywords: [
      ["辐射对流耦合", "radiation-convection coupling", "mechanism", "解释腔体内温度与上色均匀性的形成机制。"],
      ["高发射率涂层", "high-emissivity coating", "material", "改善辐射换热均匀性与升温效率。"],
      ["分区加热结构", "zoned heating structure", "structure", "实现不同位置与食材区域的独立热量调节。"],
      ["可变风道", "variable air duct", "structure", "动态调整热风循环方向与强度。"],
      ["多点温度融合", "multi-point temperature fusion", "control", "减少单点测温带来的控制偏差。"],
      ["模型预测控制", "model predictive control", "control", "根据热惯性预测温度变化并提前调节。"],
      ["局部焦糊", "localized scorching", "user_pain", "聚焦用户最直观的烘焙失败问题。"],
      ["半导体制造温控迁移", "semiconductor thermal control transfer", "adjacent_field", "借鉴高精度温场控制与校准方法。"],
      ["温场均匀性", "temperature field uniformity", "evaluation", "量化不同层位和区域的温差。"],
      ["烹饪数字孪生", "cooking digital twin", "product_opportunity", "通过模型预测食材熟度和最佳结束时间。"]
    ]
  },
  {
    match: ["净水器", "滤芯", "寿命"],
    center: "净水器滤芯寿命预测",
    keywords: [
      ["污染物累积机理", "contaminant accumulation mechanism", "mechanism", "建立水质、流量与滤芯衰减之间的关系。"],
      ["智能吸附材料", "smart adsorbent material", "material", "通过响应性材料感知吸附饱和状态。"],
      ["分级滤芯结构", "graded filter structure", "structure", "平衡过滤效率、压降与使用寿命。"],
      ["在线水质传感", "online water quality sensing", "control", "持续采集影响滤芯寿命的关键变量。"],
      ["剩余寿命模型", "remaining useful life model", "control", "用数据驱动模型预测真实剩余寿命。"],
      ["过早更换成本", "premature replacement cost", "user_pain", "减少保守更换造成的浪费。"],
      ["工业设备健康管理迁移", "prognostics and health management transfer", "adjacent_field", "迁移工业设备剩余寿命预测方法。"],
      ["出水安全裕度", "water safety margin", "evaluation", "保证寿命预测不牺牲饮水安全。"],
      ["滤芯订阅服务", "filter subscription service", "product_opportunity", "将预测能力连接到耗材服务模式。"],
      ["可解释寿命提醒", "explainable lifetime reminder", "product_opportunity", "向用户解释更换原因与风险。"]
    ]
  },
  {
    match: ["洗碗机", "烘干"],
    center: "洗碗机烘干技术",
    keywords: [
      ["热泵烘干", "heat pump drying", "mechanism", "通过热量循环降低烘干能耗。"],
      ["沸石吸附", "zeolite adsorption", "material", "利用吸湿放热材料强化低温烘干。"],
      ["疏水表面", "hydrophobic surface", "material", "促进水滴脱离并改善塑料餐具干燥。"],
      ["定向风刀", "directional air knife", "structure", "对难干区域进行局部气流强化。"],
      ["循环风道优化", "circulating air duct optimization", "structure", "改善腔体内气流均匀性与效率。"],
      ["湿度终点控制", "humidity endpoint control", "control", "准确判断烘干终点并避免过度加热。"],
      ["材质识别", "material recognition", "control", "针对塑料、玻璃和陶瓷匹配不同策略。"],
      ["塑料餐具难干", "plastic tableware drying difficulty", "user_pain", "直接对应当前产品最典型的烘干痛点。"],
      ["工业干燥迁移", "industrial drying transfer", "adjacent_field", "借鉴高效干燥设备的传热传质方案。"],
      ["残余水滴率", "residual droplet rate", "evaluation", "量化真实干燥效果并支持方案比较。"],
      ["自动开门协同", "automatic door opening coordination", "product_opportunity", "结合自然换气形成低能耗产品方案。"]
    ]
  }
];

MOCK_SCENARIOS.forEach((scenario) => {
  scenario.keywords.forEach(([zh, en]) => {
    ENGLISH_DEFAULTS[zh] = en;
  });
});

app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));

function cleanText(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function cleanStringArray(value) {
  return Array.isArray(value)
    ? [...new Set(value.map((item) => cleanText(item)).filter(Boolean))]
    : [];
}

function extractCoreKeyword(question) {
  const cleaned = cleanText(question, "家电技术创新")
    .replace(/[？?。！!]/g, "")
    .replace(/如何实现|如何进行|如何优化|如何创新|还有哪些新方向|怎么|怎样|可以/g, "")
    .trim();
  return cleaned.slice(0, 20) || "家电技术创新";
}

function translateFallback(zh) {
  return ENGLISH_DEFAULTS[zh] || `appliance innovation: ${zh}`;
}

function scoreValue(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, Math.round(number))) : fallback;
}

function inferScores(item, index, type) {
  const recent = type === "recent_innovation" || type === "adjacent_field";
  return {
    innovation_score: scoreValue(item && item.innovation_score, recent ? 88 - index % 8 : 68 + index % 18),
    retrieval_score: scoreValue(item && item.retrieval_score, 82 - index % 15),
    attention_score: scoreValue(item && item.attention_score, recent ? 76 + index % 12 : 62 + index % 20)
  };
}

function normalizeReason(reason, zh, center, originalQuestion) {
  const base = cleanText(reason).replace(/\s+/g, " ");
  const originalTopic = extractCoreKeyword(originalQuestion);
  const rawDefinition = base || `“${zh}”是一项与“${center}”相关的具体技术概念，用于描述其中的作用机理、关键部件或实现方法。`;
  const definitionSlice = rawDefinition.slice(0, 120);
  const definitionEnd = Math.max(definitionSlice.lastIndexOf("。"), definitionSlice.lastIndexOf("；"));
  const definition = `${definitionEnd > 55 ? definitionSlice.slice(0, definitionEnd) : definitionSlice.replace(/[。；]*$/, "")}。`;
  const application = `在“${originalTopic}”中，可将其应用于“${center}”相关环节，用于改善目标性能；实际采用时需要结合整机空间、能耗、安全性和成本进行适配。`;
  return `${definition}${application}`;
}

function buildMockExpansion(input) {
  const center = cleanText(input.center) || extractCoreKeyword(input.original_question);
  const isDeep = cleanStringArray(input.path).length >= 3;
  const context = `${input.original_question || ""} ${center}`;
  const scenario = MOCK_SCENARIOS.find((item) => item.match.some((term) => context.includes(term)));
  if (scenario) {
    return {
      center: cleanText(input.center) || scenario.center,
      keywords: scenario.keywords.map(([zh, en, type, reason], index) => ({
        zh,
        en,
        type: isDeep ? DEEP_TYPES[index % DEEP_TYPES.length] : type,
        reason
      }))
    };
  }
  const topic = center.replace(/技术|创新/g, "").trim() || "家电";
  const generated = [
    { zh: `${topic}核心机理`, en: `${topic} core mechanism`, type: "mechanism", reason: "厘清底层物理过程，便于寻找性能突破点。" },
    { zh: "多物理场耦合", en: "multiphysics coupling", type: "mechanism", reason: "从热、流、声、电等耦合关系发现系统级机会。" },
    { zh: `${topic}功能材料`, en: `${topic} functional materials`, type: "material", reason: "材料升级往往能直接改变效率、寿命与体验。" },
    { zh: "表面改性", en: "surface modification", type: "material", reason: "通过界面特性调控改善传热、润湿或耐久性。" },
    { zh: "流道结构优化", en: "flow channel structure optimization", type: "structure", reason: "结构与流场优化适合结合仿真和专利检索。" },
    { zh: "模块化结构", en: "modular structure", type: "structure", reason: "有利于维护、升级和产品平台化。" },
    { zh: "多传感融合", en: "multi-sensor fusion", type: "control", reason: "提升状态识别与控制精度。" },
    { zh: "自适应控制", en: "adaptive control", type: "control", reason: "根据负载与环境动态优化运行策略。" },
    { zh: "能耗与使用成本", en: "energy consumption and operating cost", type: "user_pain", reason: "是家电技术创新中的核心用户价值指标。" },
    { zh: "噪声与舒适性", en: "noise and comfort", type: "user_pain", reason: "适合发现用户体验层面的差异化机会。" },
    { zh: "汽车热管理迁移", en: "automotive thermal management transfer", type: "adjacent_field", reason: "汽车领域的高效热管理方案可迁移到家电系统。" },
    { zh: "生物仿生技术", en: "biomimetic technology", type: "adjacent_field", reason: "仿生结构和界面可提供跨领域创新启发。" },
    { zh: "全生命周期评价", en: "life cycle assessment", type: "evaluation", reason: "综合衡量能耗、材料与环境影响。" },
    { zh: "可靠性加速测试", en: "accelerated reliability testing", type: "evaluation", reason: "帮助验证创新方案的工程可行性。" },
    { zh: "预测性维护", en: "predictive maintenance", type: "product_opportunity", reason: "将状态感知转化为可落地的产品服务机会。" }
  ];
  return {
    center,
    keywords: generated.map((item, index) => ({
      ...item,
      type: isDeep ? DEEP_TYPES[index % DEEP_TYPES.length] : item.type
    }))
  };
}

function normalizeExpansion(raw, input) {
  const fallback = buildMockExpansion(input);
  const allowedTypes = cleanStringArray(input.path).length >= 3 ? DEEP_TYPES : SHALLOW_TYPES;
  const center = cleanText(raw && raw.center, fallback.center);
  const blocked = new Set([
    ...cleanStringArray(input.path),
    ...cleanStringArray(input.excluded_keywords)
  ].filter((term) => term !== center));
  const seen = new Set(blocked);
  const keywords = Array.isArray(raw && raw.keywords) ? raw.keywords : [];
  const normalized = keywords
    .map((item, index) => {
      const type = allowedTypes.includes(item && item.type) ? item.type : allowedTypes[0];
      const zh = cleanText(item && item.zh).slice(0, 24);
      if (!zh || seen.has(zh) || zh === center) return null;
      seen.add(zh);
      return {
        zh,
        en: cleanText(item.en, translateFallback(zh)).slice(0, 80),
        type,
        reason: normalizeReason(item.reason, zh, center, input.original_question),
        parent: cleanText(item.parent, center),
        relation: cleanText(item.relation, "细化方向"),
        source: cleanText(item.source, "ai_generated"),
        ...inferScores(item, index, type)
      };
    })
    .filter(Boolean)
    .slice(0, MAX_EXPANSION_KEYWORDS);

  return { center, keywords: normalized.slice(0, MAX_EXPANSION_KEYWORDS) };
}

async function fetchRetrievalCandidates(input) {
  const endpoint = cleanText(process.env.KEYWORD_RETRIEVAL_URL);
  if (!endpoint) return [];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data.keywords) ? data.keywords.map((item) => ({ ...item, source: "retrieval_embedding" })) : [];
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

function mergeKeywordSources(aiResult, retrievalKeywords, input = {}) {
  if (!retrievalKeywords.length) return aiResult;
  const blocked = new Set([
    ...cleanStringArray(input.path),
    ...cleanStringArray(input.excluded_keywords)
  ].filter((term) => term !== aiResult.center));
  const byName = new Map(aiResult.keywords.map((item) => [item.zh, item]));
  retrievalKeywords.forEach((item) => {
    const zh = cleanText(item.zh);
    if (!zh || blocked.has(zh) || zh === aiResult.center) return;
    const existing = byName.get(zh);
    if (existing) {
      existing.retrieval_score = Math.max(existing.retrieval_score || 0, scoreValue(item.retrieval_score, 90));
      existing.source = "ai+retrieval";
    } else if (byName.size < MAX_EXPANSION_KEYWORDS) {
      byName.set(zh, item);
    }
  });
  return { ...aiResult, keywords: [...byName.values()] };
}

async function fetchSecondaryAICandidates(systemPrompt, userPrompt) {
  if (!process.env.SECONDARY_AI_API_KEY || !process.env.SECONDARY_AI_BASE_URL || !process.env.SECONDARY_AI_MODEL) return [];
  try {
    const raw = await callAI({
      systemPrompt,
      userPrompt,
      temperature: 0.65,
      provider: {
        apiKey: process.env.SECONDARY_AI_API_KEY,
        baseUrl: process.env.SECONDARY_AI_BASE_URL,
        model: process.env.SECONDARY_AI_MODEL
      }
    });
    return Array.isArray(raw.keywords) ? raw.keywords.map((item) => ({ ...item, source: "secondary_ai" })) : [];
  } catch {
    return [];
  }
}

function buildMockSearchQuery(input) {
  const pathTerms = cleanStringArray(input.path);
  const pinned = cleanStringArray(input.pinned_keywords);
  const chinese = [...new Set([...pathTerms, ...pinned])];
  if (!chinese.length) chinese.push(extractCoreKeyword(input.original_question));
  const english = chinese.map(translateFallback);
  const quoted = english.map((term) => `"${term}"`);
  const core = quoted[0];
  const details = quoted.slice(1);
  return {
    chinese_keywords: chinese,
    english_keywords: english,
    broad_query: `(${core} OR "home appliance innovation") AND (efficiency OR performance OR design)`,
    focused_query: [core, ...details].join(" AND "),
    innovative_query: `(${core}) AND (biomimetic OR cross-industry OR "multiphysics coupling" OR "functional materials")`,
    novelty_query: `(${core}) AND (${details.join(" OR ") || '"emerging technology"'}) AND (novel OR hybrid OR coupled)`,
    patent_query: `(${core}) AND (invention OR apparatus OR system OR method)`,
    adjacent_fields: ["汽车热管理", "工业过程控制", "功能材料", "生物仿生"],
    recommended_databases: ["Google Scholar", "Semantic Scholar", "OpenAlex", "Web of Science", "Scopus", "Lens Patent", "Google Patents"],
    research_directions: [
      { title: "机理与系统耦合优化", description: "从底层机理和多物理场耦合寻找效率与性能突破点。" },
      { title: "感知控制与预测性维护", description: "利用传感、算法和状态预测形成可落地的智能功能。" },
      { title: "跨领域技术迁移", description: "检索汽车、工业控制和仿生领域中的成熟技术并评估迁移路径。" }
    ],
    innovation_concepts: [
      {
        title: `${chinese.slice(0, 3).join(" + ")}组合方案`,
        concept: `围绕“${cleanText(input.innovation_goal, "形成差异化创新")}”组合路径关键词，构建可验证的跨技术方案。`,
        novelty: "将不同技术路径组合到同一使用场景中，重点验证耦合收益与现有方案差异。",
        validation_query: `(${quoted.join(" AND ")}) AND (hybrid OR coupled OR integrated)`,
        key_risk: "技术耦合后的成本、可靠性和工程可制造性仍需验证。"
      }
    ]
  };
}

function normalizeSearchQuery(raw, input) {
  const fallback = buildMockSearchQuery(input);
  const directions = Array.isArray(raw && raw.research_directions)
    ? raw.research_directions.map((item) => ({
      title: cleanText(item && item.title, "待探索研究方向"),
      description: cleanText(item && item.description, "建议进一步开展文献与专利检索。")
    })).filter((item) => item.title)
    : [];
  return {
    chinese_keywords: cleanStringArray(raw && raw.chinese_keywords).length ? cleanStringArray(raw.chinese_keywords) : fallback.chinese_keywords,
    english_keywords: cleanStringArray(raw && raw.english_keywords).length ? cleanStringArray(raw.english_keywords) : fallback.english_keywords,
    broad_query: cleanText(raw && raw.broad_query, fallback.broad_query),
    focused_query: cleanText(raw && raw.focused_query, fallback.focused_query),
    innovative_query: cleanText(raw && raw.innovative_query, fallback.innovative_query),
    novelty_query: cleanText(raw && raw.novelty_query, fallback.novelty_query),
    patent_query: cleanText(raw && raw.patent_query, fallback.patent_query),
    adjacent_fields: cleanStringArray(raw && raw.adjacent_fields).length ? cleanStringArray(raw.adjacent_fields) : fallback.adjacent_fields,
    recommended_databases: cleanStringArray(raw && raw.recommended_databases).length ? cleanStringArray(raw.recommended_databases) : fallback.recommended_databases,
    research_directions: directions.length ? directions : fallback.research_directions,
    innovation_concepts: Array.isArray(raw && raw.innovation_concepts) && raw.innovation_concepts.length
      ? raw.innovation_concepts.slice(0, 5).map((item) => ({
        title: cleanText(item && item.title, "创新组合方案"),
        concept: cleanText(item && item.concept, "组合探索路径中的技术形成创新方案。"),
        novelty: cleanText(item && item.novelty, "需要通过文献和专利检索验证新颖性。"),
        validation_query: cleanText(item && item.validation_query, fallback.novelty_query),
        key_risk: cleanText(item && item.key_risk, "需要验证工程可行性、成本和可靠性。")
      }))
      : fallback.innovation_concepts
  };
}

function parseJsonContent(content) {
  if (content && typeof content === "object") return content;
  const text = cleanText(content);
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : text)
    .replace(/^`?json\s*/i, "")
    .replace(/```/g, "")
    .trim();
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(candidate.slice(start, end + 1));
    throw new Error("AI response did not contain valid JSON");
  }
}

async function callAI({ systemPrompt, userPrompt, temperature, provider = {} }) {
  const apiKey = provider.apiKey || process.env.AI_API_KEY;
  if (!apiKey) throw new Error("AI_API_KEY is not configured");
  const baseUrl = cleanText(provider.baseUrl || process.env.AI_BASE_URL, "https://dashscope.aliyuncs.com/compatible-mode/v1").replace(/\/$/, "");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  let response;
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: cleanText(provider.model || process.env.AI_MODEL, "qwen-turbo"),
        temperature,
        max_tokens: 7000,
        enable_thinking: false,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]
      })
    });
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) {
    const errorBody = await response.text();
    const safeBody = errorBody.slice(0, 500).replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]");
    throw new Error(`AI provider returned ${response.status}: ${safeBody}`);
  }
  const result = await response.json();
  const parsed = parseJsonContent(result.choices?.[0]?.message?.content);
  lastAIError = "";
  return parsed;
}

const expansionSystemPrompt = `你是一个跨学科家电技术创新助手，服务对象是家电领域的研发专家、产品创新专家、设计研究人员和技术战略人员。

你的任务不是泛泛地头脑风暴，而是帮助用户把一个家电技术问题拆解成可以继续探索、检索文献、检索专利和形成创新方案的关键词网络。

你需要关注以下维度：
1. 物理机制：如传热、传质、吸附、冷凝、流体、振动、声学、电场、磁场、光催化、相变等；
2. 材料方向：如多孔材料、相变材料、疏水材料、抗菌材料、催化材料、膜材料、传感材料等；
3. 结构方向：如风道、流道、腔体、喷淋结构、导流结构、模块化结构、微结构表面等；
4. 控制方向：如传感器、模型预测控制、AI识别、自适应控制、数字孪生、强化学习、用户行为预测等；
5. 用户痛点：如能耗高、噪音大、时间长、残留多、异味、维护麻烦、成本高、体验不可感知等；
6. 相邻领域迁移：如医疗设备、食品加工、汽车热管理、航空除冰、工业干燥、建筑环境控制、农业保鲜、微流控等；
7. 评价指标：如能耗、效率、速度、稳定性、噪音、寿命、成本、维护性、安全性、用户体验等；
8. 产品机会：如高端差异化、低成本结构创新、智能程序、可视化反馈、耗材服务、模块化升级等。

你必须输出结构化 JSON，不要输出多余解释。`;

const searchSystemPrompt = `你是一个家电技术文献检索与专利检索专家。

你的任务是根据用户在关键词泡泡图中的探索路径，生成可用于学术数据库和专利数据库的检索关键词与 Boolean 检索式。

你需要把用户的探索路径转化为：
1. 中文关键词；
2. 英文关键词；
3. 宽泛检索式；
4. 精准检索式；
5. 跨领域创新检索式；
6. 专利检索式；
7. 推荐数据库；
8. 后续研究方向。
9. 可执行的创新组合方案与新颖性验证检索式。

你需要兼顾家电领域表达、工程技术表达、学术论文常用表达、专利检索常用表达和相邻领域迁移表达。
你必须输出结构化 JSON，不要输出多余解释。`;

function formatList(value) {
  const items = cleanStringArray(value);
  return items.length ? items.join(" → ") : "暂无";
}

function buildExpansionUserPrompt(input) {
  const center = cleanText(input.center, extractCoreKeyword(input.original_question));
  const path = cleanStringArray(input.path);
  const pinned = cleanStringArray(input.pinned_keywords);
  const excluded = cleanStringArray(input.excluded_keywords);
  const ancestors = path.filter((term) => term !== center);
  const isDeep = path.length >= 3;
  const today = new Date().toISOString().slice(0, 10);
  const adaptiveInstructions = path.length <= 1
    ? "当前处于探索初期：优先广泛覆盖不同维度，避免关键词集中在单一技术路线。"
    : path.length === 2
      ? `当前处于聚焦阶段：围绕“${center}”生成可形成父子、依赖或组合关系的下一层概念，并避免重复已出现路径。`
      : `当前处于深层细化阶段：必须同时受祖先路径“${formatList(ancestors)}”与当前中心词“${center}”约束，拆解具体子机制、关键参数、部件、算法或实施路线；结合锁定关键词 ${formatList(pinned)} 寻找依赖关系和可组合机会。`;
  const classificationInstructions = isDeep
    ? `当前日期是 ${today}。当前探索已经进入第 ${path.length} 层技术细节。不要再按物理机制、材料、结构等大类发散。

请只按以下两类输出：
- established_technology：已有技术。包括已有论文、专利、工程方案或较成熟的可实施技术。
- recent_innovation：近一年创新技术。指相对于当前日期、近 12 个月值得重点检索的新机制、新材料、新算法、新结构或跨领域迁移方向。

两类数量尽量均衡。recent_innovation 必须使用可检索的技术表达，不要使用营销词，不要虚构具体论文、专利、机构或发布日期。`
    : `当前仍处于技术地图的前两层，请覆盖多个创新维度。

关键词 type 只能从以下类型中选择：
mechanism, material, structure, control, user_pain, adjacent_field, evaluation, product_opportunity`;
  return `用户正在围绕一个家电技术问题进行关键词发散。

原始技术问题：
${cleanText(input.original_question, "家电技术创新")}

当前中心关键词：
${center}

用户已经点击形成的探索路径：
${formatList(path)}

用户锁定但未必点击的关键词：
${formatList(pinned)}

上一层已经展示、禁止重复的关键词：
${formatList(excluded)}

研究领域：
${cleanText(input.domain, "家电技术创新")}

请基于以上信息，生成下一层关键词泡泡。

自适应发散策略：
${adaptiveInstructions}

要求：
1. 最多输出 30 个关键词；能够生成多少高相关关键词就输出多少，不得为了凑数量补充低相关或通用关键词；
2. 每个关键词必须适合继续点击发散；
3. 每个关键词必须适合后续文献检索或专利检索；
4. 不要只生成已有量产技术，也要包含相邻领域可迁移的潜在机制；
5. 不要生成过于宽泛的词，例如“创新”“智能”“优化”；
6. 尽量生成具有研究价值的词，例如“低温等离子体除味”“毛细导流结构”“电润湿控水”“模型预测控制”等；
7. 关键词之间要有差异，避免重复；
8. 结合用户路径判断下一层应该更深入，而不是回到泛泛的大类；
9. 如果用户路径较短，可以覆盖多个方向；
10. 如果用户路径已经较深，应围绕当前中心词进一步细化；
11. 中文关键词尽量不超过 12 个汉字，英文关键词使用学术检索常用表达；
12. 为每个关键词给出它与当前中心词的 relation，并提供 0-100 的 innovation_score、retrieval_score、attention_score；
13. innovation_score 表示潜在创新度，retrieval_score 表示适合文献/专利检索的价值，attention_score 表示行业关注度；
14. parent 固定填写当前中心关键词，source 填写 ai_generated；
15. reason 必须使用两部分结构，且总长度约 120-180 个中文字符。第一部分先解释该关键词是什么、核心原理或工作方式；第二部分必须明确说明它在原始技术问题“${cleanText(input.original_question, "家电技术创新")}”中可应用于哪个部件或流程、如何发挥作用，以及可能的适用限制。即使已经进入很深的子层级，也不能省略原始问题中的应用说明。不同关键词必须使用不同的解释内容，不要套用固定句式，不要把“值得探索、建议检索、工程验证”等泛泛建议作为主体。
16. 每个关键词必须与当前中心关键词存在明确、直接的技术关联；禁止使用可以原样复用于其他家电问题的通用词凑数。
17. 各类型下的关键词必须针对当前问题分别生成。例如材料方向必须说明适用于当前对象的具体材料，结构方向必须是当前设备可采用的具体结构。
18. 下一层关键词必须同时符合原始问题、全部祖先路径和当前中心词形成的技术语境，不能仅围绕当前中心词脱离上层目标自由联想。
19. 严禁重复或轻微改写探索路径、当前中心词及上一层已展示关键词；下一层必须比当前词更具体，优先输出具体材料名称、机理变量、结构部件、控制参数、实验方法或可实施技术路线。
20. 不要仅在历史关键词前后添加“技术、系统、方法、优化、智能、新型”等词形成伪细化。

${classificationInstructions}

输出格式必须是 JSON：
{"center":"${center}","keywords":[{"zh":"中文关键词","en":"English keyword","type":"${isDeep ? "established_technology" : "mechanism"}","reason":"先解释名词定义与原理；再说明它在原始技术问题中的具体应用、作用与限制","parent":"${center}","relation":"父子或依赖关系","innovation_score":85,"retrieval_score":90,"attention_score":72,"source":"ai_generated"}]}`;
}

function buildSearchUserPrompt(input) {
  const literatureOnly = input.mode === "literature_search";
  const innovationRequirements = literatureOnly ? "" : `
10. 生成 3-5 个创新组合方案。每个方案必须组合至少两个路径或锁定关键词，并说明组合逻辑、新颖性、关键风险和用于验证是否已有类似方案的英文检索式；
11. 创新方案不能只是功能堆叠，必须说明技术之间为什么可能产生协同作用；
12. 增加 novelty_query，专门用于检索技术组合是否已有论文或专利公开。`;
  const outputFormat = literatureOnly
    ? `{"chinese_keywords":["中文关键词"],"english_keywords":["English keyword"],"broad_query":"(\\"home appliance\\" OR \\"domestic appliance\\") AND (...)","focused_query":"","patent_query":"","recommended_databases":["Google Scholar","Semantic Scholar","OpenAlex","Web of Science","Scopus","Lens Patent","Google Patents"],"research_directions":[{"title":"研究方向名称","description":"这个方向为什么值得继续检索"}]}`
    : `{"chinese_keywords":["中文关键词"],"english_keywords":["English keyword"],"broad_query":"(\\"home appliance\\" OR \\"domestic appliance\\") AND (...)","focused_query":"","innovative_query":"","novelty_query":"","patent_query":"","adjacent_fields":["相邻领域1"],"recommended_databases":["Google Scholar","Semantic Scholar","OpenAlex","Web of Science","Scopus","Lens Patent","Google Patents"],"research_directions":[{"title":"研究方向名称","description":"这个方向为什么值得继续检索"}],"innovation_concepts":[{"title":"创新方案名称","concept":"技术组合逻辑与工作原理","novelty":"潜在新颖性","validation_query":"用于验证是否已有类似技术组合的英文 Boolean 检索式","key_risk":"关键工程风险"}]}`;
  return `用户通过关键词泡泡图探索了一个家电技术问题。

原始技术问题：
${cleanText(input.original_question, "家电技术创新")}

用户点击路径：
${formatList(input.path)}

用户锁定关键词：
${formatList(input.pinned_keywords)}

用户选择的创新目标：
${cleanText(input.innovation_goal, "形成具有技术差异化的新方案")}

创新约束与场景：
${cleanText(input.innovation_brief, "暂无额外约束")}

请根据这些信息生成文献检索和专利检索所需的关键词与检索式。

要求：
1. 生成 5-10 个中文关键词；
2. 生成 5-10 个符合学术检索习惯的英文关键词；
3. ${literatureOnly ? "生成 broad_query 和 focused_query 两条英文文献 Boolean 检索式；跨领域启发与组合新颖性检索式不在本页面生成" : "生成 broad_query、focused_query、innovative_query 三条英文文献 Boolean 检索式，并生成 novelty_query 验证组合新颖性"}；
4. 生成一条用于专利检索的 patent_query；
5. 推荐适合使用的数据库；
6. 生成 3-5 个后续研究方向；
7. 检索式要使用 AND、OR、括号和英文同义词；
8. 不要生成过长、不可用的检索式；
9. 如果路径中包含中文词，请给出准确的英文技术表达。
10. 检索关键词不能只是照抄点击路径；必须基于完整路径向下拆解为更具体的机理、关键部件、材料名称、控制变量、性能指标和实验表征方法。
11. focused_query 应同时保留上层应用语境与最深层技术限定，避免只检索最后一个孤立关键词。
${innovationRequirements}

输出格式必须是 JSON：
${outputFormat}`;
}

function getCached(key) {
  const item = aiCache.get(key);
  if (!item || Date.now() - item.createdAt > CACHE_TTL_MS) {
    aiCache.delete(key);
    return null;
  }
  return item.value;
}

function setCached(key, value) {
  aiCache.set(key, { createdAt: Date.now(), value });
  if (aiCache.size > 150) aiCache.delete(aiCache.keys().next().value);
}

app.post("/api/expand-keywords", async (req, res) => {
  const input = req.body || {};
  const classification = cleanStringArray(input.path).length >= 3 ? "technology_maturity" : "innovation_dimensions";
  const cacheKey = `expand:${JSON.stringify(input)}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json({ ...cached, meta: { mode: "ai", cached: true, classification } });
  try {
    const userPrompt = buildExpansionUserPrompt(input);
    const [raw, secondaryKeywords, retrievalKeywords] = await Promise.all([
      callAI({ systemPrompt: expansionSystemPrompt, userPrompt, temperature: 0.7 }),
      fetchSecondaryAICandidates(expansionSystemPrompt, userPrompt),
      fetchRetrievalCandidates(input)
    ]);
    const secondaryNormalized = secondaryKeywords.length
      ? normalizeExpansion({ center: cleanText(raw.center, input.center), keywords: secondaryKeywords }, input).keywords
      : [];
    let normalized = mergeKeywordSources(normalizeExpansion(raw, input), secondaryNormalized, input);
    normalized = mergeKeywordSources(normalized, retrievalKeywords, input);
    setCached(cacheKey, normalized);
    res.json({ ...normalized, meta: { mode: "ai", cached: false, classification } });
  } catch (error) {
    lastAIError = cleanText(error && error.message, "AI service unavailable").slice(0, 600);
    console.error("expand-keywords AI fallback:", lastAIError);
    res.json({
      ...normalizeExpansion(buildMockExpansion(input), input),
      meta: { mode: "mock", fallback_reason: "AI service unavailable", classification }
    });
  }
});

app.post("/api/generate-search-query", async (req, res) => {
  const input = req.body || {};
  try {
    const raw = await callAI({
      systemPrompt: searchSystemPrompt,
      userPrompt: buildSearchUserPrompt(input),
      temperature: 0.4
    });
    res.json({ ...normalizeSearchQuery(raw, input), meta: { mode: "ai" } });
  } catch (error) {
    lastAIError = cleanText(error && error.message, "AI service unavailable").slice(0, 600);
    console.error("generate-search-query AI fallback:", lastAIError);
    res.json({
      ...normalizeSearchQuery(buildMockSearchQuery(input), input),
      meta: { mode: "mock", fallback_reason: "AI service unavailable" }
    });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    mode: process.env.AI_API_KEY ? "ai" : "mock",
    model: cleanText(process.env.AI_MODEL, "qwen-turbo"),
    ai_provider: cleanText(process.env.AI_BASE_URL, "https://dashscope.aliyuncs.com/compatible-mode/v1").replace(/^https?:\/\//, ""),
    last_ai_error: lastAIError || null
  });
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Appliance innovation tool: http://localhost:${PORT}`);
  console.log(`Mode: ${process.env.AI_API_KEY ? "AI with mock fallback" : "mock"}`);
});
