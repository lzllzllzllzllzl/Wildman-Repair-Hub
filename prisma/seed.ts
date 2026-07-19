import { PrismaClient } from "@prisma/client";
import { LocalDeterministicAIProvider } from "../lib/ai";
import { toJson } from "../lib/json";
import { calculateAcceptanceDeadline } from "../lib/sla";
import type { ReportInput } from "../lib/types";

const prisma = new PrismaClient();

const stores = [
  { id: "store-001", code: "STORE-001", name: "光谷店（模拟）", region: "华中", type: "直营", address: "武汉市洪山区光谷示范地址（模拟）", managerName: "张店长（模拟）", phone: "138****0001", status: "营业中", isDemo: true },
  { id: "store-002", code: "STORE-002", name: "江汉路店（模拟）", region: "华中", type: "加盟", address: "武汉市江汉区江汉路示范地址（模拟）", managerName: "李店长（模拟）", phone: "138****0002", status: "营业中", isDemo: true },
  { id: "store-003", code: "STORE-003", name: "徐家汇店（模拟）", region: "华东", type: "加盟", address: "上海市徐汇区示范地址（模拟）", managerName: "王店长（模拟）", phone: "138****0003", status: "营业中", isDemo: true },
];

const parties = [
  { id: "party-a", code: "SUP-A", name: "设备供应商A（模拟）", type: "设备供应商", serviceCategories: toJson(["Gelato制作设备"]), serviceRegions: toJson(["华中"]), contactName: "周工程师（模拟）", contactPhone: "139****1001", status: "有效", isDemo: true },
  { id: "party-b", code: "SUP-B", name: "设备供应商B（模拟）", type: "设备供应商", serviceCategories: toJson(["低温储存设备", "售卖温控设备"]), serviceRegions: toJson(["华中", "华东"]), contactName: "陈工程师（模拟）", contactPhone: "139****1002", status: "有效", isDemo: true },
  { id: "party-c", code: "SUP-C", name: "设备供应商C（模拟）", type: "设备供应商", serviceCategories: toJson(["Gelato制作设备"]), serviceRegions: toJson(["华东"]), contactName: "何工程师（模拟）", contactPhone: "139****1003", status: "有效", isDemo: true },
  { id: "party-maint", code: "INT-M", name: "内部维修组（模拟）", type: "内部维修", serviceCategories: toJson(["操作/清洁问题", "一般设备"]), serviceRegions: toJson(["*"]), contactName: "维修值班（模拟）", contactPhone: "400-000-1004", status: "有效", isDemo: true },
  { id: "party-it", code: "INT-IT", name: "内部IT（模拟）", type: "内部IT", serviceCategories: toJson(["收银设备"]), serviceRegions: toJson(["*"]), contactName: "IT值班（模拟）", contactPhone: "400-000-1005", status: "有效", isDemo: true },
  { id: "party-d", code: "SUP-D", name: "设施供应商D（模拟）", type: "物业/设施", serviceCategories: toJson(["空调设备", "水电设施"]), serviceRegions: toJson(["华东"]), contactName: "设施值班（模拟）", contactPhone: "139****1006", status: "有效", isDemo: true },
];

