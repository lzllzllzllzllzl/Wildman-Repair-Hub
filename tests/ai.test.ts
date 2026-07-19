import { describe, expect, it } from "vitest";
import { LocalDeterministicAIProvider } from "@/lib/ai";
import type { ReportInput } from "@/lib/types";

const provider = new LocalDeterministicAIProvider();
const base: ReportInput = {
  storeId: "store-001",
  assetId: "asset-gel-001",
  originalDescription: "今天上午开始机器运行时有明显异响，做出来的产品不太成型，已经影响正常出品。",
  occurredAtText: "今天上午",
  productionImpact: "中",
  businessImpact: "中",
  userRiskTags: ["异常声音"],
  reporterName: "测试门店",
  attachmentUrls: [],
};
const gelato = { code: "GEL-001", category: "Gelato制作设备", storeId: "store-001" };

describe("本地确定性 AI", () => {
  it("稳定识别 Gelato 异响与成型异常", async () => {
    const first = await provider.analyze(base, gelato);
    const second = await provider.analyze(base, gelato);
    expect(first).toEqual(second);
    expect(first.symptoms).toEqual(["运行异响", "产品成型异常"]);
    expect(first.faultCategorySuggestion).toBe("机械运行异常");
    expect(first.prioritySuggestion).toBe("P2");
    expect(first.confidence).toBe("high");
  });

  it("缺少设备编号时生成定向追问", async () => {
    const result = await provider.analyze({ ...base, assetId: null, originalDescription: "售卖柜温度一直往上升，现在不知道具体是哪台。" }, null);
    expect(result.missingFields).toContain("设备编号");
    expect(result.followUpQuestions[0]).toContain("设备");
  });

  it("描述模糊时低置信度并转人工", async () => {
    const result = await provider.analyze({ ...base, originalDescription: "机器坏了，没反应。" }, { ...gelato, code: "GEL-002" });
    expect(result.confidence).toBe("low");
    expect(result.prioritySuggestion).toBe("待确认");
    expect(result.requiresHumanReview).toBe(true);
  });

  it("冒烟与漏电强制 P1 人工复核且不输出维修步骤", async () => {
    const result = await provider.analyze({ ...base, originalDescription: "设备冒烟并且闻到焦味，疑似漏电。" }, gelato);
    expect(result.prioritySuggestion).toBe("P1");
    expect(result.requiresHumanReview).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/拆机|接电|制冷剂|复位/);
  });

  it("设备与门店不匹配阻止自动判断", async () => {
    const result = await provider.analyze(base, { ...gelato, storeId: "store-003" });
    expect(result.missingFields).toContain("设备与门店匹配");
    expect(result.confidence).toBe("low");
    expect(result.requiresHumanReview).toBe(true);
  });
});
