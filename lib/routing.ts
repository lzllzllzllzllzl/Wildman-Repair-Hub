import type { Asset, ResponsibilityParty, RoutingRule, Store } from "@prisma/client";
import { stringList } from "@/lib/json";
import type { AIAnalysis, RouteCandidate, RouteDecision } from "@/lib/types";

type RouteInput = {
  ai: AIAnalysis;
  asset: Asset | null;
  store: Store;
  rules: (RoutingRule & { responsibilityParty: ResponsibilityParty | null })[];
};

function matchesList(json: string, value: string) {
  const list = stringList(json);
  return list.length === 0 || list.includes("*") || list.includes(value);
}

function matchesRisk(json: string, risks: string[]) {
  const required = stringList(json);
  return required.length === 0 || required.some((risk) => risks.includes(risk));
}

export function routeWorkOrder({ ai, asset, store, rules }: RouteInput): RouteDecision {
  if (!asset) {
    return {
      matchedRules: [],
      selected: null,
      requiresHumanReview: true,
      reason: "设备尚未唯一识别，不能执行自动责任路由。",
    };
  }
  if (asset.storeId !== store.id) {
    return {
      matchedRules: [],
      selected: null,
      requiresHumanReview: true,
      reason: "设备与报修门店不匹配，已阻止自动派单。",
    };
  }
  if (ai.confidence === "low") {
    return {
      matchedRules: [],
      selected: null,
      requiresHumanReview: true,
      reason: "AI 置信度低，按硬规则转维修管理人员复核。",
    };
  }

  const matched = rules
    .filter((rule) => {
      if (!rule.enabled) return false;
      if (!matchesList(rule.assetCategories, asset.category)) return false;
      if (!matchesList(rule.faultCategories, ai.faultCategorySuggestion)) return false;
      if (!matchesRisk(rule.riskTags, ai.riskTags)) return false;
      if (!matchesList(rule.regions, store.region)) return false;
      if (rule.warrantyCondition && rule.warrantyCondition !== "*" && rule.warrantyCondition !== asset.warrantyStatus) return false;
      return true;
    })
    .sort((a, b) => a.priority - b.priority)
    .map<RouteCandidate>((rule) => ({
      ruleId: rule.id,
      ruleCode: rule.code,
      ruleName: rule.name,
      priority: rule.priority,
      partyId: rule.responsibilityPartyId,
      partyName: rule.responsibilityParty?.name ?? "维修管理人员",
      priorityLevel: rule.priorityLevel,
      acceptanceSlaSeconds: rule.acceptanceSlaSeconds,
      requiresHumanReview: rule.requiresHumanReview,
      explanation: rule.explanation,
    }));

  if (!matched.length) {
    return {
      matchedRules: [],
      selected: null,
      requiresHumanReview: true,
      reason: "没有唯一可用规则命中，进入人工复核。",
    };
  }

  const topPriority = matched[0].priority;
  const top = matched.filter((candidate) => candidate.priority === topPriority);
  const distinctParties = new Set(top.map((candidate) => candidate.partyId));
  if (distinctParties.size > 1) {
    return {
      matchedRules: matched,
      selected: null,
      requiresHumanReview: true,
      reason: `规则 ${top.map((item) => item.ruleCode).join("、")} 同优先级但责任方冲突，进入人工复核。`,
    };
  }

  const selected = top[0];
  const mustReview = ai.requiresHumanReview || selected.requiresHumanReview || !selected.partyId;
  return {
    matchedRules: matched,
    selected,
    requiresHumanReview: mustReview,
    reason: mustReview
      ? `${selected.ruleCode} 已命中，但因风险或规则要求必须人工复核。`
      : `命中 ${selected.ruleCode}：${selected.explanation}`,
  };
}