const assets = [
  { id: "asset-gel-001", code: "GEL-001", name: "光谷后场 Gelato 制作设备 1 号（模拟）", storeId: "store-001", category: "Gelato制作设备", model: "DEMO-G01", location: "后场制作区", defaultPartyId: "party-a", warrantyStatus: "保修内", warrantyEndDate: new Date("2027-12-31"), operationalStatus: "正常", isDemo: true },
  { id: "asset-gel-002", code: "GEL-002", name: "光谷后场 Gelato 制作设备 2 号（模拟）", storeId: "store-001", category: "Gelato制作设备", model: "DEMO-G02", location: "后场制作区", defaultPartyId: "party-a", warrantyStatus: "保修外", warrantyEndDate: new Date("2025-12-31"), operationalStatus: "异常运行", isDemo: true },
  { id: "asset-cold-001", code: "COLD-001", name: "光谷低温储存设备（模拟）", storeId: "store-001", category: "低温储存设备", model: "DEMO-C01", location: "后场冷藏区", defaultPartyId: "party-b", warrantyStatus: "保修内", warrantyEndDate: new Date("2027-10-31"), operationalStatus: "正常", isDemo: true },
  { id: "asset-gel-003", code: "GEL-003", name: "江汉路 Gelato 制作设备（模拟）", storeId: "store-002", category: "Gelato制作设备", model: "DEMO-G01", location: "后场制作区", defaultPartyId: "party-a", warrantyStatus: "保修内", warrantyEndDate: new Date("2027-09-30"), operationalStatus: "正常", isDemo: true },
  { id: "asset-cold-002", code: "COLD-002", name: "江汉路售卖温控设备（模拟）", storeId: "store-002", category: "售卖温控设备", model: "DEMO-C02", location: "前场售卖区", defaultPartyId: "party-b", warrantyStatus: "保修内", warrantyEndDate: new Date("2028-01-31"), operationalStatus: "异常运行", isDemo: true },
  { id: "asset-pos-001", code: "POS-001", name: "江汉路收银设备（模拟）", storeId: "store-002", category: "收银设备", model: "DEMO-P01", location: "收银台", defaultPartyId: "party-it", warrantyStatus: "不适用", warrantyEndDate: null, operationalStatus: "正常", isDemo: true },
  { id: "asset-gel-004", code: "GEL-004", name: "徐家汇 Gelato 制作设备（模拟）", storeId: "store-003", category: "Gelato制作设备", model: "DEMO-G03", location: "后场制作区", defaultPartyId: "party-c", warrantyStatus: "保修内", warrantyEndDate: new Date("2028-06-30"), operationalStatus: "正常", isDemo: true },
  { id: "asset-cold-003", code: "COLD-003", name: "徐家汇低温储存设备（模拟）", storeId: "store-003", category: "低温储存设备", model: "DEMO-C01", location: "后场冷藏区", defaultPartyId: "party-b", warrantyStatus: "保修外", warrantyEndDate: new Date("2025-08-31"), operationalStatus: "正常", isDemo: true },
  { id: "asset-ac-001", code: "AC-001", name: "徐家汇空调设备（模拟）", storeId: "store-003", category: "空调设备", model: "DEMO-A01", location: "前场营业区", defaultPartyId: "party-d", warrantyStatus: "保修内", warrantyEndDate: new Date("2027-04-30"), operationalStatus: "正常", isDemo: true },
];

