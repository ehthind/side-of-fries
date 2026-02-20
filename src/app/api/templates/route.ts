import { NextResponse } from "next/server";
import { getStageTemplates } from "@/lib/db/repository";

export async function GET() {
  return NextResponse.json({
    templates: getStageTemplates(),
  });
}
