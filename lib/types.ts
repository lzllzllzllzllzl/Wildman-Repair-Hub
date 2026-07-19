import { z } from "zod";

export const impactValues = ["高", "中", "低", "无", "不确定"] as const;
export const priorityValues = ["P1", "P2", "P3", "待确认"] as const;
export const confidenceValues = ["high", "medium", "low"] as const;

export const AIAnalysisSchema = z.object({
  standardSummary: z.string().min(1),
  deviceType: z.string(),
  symptoms: z.array(z.string()),
  occurredAtText: z.string(),
  productionImpact: z.enum(impactValues),
  businessImpact: z.enum(impactValues),
  riskTags: z.array(z.string()),
  missingFields: z.array(z.string()),
  faultCategorySuggestion: z.string(),
  prioritySuggestion: z.enum(priorityValues),
  confidence: z.enum(confidenceValues),
  evidence: z.array(z.string()),
  followUpQuestions: z.array(z.string()).max(3),
  requiresHumanReview: z.boolean(),
});

export type AIAnalysis = z.infer<typeof AIAnalysisSchema>;

export const ReportInputSchema = z.object({
  storeId: z.string().min(1),
  assetId: z.string().nullable().optional(),
  originalDescription: z.string().trim().min(5, "故障描述至少需要 5 个字"),
  occurredAtText: z.string().min(1),
  productionImpact: z.enum(impactValues),
  businessImpact: z.enum(impactValues),
  userRiskTags: z.array(z.string()).min(1),
  reporterName: z.string().trim().min(1),
  attachmentUrls: z.array(z.string()).default([]),
});

export type ReportInput = z.infer<typeof ReportInputSchema>;

export const roles = ["store", "manager", "supplier", "admin"] as const;
export type Role = (typeof roles)[number];

export const orderStatuses = [
  "待判断",
  "待补充",
  "待人工确认",
  "待接单",
  "超时未接单",
  "处理中",
  "待验收",
  "返修中",
  "已关闭",
  "已取消",
] as const;

export type OrderStatus = (typeof orderStatuses)[number];

export type RouteCandidate = {
  ruleId: string;
  ruleCode: string;
  ruleName: string;
  priority: number;
  partyId: string | null;
  partyName: string;
  priorityLevel: string;
  acceptanceSlaSeconds: number;
  requiresHumanReview: boolean;
  explanation: string;
};

export type RouteDecision = {
  matchedRules: RouteCandidate[];
  selected: RouteCandidate | null;
  requiresHumanReview: boolean;
  reason: string;
};