const rules = [
  { id: "rule-001", code: "R001", name: "人身与电气安全硬规则（模拟）", enabled: true, priority: 10, assetCategories: toJson(["*"]), faultCategories: toJson(["电气/供电异常"]), riskTags: toJson(["冒烟/焦味", "漏电", "人员安全"]), warrantyCondition: "*", regions: toJson(["*"]), responsibilityPartyId: "party-maint", priorityLevel: "P1", acceptanceSlaSeconds: 60, requiresHumanReview: true, notifyOps: true, explanation: "命中冒烟、漏电或焦味等高风险词，必须人工复核并通知运营。", isDemo: true },
  { id: "rule-002", code: "R002", name: "低温与食安风险规则（模拟）", enabled: true, priority: 10, assetCategories: toJson(["低温储存设备", "售卖温控设备"]), faultCategories: toJson(["温控异常"]), riskTags: toJson(["食品安全"]), warrantyCondition: "*", regions: toJson(["*"]), responsibilityPartyId: "party-b", priorityLevel: "P1", acceptanceSlaSeconds: 60, requiresHumanReview: true, notifyOps: true, explanation: "低温设备涉及食品安全风险，建议供应商B并强制人工复核。", isDemo: true },
  { id: "rule-003", code: "R003", name: "华中 Gelato 保修内机械异常（模拟）", enabled: true, priority: 20, assetCategories: toJson(["Gelato制作设备"]), faultCategories: toJson(["机械运行异常", "制作质量异常", "无法启动"]), riskTags: toJson([]), warrantyCondition: "保修内", regions: toJson(["华中"]), responsibilityPartyId: "party-a", priorityLevel: "P2", acceptanceSlaSeconds: 120, requiresHumanReview: false, notifyOps: false, explanation: "设备保修内、唯一绑定供应商A，规则覆盖 Gelato 制作设备机械或出品异常。", isDemo: true },
  { id: "rule-004", code: "R004", name: "华东 Gelato 保修内路由（模拟）", enabled: true, priority: 20, assetCategories: toJson(["Gelato制作设备"]), faultCategories: toJson(["机械运行异常", "制作质量异常", "无法启动"]), riskTags: toJson([]), warrantyCondition: "保修内", regions: toJson(["华东"]), responsibilityPartyId: "party-c", priorityLevel: "P2", acceptanceSlaSeconds: 120, requiresHumanReview: false, notifyOps: false, explanation: "华东 Gelato 设备保修内，唯一绑定供应商C。", isDemo: true },
  { id: "rule-005", code: "R005", name: "Gelato 保修外一般故障（模拟）", enabled: true, priority: 30, assetCategories: toJson(["Gelato制作设备"]), faultCategories: toJson(["机械运行异常", "无法启动", "制作质量异常"]), riskTags: toJson([]), warrantyCondition: "保修外", regions: toJson(["*"]), responsibilityPartyId: "party-maint", priorityLevel: "P2", acceptanceSlaSeconds: 120, requiresHumanReview: false, notifyOps: false, explanation: "设备已过模拟保修期，先由内部维修组受理。", isDemo: true },
  { id: "rule-006", code: "R006", name: "操作清洁问题（模拟）", enabled: true, priority: 30, assetCategories: toJson(["*"]), faultCategories: toJson(["操作/清洁问题"]), riskTags: toJson([]), warrantyCondition: "*", regions: toJson(["*"]), responsibilityPartyId: "party-maint", priorityLevel: "P3", acceptanceSlaSeconds: 300, requiresHumanReview: false, notifyOps: false, explanation: "无安全风险的一般操作或清洁问题由内部维修组处理。", isDemo: true },
  { id: "rule-007", code: "R007", name: "收银软件异常（模拟）", enabled: true, priority: 30, assetCategories: toJson(["收银设备"]), faultCategories: toJson(["软件/系统异常"]), riskTags: toJson([]), warrantyCondition: "*", regions: toJson(["*"]), responsibilityPartyId: "party-it", priorityLevel: "P2", acceptanceSlaSeconds: 120, requiresHumanReview: false, notifyOps: false, explanation: "收银设备软件或系统异常由内部IT处理。", isDemo: true },
  { id: "rule-008", code: "R008", name: "华东空调设施异常（模拟）", enabled: true, priority: 30, assetCategories: toJson(["空调设备"]), faultCategories: toJson(["设施制冷异常"]), riskTags: toJson([]), warrantyCondition: "*", regions: toJson(["华东"]), responsibilityPartyId: "party-d", priorityLevel: "P3", acceptanceSlaSeconds: 300, requiresHumanReview: false, notifyOps: false, explanation: "华东空调设施由设施供应商D覆盖。", isDemo: true },
  { id: "rule-009", code: "R009", name: "一般低温温控异常（模拟）", enabled: true, priority: 20, assetCategories: toJson(["低温储存设备", "售卖温控设备"]), faultCategories: toJson(["温控异常"]), riskTags: toJson([]), warrantyCondition: "*", regions: toJson(["*"]), responsibilityPartyId: "party-b", priorityLevel: "P1", acceptanceSlaSeconds: 60, requiresHumanReview: false, notifyOps: true, explanation: "低温或售卖温控设备异常由供应商B覆盖。", isDemo: true },
  { id: "rule-010", code: "R010", name: "人工复核兜底（模拟）", enabled: true, priority: 99, assetCategories: toJson(["*"]), faultCategories: toJson(["*"]), riskTags: toJson([]), warrantyCondition: "*", regions: toJson(["*"]), responsibilityPartyId: "party-maint", priorityLevel: "待确认", acceptanceSlaSeconds: 0, requiresHumanReview: true, notifyOps: false, explanation: "没有更具体规则时进入人工复核。", isDemo: true },
];

