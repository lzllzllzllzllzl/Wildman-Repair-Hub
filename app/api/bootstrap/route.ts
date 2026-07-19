import { NextResponse } from "next/server";
import { getBootstrapData } from "@/lib/services";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getBootstrapData());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "数据读取失败" }, { status: 500 });
  }
}
