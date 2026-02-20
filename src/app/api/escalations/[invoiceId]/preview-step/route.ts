import { NextResponse } from "next/server";
import { previewEscalationStep } from "@/lib/db/repository";

export async function POST(
  _request: Request,
  context: { params: Promise<{ invoiceId: string }> },
) {
  try {
    const { invoiceId } = await context.params;
    const preview = await previewEscalationStep(invoiceId);

    return NextResponse.json({
      preview,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to preview escalation step.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 400 },
    );
  }
}
