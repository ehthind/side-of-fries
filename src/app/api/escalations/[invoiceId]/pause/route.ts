import { NextResponse } from "next/server";
import { pauseEscalation } from "@/lib/db/repository";

export async function POST(
  _request: Request,
  context: { params: Promise<{ invoiceId: string }> },
) {
  try {
    const { invoiceId } = await context.params;
    const invoice = await pauseEscalation(invoiceId);

    return NextResponse.json({
      invoice,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to pause escalation.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 400 },
    );
  }
}