type SeedCase = {
  code: string;
  storeId: string;
  assetId: string | null;
  description: string;
  occurredAt: string;
  production: ReportInput["productionImpact"];
  business: ReportInput["businessImpact"];
  risks: string[];
  status?: string;
  priority?: string;
  partyId?: string | null;
  faultCategory?: string;
  orderStatus?: string;
  scenario?: string;
  daysAgo?: number;
  returnCount?: number;
  repeatedFault?: boolean;
};

const cases: SeedCase[] = [
  { code: "FE-001", storeId: "store-001", assetId: "asset-gel-001", description: "今天上午开始机器运行时有明显异响，做出来的产品不太成型，已经影响正常出品。", occurredAt: "今天上午", production: "中", business: "中", risks: ["异常声音"], partyId: "party-a", faultCategory: "机械运行异常", priority: "P2", orderStatus: "待接单", scenario: "normal" },
  { code: "FE-002", storeId: "store-002", assetId: null, description: "售卖柜温度一直往上升，现在不知道具体是哪台。", occurredAt: "刚刚", production: "不确定", business: "中", risks: ["温度异常"], orderStatus: "待补充", scenario: "missing" },
  { code: "FE-003", storeId: "store-001", assetId: "asset-gel-002", description: "机器坏了，没反应。", occurredAt: "刚刚", production: "不确定", business: "不确定", risks: ["不确定"], partyId: null, faultCategory: "无法启动", priority: "待确认", orderStatus: "待人工确认", scenario: "low-confidence" },
  { code: "FE-004", storeId: "store-001", assetId: "asset-cold-001", description: "低温设备温度快速升高，存有原料，已经影响生产，请尽快处理。", occurredAt: "10分钟前", production: "高", business: "高", risks: ["温度异常", "食品安全"], partyId: "party-b", faultCategory: "温控异常", priority: "P1", orderStatus: "待接单", scenario: "timeout" },
  { code: "FE-005", storeId: "store-003", assetId: "asset-gel-004", description: "设备运行时持续异响，出品速度变慢。", occurredAt: "今天下午", production: "中", business: "低", risks: ["异常声音"], partyId: "party-c", faultCategory: "机械运行异常", priority: "P2", orderStatus: "处理中" },
  { code: "FE-006", storeId: "store-002", assetId: "asset-pos-001", description: "收银软件登录后一直白屏，暂时无法完成收款。", occurredAt: "刚刚", production: "无", business: "高", risks: ["无明显风险"], partyId: "party-it", faultCategory: "软件/系统异常", priority: "P2", orderStatus: "处理中" },
  { code: "FE-007", storeId: "store-003", assetId: "asset-ac-001", description: "前场空调不制冷，室温升高但目前仍可营业。", occurredAt: "1小时前", production: "无", business: "中", risks: ["无明显风险"], partyId: "party-d", faultCategory: "设施制冷异常", priority: "P3", orderStatus: "待验收" },
  { code: "FE-008", storeId: "store-001", assetId: "asset-gel-001", description: "清洁后启动提示异常，怀疑操作顺序或残留问题。", occurredAt: "今天早上", production: "低", business: "低", risks: ["无明显风险"], partyId: "party-maint", faultCategory: "操作/清洁问题", priority: "P3", orderStatus: "已关闭", daysAgo: 3 },
  { code: "FE-009", storeId: "store-002", assetId: "asset-cold-002", description: "售卖温控设备温度波动，产品温控情况需要人工确认。", occurredAt: "今天中午", production: "中", business: "中", risks: ["温度异常", "食品安全"], partyId: "party-b", faultCategory: "温控异常", priority: "P1", orderStatus: "待人工确认" },
  { code: "FE-010", storeId: "store-001", assetId: "asset-gel-002", description: "设备启动无响应，检查到有明显焦味，请专业人员处理。", occurredAt: "刚刚", production: "高", business: "高", risks: ["焦味", "人员安全"], partyId: "party-maint", faultCategory: "电气/供电异常", priority: "P1", orderStatus: "待人工确认" },
  { code: "FE-011", storeId: "store-003", assetId: "asset-cold-003", description: "低温储存设备不制冷，当前没有原料存放。", occurredAt: "昨天", production: "低", business: "低", risks: ["温度异常"], partyId: "party-b", faultCategory: "温控异常", priority: "P2", orderStatus: "超时未接单" },
  { code: "FE-012", storeId: "store-002", assetId: "asset-gel-003", description: "Gelato 设备运行正常但产品成型偏软，影响部分出品。", occurredAt: "30分钟前", production: "中", business: "中", risks: ["无明显风险"], partyId: "party-a", faultCategory: "制作质量异常", priority: "P2", orderStatus: "返修中", returnCount: 1 },
  { code: "FE-013", storeId: "store-001", assetId: "asset-gel-001", description: "设备运行时再次出现咔咔异响，产品成型受到影响。", occurredAt: "5天前", production: "中", business: "中", risks: ["异常声音"], partyId: "party-a", faultCategory: "机械运行异常", priority: "P2", orderStatus: "已关闭", daysAgo: 5, repeatedFault: true },
  { code: "FE-014", storeId: "store-003", assetId: "asset-ac-001", description: "空调风口出风但不制冷，营业区体感较热。", occurredAt: "2天前", production: "无", business: "低", risks: ["无明显风险"], partyId: "party-d", faultCategory: "设施制冷异常", priority: "P3", orderStatus: "已关闭", daysAgo: 2 },
  { code: "FE-015", storeId: "store-002", assetId: "asset-pos-001", description: "POS 系统无法打印小票，但收款功能正常。", occurredAt: "昨天", production: "无", business: "低", risks: ["无明显风险"], partyId: "party-it", faultCategory: "软件/系统异常", priority: "P3", orderStatus: "待验收" },
  { code: "FE-016", storeId: "store-001", assetId: "asset-cold-001", description: "冷藏区温度短时升高，复测后仍有波动。", occurredAt: "3天前", production: "中", business: "低", risks: ["温度异常"], partyId: "party-b", faultCategory: "温控异常", priority: "P1", orderStatus: "已关闭", daysAgo: 3 },
  { code: "FE-017", storeId: "store-003", assetId: "asset-gel-004", description: "机器制作过程声音变大，暂时未影响产品成型。", occurredAt: "今天上午", production: "低", business: "低", risks: ["异常声音"], partyId: "party-c", faultCategory: "机械运行异常", priority: "P3", orderStatus: "待接单" },
  { code: "FE-018", storeId: "store-002", assetId: "asset-gel-003", description: "机器无法启动，已影响今天的正常出品。", occurredAt: "刚刚", production: "高", business: "高", risks: ["无明显风险"], partyId: "party-a", faultCategory: "无法启动", priority: "P1", orderStatus: "处理中" },
  { code: "FE-019", storeId: "store-001", assetId: "asset-gel-002", description: "清洁完成后运行仍有少量残留，想确认操作是否正确。", occurredAt: "昨天", production: "低", business: "无", risks: ["无明显风险"], partyId: "party-maint", faultCategory: "操作/清洁问题", priority: "P3", orderStatus: "已关闭", daysAgo: 1 },
  { code: "FE-020", storeId: "store-003", assetId: "asset-cold-003", description: "设备温度显示缓慢上升，暂未存放产品。", occurredAt: "2小时前", production: "低", business: "低", risks: ["温度异常"], partyId: "party-b", faultCategory: "温控异常", priority: "P2", orderStatus: "已取消" },
];

