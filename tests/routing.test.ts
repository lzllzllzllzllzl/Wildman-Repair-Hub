import { describe, expect, it } from "vitest";
import { routeWorkOrder } from "@/lib/routing";
import type { AIAnalysis } from "@/lib/types";

const store = { id: "s1", region: "华中" } as any;
const asset = { id: "a1", code: "GEL-001", storeId: "s1", category: "Gelato制作设备", warrantyStatus: "保修内" } as any;
const ai: AIAnalysis = {
  standardSummary: "异响",
  deviceType: "Gelato制作设备",
  symptoms: ["运行异响"],
  occurredAtText: "今天",
  productionImpact: "中",
  businessImpact: "中",
  riskTags: [],
  missingFields: [],
  faultCategorySuggestion: "机械运行异常",
  prioritySuggestion: "P2",
  confidence: "high",
  evidence: ["异响"],
  followUpQuestions: [],
  requiresHumanReview: false,
};
const party = { id: "p1", name: "供应商A（模拟）" } as any;
const rule = {
  id: "r1", code: "R003", name: "保修内", enabled: true, priority: 20,
  assetCategories: '["Gelato制作设备"]',
  faultCategories: '["机械运行异常"]',
  riskTags: "[]", warrantyCondition: "保修内", regions: '["华中"]',
  responsibilityPartyId: "p1", priorityLevel: "P2", acceptanceSlaSeconds: 120,
  requiresHumanReview: false, explanation: "唯一绑定", responsibilityParty: party,
} as any;

describe("确定性责任路由", () => {
  it("按数字最小优先级选择唯一责任方", () => {
    const fallback = { ...rule, id: "r2", code: "R099", priority: 99, responsibilityPartyId: "p2", responsibilityParty: { id: "p2", name: "兜底" } };
    const result = routeWorkOrder({ ai, asset, store, rules: [fallback, rule] });
    expect(result.selected?.ruleCode).toBe("R003");
    expect(result.selected?.partyId).toBe("p1");
    expect(result.requiresHumanReview).toBe(false);
  });

  it("同优先级不同责任方转人工", () => {
    const conflict = { ...rule, id: "r2", code: "R004", responsibilityPartyId: "p2", responsibilityParty: { id: "p2", name: "供应商B" } };
    const result = routeWorkOrder({ ai, asset, store, rules: [rule, conflict] });
    expect(result.selected).toBeNull();
    expect(result.requiresHumanReview).toBe(true);
    expect(result.reason).toContain("冲突");
  });

  it("低置信度不进入自动路由", () => {
    const result = routeWorkOrder({ ai: { ...ai, confidence: "low" }, asset, store, rules: [rule] });
    expect(result.requiresHumanReview).toBe(true);
    expect(result.matchedRules).toHaveLength(0);
  });
});
