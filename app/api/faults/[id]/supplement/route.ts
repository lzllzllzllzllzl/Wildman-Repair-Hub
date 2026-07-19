import { NextResponse } from "next/server";
import { supplementFault } from "@/lib/services";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    return NextResponse.json(await supplementFault(id, await request.json()));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "补充失败" }, { status: 400 });
  }
}
