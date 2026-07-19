import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { resetDemoData } from "@/prisma/seed";
import { calculateAcceptanceDeadline } from "@/lib/sla";

const schema = z.object({
  action: z.enum(["reset", "load", "almost-timeout", "timeout", "restore"]),
  scenario: z.enum(["normal", "missing", "low-confidence", "timeout"]).optional(),
  orderId: z.string().optional(),
});

const scenarioCodes = {
  normal: "WO-20260719-001",
  "low-confidence": "WO-20260719-003",
  timeout: "WO-20260719-004",
} as const;

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    if (input.action === "reset" || input.action === "load") {
      await resetDemoData(db);
      if (input.action === "load" && input.scenario) {
        if (input.scenario === "missing") {
          const fault = await db.faultEvent.findUniqueOrThrow({ where: { code: "FE-002" } });
          return NextResponse.json({ ok: true, faultId: fault.id, route: "/store/supplements" });
        }
        const order = await db.workOrder.findUniqueOrThrow({ where: { code: scenarioCodes[input.scenario as keyof typeof scenarioCodes] } });
        return NextResponse.json({ ok: true, orderId: order.id, route: `/orders/${order.id}` });
      }
      return NextResponse.json({ ok: true });
    }
    if (!input.orderId) throw new Error("请选择工单。");
    const order = await db.workOrder.findUniqueOrThrow({ where: { id: input.orderId } });
    if (input.action === "almost-timeout") {
      if (order.status !== "待接单") throw new Error("只有待接单工单可以模拟即将超时。");
      const deadline = new Date(Date.now() + 30_000);
      await db.workOrder.update({ where: { id: order.id }, data: { status: "待接单", acceptedAt: null, dispatchedAt: new Date(), acceptanceDeadline: deadline, slaStatus: "即将超时" } });
      return NextResponse.json({ ok: true });
    }
    if (input.action === "restore") {
      if (!["待接单", "超时未接单"].includes(order.status)) throw new Error("只有待接单或已超时工单可以恢复 SLA 时间。");
      const dispatchedAt = new Date();
      await db.workOrder.update({ where: { id: order.id }, data: { status: "待接单", acceptedAt: null, dispatchedAt, acceptanceDeadline: calculateAcceptanceDeadline(dispatchedAt, order.finalPriority), slaStatus: "计时中" } });
      return NextResponse.json({ ok: true });
    }
    if (input.action === "timeout") {
      if (order.status !== "待接单") throw new Error("只有待接单工单可以模拟已经超时。");
      await db.$transaction([
        db.workOrder.update({ where: { id: order.id }, data: { status: "超时未接单", acceptanceDeadline: new Date(Date.now() - 1000), slaStatus: "已超时" } }),
        db.stateEvent.create({ data: { id: randomUUID(), workOrderId: order.id, fromStatus: order.status, toStatus: "超时未接单", actorRole: "admin", actorName: "Demo 控制台", reason: "管理员模拟工单已经超时。" } }),
        db.notificationLog.create({ data: { id: randomUUID(), workOrderId: order.id, channel: "站内通知", recipient: "维修管理人员", type: "超时升级", content: `${order.code} 已被 Demo 控制台模拟为超时。`, isDemo: true } }),
      ]);
      if (order.finalPriority === "P1") {
        await db.notificationLog.create({ data: { id: randomUUID(), workOrderId: order.id, channel: "站内通知", recipient: "运营管理员", type: "P1超时升级", content: `${order.code} P1 超时，已升级运营。`, isDemo: true } });
      }
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Demo 操作失败" }, { status: 400 });
  }
}
