export const SLA_SECONDS: Record<"P1" | "P2" | "P3", number> = {
  P1: 60,
  P2: 120,
  P3: 300,
};

export function getSlaSeconds(priority: string, configured?: number | null): number {
  if (configured && configured > 0) return configured;
  if (priority === "P1" || priority === "P2" || priority === "P3") return SLA_SECONDS[priority];
  return 0;
}

export function calculateAcceptanceDeadline(
  dispatchedAt: Date,
  priority: string,
  configured?: number | null,
): Date | null {
  const seconds = getSlaSeconds(priority, configured);
  return seconds ? new Date(dispatchedAt.getTime() + seconds * 1000) : null;
}

export function getSlaStatus(deadline: Date | null, acceptedAt: Date | null, now = new Date()) {
  if (acceptedAt) return "已完成";
  if (!deadline) return "未开始";
  const remaining = deadline.getTime() - now.getTime();
  if (remaining <= 0) return "已超时";
  const total = Math.max(1, deadline.getTime() - (now.getTime() - 1));
  return remaining <= Math.min(30_000, total / 3) ? "即将超时" : "计时中";
}
