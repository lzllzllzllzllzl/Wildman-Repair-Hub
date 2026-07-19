import { randomUUID } from "node:crypto";
import type { PrismaClient, WorkOrder } from "@prisma/client";
import { db } from "@/lib/db";
import { getAIProvider } from "@/lib/ai";
import { fromJson, toJson } from "@/lib/json";
import { routeWorkOrder } from "@/lib/routing";
import { calculateAcceptanceDeadline, getSlaStatus } from "@/lib/sla";
import {
  assertCanClose,
  assertRole,
  assertSupplierAssignment,
  assertTransition,
} from "@/lib/state-machine";
import {
  ReportInputSchema,
  roles,
  type AIAnalysis,
  type OrderStatus,
  type ReportInput,
} from "@/lib/types";
import { z } from "zod";

const roleSchema = z.enum(roles);

function publicCode(prefix: string) {
  const now = new Date();
  return `${prefix}-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(Date.now()).slice(-6)}`;
}

async function addStateEvent(
  client: PrismaClient,
  order: Pick<WorkOrder, "id" | "status">,
  toStatus: string,
  actorRole: string,
  actorName: string,
  reason: string,
) {
  await client.stateEvent.create({
    data: {
      id: randomUUID(),
      workOrderId: order.id,
      fromStatus: order.status,
      toStatus,
      actorRole,
      actorName,
      reason,
    },
  });
}

async function buildOrderForFault(
  faultId: string,
  input: ReportInput,
  analysis: AIAnalysis,
  client = db,
) {
  const [store, asset, rules] = await Promise.all([
    client.store.findUniqueOrThrow({ where: { id: input.storeId } }),
    input.assetId ? client.asset.findUnique({ where: { id: input.assetId } }) : null,
    client.routingRule.findMany({ include: { responsibilityParty: true } }),
  ]);
  if (!asset) return null;
  const decision = routeWorkOrder({ ai: analysis, asset, store, rules });
  const status: OrderStatus = decision.requiresHumanReview ? "待人工确认" : "待接单";
  const dispatchedAt = status === "待接单" ? new Date() : null;
  const selectedPriority =
    decision.selected?.priorityLevel && decision.selected.priorityLevel !== "待确认"
      ? decision.selected.priorityLevel
      : analysis.prioritySuggestion;
  const deadline = dispatchedAt
    ? calculateAcceptanceDeadline(dispatchedAt, selectedPriority, decision.selected?.acceptanceSlaSeconds)
    : null;
  const order = await client.workOrder.create({
    data: {
      id: randomUUID(),
      code: publicCode("WO"),
      faultEventId: faultId,
      assetId: asset.id,
      finalFaultCategory: analysis.faultCategorySuggestion,
      finalPriority: selectedPriority,
      recommendedPartyId: decision.selected?.partyId ?? null,
      finalPartyId: decision.requiresHumanReview ? null : decision.selected?.partyId ?? null,
      routeExplanation: decision.reason,
      routeTraceJson: toJson(decision.matchedRules),
      status,
      slaStatus: status === "待接单" ? "计时中" : "未开始",
      dispatchedAt,
      acceptanceDeadline: deadline,
      isDemo: true,
    },
  });
  await addStateEvent(
    client as PrismaClient,
    { id: order.id, status: "待判断" },
    status,
    "system",
    "本地 AI + 规则引擎",
    decision.reason,
  );
  if (status === "待接单") {
    await client.notificationLog.create({
      data: {
        id: randomUUID(),
        workOrderId: order.id,
        channel: "站内通知",
        recipient: decision.selected?.partyName ?? "责任方",
        type: "新派单",
        content: `${order.code} 已派发，请在 Demo SLA 内接单。`,
        isDemo: true,
      },
    });
  }
  return order;
}

