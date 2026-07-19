import { NextResponse } from "next/server";
import { createFaultReport } from "@/lib/services";

export async function POST(request: Request) {
  try {
    const result = await createFaultReport(await request.json());
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "提交失败" }, { status: 400 });
  }
}