function stamp(daysAgo = 0, minutesAgo = 20) {
  return new Date(Date.now() - daysAgo * 86_400_000 - minutesAgo * 60_000);
}

export async function resetDemoData(client = prisma) {
  await client.notificationLog.deleteMany();
  await client.stateEvent.deleteMany();
  await client.workOrder.deleteMany();
  await client.faultEvent.deleteMany();
  await client.routingRule.deleteMany();
  await client.asset.deleteMany();
  await client.responsibilityParty.deleteMany();
  await client.store.deleteMany();

  await client.store.createMany({ data: stores });
  await client.responsibilityParty.createMany({ data: parties });
  await client.asset.createMany({ data: assets });
  await client.routingRule.createMany({ data: rules });

  const ai = new LocalDeterministicAIProvider();
  for (let index = 0; index < cases.length; index += 1) {
    const item = cases[index];
    const asset = assets.find((candidate) => candidate.id === item.assetId) ?? null;
    const input: ReportInput = {
      storeId: item.storeId,
      assetId: item.assetId,
      originalDescription: item.description,
      occurredAtText: item.occurredAt,
      productionImpact: item.production,
      businessImpact: item.business,
      userRiskTags: item.risks,
      reporterName: stores.find((store) => store.id === item.storeId)?.managerName ?? "门店人员（模拟）",
      attachmentUrls: [],
    };
    const analysis = await ai.analyze(input, asset);
    const createdAt = stamp(item.daysAgo ?? 0, 60 - index * 2);
    const isMissing = !item.assetId;
    const faultStatus = isMissing ? "待补充" : item.orderStatus === "待人工确认" ? "待人工确认" : "已生成工单";
    const faultId = `fault-${String(index + 1).padStart(3, "0")}`;
    await client.faultEvent.create({
      data: {
        id: faultId,
        code: item.code,
        storeId: item.storeId,
        assetId: item.assetId!,
        originalDescription: item.description,
        attachmentUrls: toJson([]),
        occurredAtText: item.occurredAt,
        productionImpact: item.production,
        businessImpact: item.business,
        userRiskTags: toJson(item.risks),
        reporterName: input.reporterName,
        status: faultStatus,
        aiResultJson: toJson(analysis),
        aiHistoryJson: toJson([{ version: 1, createdAt: createdAt.toISOString(), analysis }]),
        aiSummary: analysis.standardSummary,
        aiFaultCategory: item.faultCategory ?? analysis.faultCategorySuggestion,
        aiPrioritySuggestion: item.priority ?? analysis.prioritySuggestion,
        aiConfidence: item.scenario === "low-confidence" ? "low" : analysis.confidence,
        missingFields: toJson(analysis.missingFields),
        followUpQuestions: toJson(analysis.followUpQuestions),
        requiresHumanReview: item.orderStatus === "待人工确认" || analysis.requiresHumanReview,
        createdAt,
        isDemo: true,
      },
    });

    if (isMissing) continue;
    const dispatchedAt =
      item.orderStatus === "待人工确认"
        ? null
        : item.orderStatus === "待接单"
          ? new Date()
          : createdAt;
    const deadline = dispatchedAt ? calculateAcceptanceDeadline(dispatchedAt, item.priority ?? "P2") : null;
    const closed = item.orderStatus === "已关闭";
    const accepted = ["处理中", "待验收", "返修中", "已关闭"].includes(item.orderStatus ?? "");
    const orderId = `order-${String(index + 1).padStart(3, "0")}`;
    await client.workOrder.create({
      data: {
        id: orderId,
        code: `WO-20260719-${String(index + 1).padStart(3, "0")}`,
        faultEventId: faultId,
        assetId: item.assetId!,
        finalFaultCategory: item.faultCategory ?? analysis.faultCategorySuggestion,
        finalPriority: item.priority ?? analysis.prioritySuggestion,
        recommendedPartyId: item.partyId,
        finalPartyId: item.partyId,
        routeExplanation: item.scenario === "low-confidence"
          ? "AI 置信度低，命中人工复核兜底规则 R010，系统禁止自动派单。"
          : `Demo 规则命中：设备 ${asset?.code} 与责任方唯一绑定，按类别、区域和保修条件推荐。`,
        routeTraceJson: toJson(item.scenario === "normal" ? ["R003", "设备门店匹配", "保修内", "区域覆盖"] : item.scenario === "low-confidence" ? ["R010", "AI 置信度 low", "禁止自动派单"] : ["Demo 种子规则"]),
        manuallyReviewed: false,
        status: item.orderStatus ?? "待接单",
        slaStatus: item.orderStatus === "超时未接单" ? "已超时" : item.orderStatus === "待接单" ? "计时中" : accepted || closed ? "已完成" : "未开始",
        dispatchedAt,
        acceptanceDeadline: item.orderStatus === "超时未接单" ? new Date(Date.now() - 30_000) : deadline,
        acceptedAt: accepted ? new Date(createdAt.getTime() + 60_000) : null,
        repairStartedAt: accepted ? new Date(createdAt.getTime() + 120_000) : null,
        repairCompletedAt: ["待验收", "返修中", "已关闭"].includes(item.orderStatus ?? "") ? new Date(createdAt.getTime() + 180_000) : null,
        acceptanceAt: closed ? new Date(createdAt.getTime() + 240_000) : null,
        closedAt: closed ? new Date(createdAt.getTime() + 250_000) : null,
        repairCause: ["待验收", "返修中", "已关闭"].includes(item.orderStatus ?? "") ? "Demo 模拟故障原因，由维修人员填写" : null,
        repairAction: ["待验收", "返修中", "已关闭"].includes(item.orderStatus ?? "") ? "完成模拟检查与维修，未包含危险操作指引" : null,
        partsUsed: closed ? "Demo 模拟配件" : null,
        acceptanceResult: closed ? "通过" : item.orderStatus === "返修中" ? "不通过" : null,
        acceptanceComment: closed ? "门店模拟验收通过" : item.orderStatus === "返修中" ? "设备可运行但出品仍不稳定" : null,
        returnCount: item.returnCount ?? 0,
        repeatedFault: item.repeatedFault ?? false,
        createdAt,
        isDemo: true,
      },
    });

    await client.stateEvent.create({
      data: {
        id: `state-${String(index + 1).padStart(3, "0")}-1`,
        workOrderId: orderId,
        fromStatus: "待判断",
        toStatus: item.orderStatus === "待人工确认" ? "待人工确认" : "待接单",
        actorRole: "system",
        actorName: "本地规则引擎",
        reason: item.orderStatus === "待人工确认" ? "需人工确认" : "信息完整且唯一规则命中",
        timestamp: createdAt,
      },
    });
    if (item.orderStatus && !["待接单", "待人工确认"].includes(item.orderStatus)) {
      await client.stateEvent.create({
        data: {
          id: `state-${String(index + 1).padStart(3, "0")}-2`,
          workOrderId: orderId,
          fromStatus: item.orderStatus === "超时未接单" ? "待接单" : "待接单",
          toStatus: item.orderStatus,
          actorRole: item.orderStatus === "超时未接单" ? "system" : "supplier",
          actorName: item.orderStatus === "超时未接单" ? "SLA 自动化" : "责任方（模拟）",
          reason: item.orderStatus === "超时未接单" ? "超过 Demo 接单截止时间" : "Demo 预置状态",
          timestamp: new Date(createdAt.getTime() + 60_000),
        },
      });
    }
    if (item.orderStatus === "超时未接单") {
      await client.notificationLog.createMany({
        data: [
          { id: `notice-${index}-manager`, workOrderId: orderId, channel: "站内通知", recipient: "维修管理人员", type: "超时升级", content: "Demo 工单已超时未接单，请重新定责。", isDemo: true },
          { id: `notice-${index}-ops`, workOrderId: orderId, channel: "站内通知", recipient: "运营管理员", type: "P1超时升级", content: "Demo P1 工单已超时，已升级运营。", isDemo: true },
        ],
      });
    }
  }
}

async function main() {
  await resetDemoData();
  const counts = await Promise.all([
    prisma.store.count(),
    prisma.asset.count(),
    prisma.responsibilityParty.count(),
    prisma.routingRule.count(),
    prisma.faultEvent.count(),
    prisma.workOrder.count(),
  ]);
  console.log(`Demo 数据已写入：${counts[0]} 门店、${counts[1]} 设备、${counts[2]} 责任方、${counts[3]} 规则、${counts[4]} 故障事件、${counts[5]} 工单。`);
}

if (process.argv[1]?.replaceAll("\\", "/").endsWith("/prisma/seed.ts")) {
  main()
    .catch((error) => {
      console.error(error);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