export async function createFaultReport(raw: unknown) {
  const input = ReportInputSchema.parse(raw);
  const [store, asset] = await Promise.all([
    db.store.findUniqueOrThrow({ where: { id: input.storeId } }),
    input.assetId ? db.asset.findUnique({ where: { id: input.assetId } }) : null,
  ]);
  const analysis = await getAIProvider().analyze(input, asset);
  const fault = await db.faultEvent.create({
    data: {
      id: randomUUID(),
      code: publicCode("FE"),
      storeId: store.id,
      assetId: asset?.id ?? null,
      originalDescription: input.originalDescription,
      attachmentUrls: toJson(input.attachmentUrls),
      occurredAtText: input.occurredAtText,
      productionImpact: input.productionImpact,
      businessImpact: input.businessImpact,
      userRiskTags: toJson(input.userRiskTags),
      reporterName: input.reporterName,
      status: analysis.missingFields.length ? "待补充" : analysis.requiresHumanReview ? "待人工确认" : "已生成工单",
      aiResultJson: toJson(analysis),
      aiHistoryJson: toJson([{ version: 1, createdAt: new Date().toISOString(), analysis }]),
      aiSummary: analysis.standardSummary,
      aiFaultCategory: analysis.faultCategorySuggestion,
      aiPrioritySuggestion: analysis.prioritySuggestion,
      aiConfidence: analysis.confidence,
      missingFields: toJson(analysis.missingFields),
      followUpQuestions: toJson(analysis.followUpQuestions),
      requiresHumanReview: analysis.requiresHumanReview,
      isDemo: true,
    },
  });

  if (analysis.missingFields.length) {
    return { fault, order: null, analysis };
  }
  const order = await buildOrderForFault(fault.id, input, analysis);
  return { fault, order, analysis };
}

export async function supplementFault(faultId: string, raw: unknown) {
  const payload = z.object({
    assetId: z.string().min(1),
    supplementText: z.string().trim().min(2),
    role: roleSchema,
  }).parse(raw);
  assertRole(payload.role, ["store"], "补充信息");
  const fault = await db.faultEvent.findUniqueOrThrow({ where: { id: faultId } });
  const asset = await db.asset.findUniqueOrThrow({ where: { id: payload.assetId } });
  if (asset.storeId !== fault.storeId) throw new Error("所选设备不属于报修门店。");
  const input: ReportInput = {
    storeId: fault.storeId,
    assetId: asset.id,
    originalDescription: `${fault.originalDescription}；补充：${payload.supplementText}`,
    occurredAtText: fault.occurredAtText,
    productionImpact: fault.productionImpact as ReportInput["productionImpact"],
    businessImpact: fault.businessImpact as ReportInput["businessImpact"],
    userRiskTags: fromJson(fault.userRiskTags, []),
    reporterName: fault.reporterName,
    attachmentUrls: fromJson(fault.attachmentUrls, []),
  };
  const analysis = await getAIProvider().analyze(input, asset);
  const nextVersion = fault.analysisVersion + 1;
  const history = fromJson<Array<{ version: number; createdAt: string; analysis: AIAnalysis }>>(
    fault.aiHistoryJson,
    [],
  );
  const updated = await db.faultEvent.update({
    where: { id: fault.id },
    data: {
      assetId: asset.id,
      supplementText: payload.supplementText,
      analysisVersion: { increment: 1 },
      aiHistoryJson: toJson([
        ...history,
        { version: nextVersion, createdAt: new Date().toISOString(), analysis },
      ]),
      status: analysis.requiresHumanReview ? "待人工确认" : "已生成工单",
      aiResultJson: toJson(analysis),
      aiSummary: analysis.standardSummary,
      aiFaultCategory: analysis.faultCategorySuggestion,
      aiPrioritySuggestion: analysis.prioritySuggestion,
      aiConfidence: analysis.confidence,
      missingFields: toJson(analysis.missingFields),
      followUpQuestions: toJson(analysis.followUpQuestions),
      requiresHumanReview: analysis.requiresHumanReview,
    },
  });
  const existing = await db.workOrder.findUnique({ where: { faultEventId: fault.id } });
  const order = existing ?? await buildOrderForFault(fault.id, input, analysis);
  return { fault: updated, order, analysis };
}

export async function sweepExpiredOrders() {
  const expired = await db.workOrder.findMany({
    where: {
      status: "待接单",
      acceptedAt: null,
      acceptanceDeadline: { lte: new Date() },
    },
  });
  for (const order of expired) {
    await db.$transaction(async (tx) => {
      await addStateEvent(tx as unknown as PrismaClient, order, "超时未接单", "system", "SLA 自动化", "超过 Demo 接单截止时间，自动升级。");
      await tx.workOrder.update({ where: { id: order.id }, data: { status: "超时未接单", slaStatus: "已超时" } });
      const recipients = order.finalPriority === "P1" ? ["维修管理人员", "运营管理员"] : ["维修管理人员"];
      await tx.notificationLog.createMany({
        data: recipients.map((recipient) => ({
          id: randomUUID(),
          workOrderId: order.id,
          channel: "站内通知",
          recipient,
          type: order.finalPriority === "P1" ? "P1超时升级" : "超时升级",
          content: `${order.code} 已超过 Demo 接单 SLA，请处理异常。`,
          isDemo: true,
        })),
      });
    });
  }
  return expired.length;
}

