import { describe, expect, it } from "vitest";
import { calculateAcceptanceDeadline, getSlaSeconds } from "@/lib/sla";
import {
  assertCanClose,
  assertRole,
  assertSupplierAssignment,
  assertTransition,
  canTransition,
} from "@/lib/state-machine";

describe("SLA 与状态机单元测试", () => {
  it("按 P1/P2/P3 计算 60/120/300 秒截止", () => {
    const start = new Date("2026-07-19T00:00:00.000Z");
    expect(calculateAcceptanceDeadline(start, "P1")?.toISOString()).toBe("2026-07-19T00:01:00.000Z");
    expect(getSlaSeconds("P2")).toBe(120);
    expect(getSlaSeconds("P3")).toBe(300);
  });

  it("未验收禁止关闭", () => {
    expect(() => assertCanClose("处理中", null)).toThrow("未经门店验收");
    expect(() => assertTransition("处理中", "已关闭")).toThrow("非法状态流转");
  });

  it("只有待验收且通过才能关闭", () => {
    expect(() => assertCanClose("待验收", "通过")).not.toThrow();
    expect(canTransition("待验收", "已关闭")).toBe(true);
  });

  it.each([
    ["待补充", "已关闭"],
    ["待人工确认", "处理中"],
    ["待接单", "待验收"],
    ["处理中", "已关闭"],
    ["已关闭", "处理中"],
  ] as const)("%s 不能非法流转到 %s", (from, to) => {
    expect(() => assertTransition(from, to)).toThrow("非法状态流转");
  });

  it("待接单才允许接单，处理中才允许提交到待验收", () => {
    expect(canTransition("待接单", "处理中")).toBe(true);
    expect(canTransition("待人工确认", "处理中")).toBe(false);
    expect(canTransition("处理中", "待验收")).toBe(true);
    expect(canTransition("待接单", "待验收")).toBe(false);
  });

  it("验收不通过必须进入返修中", () => {
    expect(canTransition("待验收", "返修中")).toBe(true);
    expect(canTransition("待验收", "处理中")).toBe(false);
  });
});

describe("角色与责任方权限", () => {
  it("只有维修管理或运营可以取消", () => {
    expect(() => assertRole("manager", ["manager", "admin"], "取消工单")).not.toThrow();
    expect(() => assertRole("admin", ["manager", "admin"], "取消工单")).not.toThrow();
    expect(() => assertRole("store", ["manager", "admin"], "取消工单")).toThrow("无权");
    expect(() => assertRole("supplier", ["manager", "admin"], "取消工单")).toThrow("无权");
  });

  it("门店不能修改责任方、SLA或最终紧急度", () => {
    expect(() => assertRole("store", ["manager", "admin"], "人工确认并派发")).toThrow("无权");
    expect(() => assertRole("store", ["manager", "admin"], "重新定责并派发")).toThrow("无权");
  });

  it("供应商只能操作分配给自己的工单", () => {
    expect(() => assertSupplierAssignment("party-a", "party-a")).not.toThrow();
    expect(() => assertSupplierAssignment("party-a", "party-b")).toThrow("其他责任方");
    expect(() => assertSupplierAssignment(undefined, "party-a")).toThrow("未识别");
  });
});

describe("核心演示路径集成流程", () => {
  function run(statuses: Parameters<typeof assertTransition>[0][]) {
    for (let index = 0; index < statuses.length - 1; index += 1) {
      assertTransition(statuses[index], statuses[index + 1]);
    }
    return statuses.at(-1);
  }

  it("正常自动派单至关闭", () => {
    expect(run(["待判断", "待接单", "处理中", "待验收", "已关闭"])).toBe("已关闭");
  });

  it("信息缺失补充后派单", () => {
    expect(run(["待判断", "待补充", "待判断", "待接单"])).toBe("待接单");
  });

  it("低置信度经过人工确认", () => {
    expect(run(["待判断", "待人工确认", "待接单"])).toBe("待接单");
  });

  it("超时未接单经过人工复核再派发", () => {
    expect(run(["待判断", "待接单", "超时未接单", "待人工确认", "待接单"])).toBe("待接单");
  });

  it("验收不通过进入返修并重新处理", () => {
    expect(run(["待判断", "待接单", "处理中", "待验收", "返修中", "处理中"])).toBe("处理中");
  });
});
