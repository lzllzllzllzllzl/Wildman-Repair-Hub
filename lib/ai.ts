import {
  AIAnalysisSchema,
  type AIAnalysis,
  type ReportInput,
} from "@/lib/types";

export interface AIProvider {
  readonly name: string;
  analyze(input: ReportInput, asset?: { code: string; category: string; storeId: string } | null): Promise<AIAnalysis>;
}

function contains(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}

function normalizeImpact(value: ReportInput["productionImpact"]) {
  return value;
}

export class LocalDeterministicAIProvider implements AIProvider {
  readonly name = "local-deterministic";

  async analyze(
    input: ReportInput,
    asset?: { code: string; category: string; storeId: string } | null,
  ): Promise<AIAnalysis> {
    const text = input.originalDescription.trim().toLowerCase();
    const symptoms: string[] = [];
    const evidence: string[] = [];
    const riskTags = new Set(input.userRiskTags.filter((tag) => tag !== "无明显风险"));
    let category = "不确定";
    let deviceType = asset?.category ?? "不确定";
    let priority: AIAnalysis["prioritySuggestion"] = "P3";
    let confidence: AIAnalysis["confidence"] = "medium";
    let requiresHumanReview = false;

    const highRisk = contains(text, ["冒烟", "漏电", "焦味", "烧焦", "电火花"]);
    const temperatureRisk = contains(text, ["温度", "升温", "不制冷", "化了", "温控", "冷柜"]);
    const noStart = contains(text, ["无法启动", "不能启动", "开不了机", "没反应", "不通电"]);
    const noise = contains(text, ["异响", "噪音", "咔咔", "声音很大"]);
    const shape = contains(text, ["不成型", "不太成型", "成型异常", "太软", "出品异常", "制作异常"]);
    const software = contains(text, ["收银", "pos", "软件", "系统", "支付"]);
    const aircon = contains(text, ["空调", "室温", "风口"]);
    const cleaning = contains(text, ["清洁", "清洗", "操作", "残留", "堵塞"]);
    const vague = text.length < 10 || contains(text, ["机器坏了", "设备坏了", "有问题"]) && !contains(text, ["异响", "温度", "冒烟", "漏电", "无法", "没反应"]);

    if (highRisk) {
      category = "电气/供电异常";
      symptoms.push("冒烟/漏电/焦味等高风险现象");
      evidence.push("原始描述命中高风险关键词");
      riskTags.add(contains(text, ["漏电", "电火花"]) ? "漏电" : "冒烟/焦味");
      priority = "P1";
      confidence = "high";
      requiresHumanReview = true;
    } else if (temperatureRisk) {
      category = "温控异常";
      symptoms.push("温度升高或制冷异常");
      evidence.push("原始描述包含温度/制冷异常");
      riskTags.add("温控风险");
      if (contains(text, ["食品", "原料", "奶浆", "产品"])) riskTags.add("食品安全");
      priority = "P1";
      confidence = "high";
      requiresHumanReview = riskTags.has("食品安全");
    } else if (software) {
      category = "软件/系统异常";
      deviceType = asset?.category ?? "收银设备";
      symptoms.push("收银或软件系统异常");
      evidence.push("原始描述包含收银/软件/系统关键词");
      priority = "P2";
      confidence = "high";
    } else if (aircon) {
      category = "设施制冷异常";
      deviceType = asset?.category ?? "空调设备";
      symptoms.push("空调不制冷");
      evidence.push("原始描述包含空调/室温关键词");
      priority = input.businessImpact === "高" ? "P2" : "P3";
      confidence = "high";
    } else if (cleaning) {
      category = "操作/清洁问题";
      symptoms.push("操作或清洁相关异常");
      evidence.push("原始描述包含操作/清洁关键词");
      priority = "P3";
      confidence = "medium";
    } else {
      if (noise) {
        category = "机械运行异常";
        symptoms.push("运行异响");
        evidence.push("原始描述包含异响关键词");
      }
      if (shape) {
        if (category === "不确定") category = "制作质量异常";
        symptoms.push("产品成型异常");
        evidence.push("原始描述包含成型/出品异常");
      }
      if (noStart) {
        category = "无法启动";
        symptoms.push("设备无法启动或无响应");
        evidence.push("原始描述包含无法启动/无响应");
      }
      if (noise || shape) {
        priority = input.productionImpact === "高" ? "P1" : "P2";
        confidence = noise && shape ? "high" : "medium";
      }
    }

    if (vague || category === "不确定") {
      confidence = "low";
      priority = "待确认";
      requiresHumanReview = true;
      if (!symptoms.length) symptoms.push("故障现象描述不明确");
      evidence.push("描述缺少可验证的具体故障现象");
    }

    const missingFields: string[] = [];
    const questions: string[] = [];
    if (!input.assetId) {
      missingFields.push("设备编号");
      questions.push("请选择具体故障设备或补充设备编号。");
    }
    if (input.occurredAtText === "不确定") {
      missingFields.push("发生时间");
      questions.push("请补充大致从何时开始出现异常。");
    }
    if (input.productionImpact === "不确定" && input.businessImpact === "不确定") {
      missingFields.push("业务影响");
      questions.push("请确认是否影响正常出品或门店营业。");
    }
    if (asset && asset.storeId !== input.storeId) {
      missingFields.push("设备与门店匹配");
      questions.unshift("所选设备不属于当前门店，请重新确认设备。");
      requiresHumanReview = true;
      confidence = "low";
      priority = "待确认";
    }

    const summaryParts = [
      asset?.code ?? "设备待确认",
      symptoms.join("、"),
      input.occurredAtText === "不确定" ? "发生时间待补充" : `发生于${input.occurredAtText}`,
      input.productionImpact !== "无" ? `生产影响${input.productionImpact}` : "未影响生产",
    ];

    return AIAnalysisSchema.parse({
      standardSummary: summaryParts.join("；") + "。",
      deviceType,
      symptoms,
      occurredAtText: input.occurredAtText,
      productionImpact: normalizeImpact(input.productionImpact),
      businessImpact: input.businessImpact,
      riskTags: [...riskTags],
      missingFields,
      faultCategorySuggestion: category,
      prioritySuggestion: priority,
      confidence,
      evidence,
      followUpQuestions: questions.slice(0, 3),
      requiresHumanReview,
    });
  }
}

export function getAIProvider(): AIProvider {
  return new LocalDeterministicAIProvider();
}