const ActionSchema = z.object({
  action: z.enum([
    "accept", "reject", "start", "complete", "approve", "rejectAcceptance",
    "restart", "manualReview", "redispatch", "cancel", "rerunAI",
  ]),
  role: roleSchema,
  actorName: z.string().default("Demo 用户"),
  actorPartyId: z.string().optional(),
  reason: z.string().optional(),
  finalFaultCategory: z.string().optional(),
  finalPriority: z.string().optional(),
  finalPartyId: z.string().optional(),
  repairCause: z.string().optional(),
  repairAction: z.string().optional(),
  partsUsed: z.string().optional(),
  comment: z.string().optional(),
});

export async function performOrderAction(orderId: string, raw: unknown) {
  const input = ActionSchema.parse(raw);
  const order = await db.workOrder.findUniqueOrThrow({ where: { id: orderId }, include: { faultEvent: true, finalParty: true } });
  const status = order.status as OrderStatus;
  const now = new Date();

  if (input.action === "accept") {
    assertRole(input.role, ["supplier"], "接单");
    assertSupplierAssignment(input.actorPartyId, order.finalPartyId);
    assertTransition(status, "处理中");
    await db.$transaction(async (tx) => {
      await addStateEvent(tx as unknown as PrismaClient, order, "处理中", input.role, input.actorName, "责任方接受工单并进入处理。");
      await tx.workOrder.update({ where: { id: order.id }, data: { status: "处理中", slaStatus: "已完成", acceptedAt: now } });
      await tx.asset.update({ where: { id: order.assetId }, data: { operationalStatus: "维修中" } });
    });
  } else if (input.action === "reject") {
    assertRole(input.role, ["supplier"], "拒单");
    assertSupplierAssignment(input.actorPartyId, order.finalPartyId);
    if (!input.reason?.trim()) throw new Error("拒单必须填写原因。");
    assertTransition(status, "待人工确认");
    await db.$transaction(async (tx) => {
      await addStateEvent(tx as unknown as PrismaClient, order, "待人工确认", input.role, input.actorName, `供应商拒单：${input.reason}`);
      await tx.workOrder.update({ where: { id: order.id }, data: { status: "待人工确认", slaStatus: "未开始", rejectionReason: input.reason } });
      await tx.notificationLog.create({ data: { id: randomUUID(), workOrderId: order.id, channel: "站内通知", recipient: "维修管理人员", type: "供应商拒单", content: `${order.code} 被拒单：${input.reason}`, isDemo: true } });
    });
  } else if (input.action === "start") {
    assertRole(input.role, ["supplier"], "开始处理");
    assertSupplierAssignment(input.actorPartyId, order.finalPartyId);
    if (status !== "处理中") throw new Error("只有处理中的工单可以开始维修。");
    await db.$transaction(async (tx) => {
      await addStateEvent(tx as unknown as PrismaClient, order, "处理中", input.role, input.actorName, "工程师开始处理。");
      await tx.workOrder.update({ where: { id: order.id }, data: { repairStartedAt: now } });
    });
  } else if (input.action === "complete") {
    assertRole(input.role, ["supplier"], "提交维修完成");
    assertSupplierAssignment(input.actorPartyId, order.finalPartyId);
    if (!input.repairCause?.trim() || !input.repairAction?.trim()) throw new Error("实际故障原因和维修动作均为必填。");
    assertTransition(status, "待验收");
    await db.$transaction(async (tx) => {
      await addStateEvent(tx as unknown as PrismaClient, order, "待验收", input.role, input.actorName, "维修结果已提交，等待门店验收。");
      await tx.workOrder.update({ where: { id: order.id }, data: { status: "待验收", repairCompletedAt: now, repairCause: input.repairCause, repairAction: input.repairAction, partsUsed: input.partsUsed ?? "无" } });
      await tx.asset.update({ where: { id: order.assetId }, data: { operationalStatus: "待验收" } });
      await tx.notificationLog.create({ data: { id: randomUUID(), workOrderId: order.id, channel: "站内通知", recipient: "报修门店", type: "待验收", content: `${order.code} 已提交维修完成，请门店验收。`, isDemo: true } });
    });
  } else if (input.action === "approve") {
    assertRole(input.role, ["store"], "验收通过");
    assertTransition(status, "已关闭");
    assertCanClose(status, "通过");
    await db.$transaction(async (tx) => {
      await addStateEvent(tx as unknown as PrismaClient, order, "已关闭", input.role, input.actorName, input.comment || "门店验收通过。");
      await tx.workOrder.update({ where: { id: order.id }, data: { status: "已关闭", acceptanceResult: "通过", acceptanceComment: input.comment || "门店验收通过", acceptanceAt: now, closedAt: now, slaStatus: "已完成" } });
      await tx.asset.update({ where: { id: order.assetId }, data: { operationalStatus: "正常" } });
    });
  } else if (input.action === "rejectAcceptance") {
    assertRole(input.role, ["store"], "验收不通过");
    if (!input.reason?.trim()) throw new Error("验收不通过必须填写原因。");
    assertTransition(status, "返修中");
    await db.$transaction(async (tx) => {
      await addStateEvent(tx as unknown as PrismaClient, order, "返修中", input.role, input.actorName, `验收不通过：${input.reason}`);
      await tx.workOrder.update({ where: { id: order.id }, data: { status: "返修中", acceptanceResult: "不通过", acceptanceComment: input.reason, acceptanceAt: now, returnCount: { increment: 1 } } });
      await tx.asset.update({ where: { id: order.assetId }, data: { operationalStatus: "维修中" } });
    });
  } else if (input.action === "restart") {
    assertRole(input.role, ["supplier"], "接受返修");
    assertSupplierAssignment(input.actorPartyId, order.finalPartyId);
    assertTransition(status, "处理中");
    await db.$transaction(async (tx) => {
      await addStateEvent(tx as unknown as PrismaClient, order, "处理中", input.role, input.actorName, "责任方接受返修并重新处理。");
      await tx.workOrder.update({ where: { id: order.id }, data: { status: "处理中", repairStartedAt: now } });
    });
  } else if (input.action === "manualReview") {
    assertRole(input.role, ["manager", "admin"], "人工确认并派发");
    if (!input.reason?.trim() || !input.finalPartyId || !input.finalPriority || !input.finalFaultCategory) throw new Error("人工决策必须填写类别、等级、责任方和原因。");
    assertTransition(status, "待接单");
    const deadline = calculateAcceptanceDeadline(now, input.finalPriority);
    const newParty = await db.responsibilityParty.findUniqueOrThrow({ where: { id: input.finalPartyId } });
    const oldParty = order.finalParty?.name ?? "未定责";
    const decisionLog = `人工决策：类别 ${order.finalFaultCategory} → ${input.finalFaultCategory}；等级 ${order.finalPriority} → ${input.finalPriority}；责任方 ${oldParty} → ${newParty.name}；原因：${input.reason}`;
    await db.$transaction(async (tx) => {
      await addStateEvent(tx as unknown as PrismaClient, order, "待接单", input.role, input.actorName, decisionLog);
      await tx.workOrder.update({ where: { id: order.id }, data: { status: "待接单", finalFaultCategory: input.finalFaultCategory, finalPriority: input.finalPriority, finalPartyId: input.finalPartyId, manuallyReviewed: true, manualReviewReason: input.reason, dispatchedAt: now, acceptanceDeadline: deadline, slaStatus: "计时中" } });
    });
  } else if (input.action === "redispatch") {
    assertRole(input.role, ["manager", "admin"], "重新定责并派发");
    if (status !== "超时未接单" && status !== "待人工确认") throw new Error("只有超时或待人工确认工单可重新派发。");
    if (!input.reason?.trim() || !input.finalPartyId) throw new Error("重新派发必须选择责任方并填写原因。");
    const finalPriority = input.finalPriority ?? order.finalPriority;
    const deadline = calculateAcceptanceDeadline(now, finalPriority);
    const newParty = await db.responsibilityParty.findUniqueOrThrow({ where: { id: input.finalPartyId } });
    const oldParty = order.finalParty?.name ?? "未定责";
    const redispatchLog = `重新定责：责任方 ${oldParty} → ${newParty.name}；等级 ${order.finalPriority} → ${finalPriority}；原因：${input.reason}`;
    await db.$transaction(async (tx) => {
      if (status === "超时未接单") {
        await addStateEvent(tx as unknown as PrismaClient, order, "待人工确认", input.role, input.actorName, "超时工单进入人工复核。");
        await tx.stateEvent.create({ data: { id: randomUUID(), workOrderId: order.id, fromStatus: "待人工确认", toStatus: "待接单", actorRole: input.role, actorName: input.actorName, reason: redispatchLog } });
      } else {
        await addStateEvent(tx as unknown as PrismaClient, order, "待接单", input.role, input.actorName, redispatchLog);
      }
      await tx.workOrder.update({ where: { id: order.id }, data: { status: "待接单", finalPartyId: input.finalPartyId, finalPriority, manuallyReviewed: true, manualReviewReason: input.reason, dispatchedAt: now, acceptanceDeadline: deadline, acceptedAt: null, slaStatus: "计时中" } });
    });
  } else if (input.action === "cancel") {
    assertRole(input.role, ["manager", "admin"], "取消工单");
    if (!input.reason?.trim()) throw new Error("取消工单必须填写原因。");
    if (status === "已关闭" || status === "已取消") throw new Error("已关闭或已取消工单不能再次取消。");
    assertTransition(status, "已取消");
    await db.$transaction(async (tx) => {
      await addStateEvent(tx as unknown as PrismaClient, order, "已取消", input.role, input.actorName, input.reason!);
      await tx.workOrder.update({ where: { id: order.id }, data: { status: "已取消", slaStatus: "不适用" } });
    });
  } else if (input.action === "rerunAI") {
    assertRole(input.role, ["manager", "admin"], "重新运行 AI 分析");
    const fault = order.faultEvent;
    const asset = await db.asset.findUnique({ where: { id: order.assetId } });
    const report: ReportInput = {
      storeId: fault.storeId,
      assetId: fault.assetId,
      originalDescription: fault.supplementText ? `${fault.originalDescription}；补充：${fault.supplementText}` : fault.originalDescription,
      attachmentUrls: fromJson(fault.attachmentUrls, []),
      occurredAtText: fault.occurredAtText,
      productionImpact: fault.productionImpact as ReportInput["productionImpact"],
      businessImpact: fault.businessImpact as ReportInput["businessImpact"],
      userRiskTags: fromJson(fault.userRiskTags, []),
      reporterName: fault.reporterName,
    };
    const analysis = await getAIProvider().analyze(report, asset);
    const nextVersion = fault.analysisVersion + 1;
    const history = fromJson<Array<{ version: number; createdAt: string; analysis: AIAnalysis }>>(
      fault.aiHistoryJson,
      [],
    );
    await db.$transaction(async (tx) => {
      await tx.faultEvent.update({ where: { id: fault.id }, data: { aiResultJson: toJson(analysis), aiHistoryJson: toJson([...history, { version: nextVersion, createdAt: new Date().toISOString(), analysis }]), aiSummary: analysis.standardSummary, aiFaultCategory: analysis.faultCategorySuggestion, aiPrioritySuggestion: analysis.prioritySuggestion, aiConfidence: analysis.confidence, missingFields: toJson(analysis.missingFields), followUpQuestions: toJson(analysis.followUpQuestions), requiresHumanReview: analysis.requiresHumanReview, analysisVersion: { increment: 1 } } });
      await addStateEvent(tx as unknown as PrismaClient, order, order.status, input.role, input.actorName, "使用确定性本地 AI 重新分析，结果已更新。");
    });
  }
  return db.workOrder.findUniqueOrThrow({ where: { id: order.id }, include: { faultEvent: true, asset: true, finalParty: true, stateEvents: { orderBy: { timestamp: "asc" } } } });
}

