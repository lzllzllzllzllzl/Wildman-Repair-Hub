import type { OrderStatus, Role } from "@/lib/types";

const transitions: Record<OrderStatus, OrderStatus[]> = {
  待判断: ["待补充", "待人工确认", "待接单", "已取消"],
  待补充: ["待判断", "已取消"],
  待人工确认: ["待接单", "已取消"],
  待接单: ["处理中", "超时未接单", "待人工确认", "已取消"],
  超时未接单: ["待人工确认", "已取消"],
  处理中: ["待验收", "已取消"],
  待验收: ["返修中", "已关闭", "已取消"],
  返修中: ["处理中", "已取消"],
  已关闭: [],
  已取消: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus) {
  return transitions[from].includes(to);
}

export function assertTransition(from: OrderStatus, to: OrderStatus) {
  if (!canTransition(from, to)) {
    throw new Error(`非法状态流转：${from} → ${to}`);
  }
  if (to === "已关闭" && from !== "待验收") {
    throw new Error("工单未经门店验收，不得关闭。");
  }
}

export function assertRole(role: Role, allowed: Role[], action: string) {
  if (!allowed.includes(role)) {
    throw new Error(`当前角色无权执行“${action}”。`);
  }
}

export function assertSupplierAssignment(
  actorPartyId: string | undefined,
  assignedPartyId: string | null,
) {
  if (!actorPartyId) {
    throw new Error("未识别当前模拟供应商身份，不能操作工单。");
  }
  if (!assignedPartyId || actorPartyId !== assignedPartyId) {
    throw new Error("当前供应商无权操作其他责任方的工单。");
  }
}

export function assertCanClose(status: OrderStatus, acceptanceResult?: string | null) {
  if (status !== "待验收" || acceptanceResult !== "通过") {
    throw new Error("工单未经门店验收通过，不得关闭。");
  }
}