export async function getBootstrapData() {
  await sweepExpiredOrders();
  const [stores, assets, parties, rules, faults, orders, notifications] = await Promise.all([
    db.store.findMany({ orderBy: { code: "asc" } }),
    db.asset.findMany({ include: { store: true, defaultParty: true }, orderBy: { code: "asc" } }),
    db.responsibilityParty.findMany({ orderBy: { code: "asc" } }),
    db.routingRule.findMany({ include: { responsibilityParty: true }, orderBy: [{ priority: "asc" }, { code: "asc" }] }),
    db.faultEvent.findMany({ include: { store: true, asset: true }, orderBy: { createdAt: "desc" } }),
    db.workOrder.findMany({ include: { faultEvent: { include: { store: true } }, asset: true, finalParty: true, recommendedParty: true, stateEvents: { orderBy: { timestamp: "asc" } } }, orderBy: { createdAt: "desc" } }),
    db.notificationLog.findMany({ orderBy: { sentAt: "desc" }, take: 30 }),
  ]);
  const now = new Date();
  const enrichedOrders = orders.map((order) => ({
    ...order,
    liveSlaStatus: getSlaStatus(order.acceptanceDeadline, order.acceptedAt, now),
  }));
  return { stores, assets, parties, rules, faults, orders: enrichedOrders, notifications, generatedAt: now };
}
