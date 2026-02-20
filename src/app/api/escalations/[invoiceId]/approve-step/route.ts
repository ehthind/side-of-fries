import { NextResponse } from "next/server";
import { approveEscalationStep } from "@/lib/db/repository";

export async function POST(
  _request: Request,
  context: { params: Promise<{ invoiceId: string }> },
) {
  try {
    const { invoiceId } = await context.params;
    const invoice = await approveEscalationStep(invoiceId);

    return NextResponse.json({
      invoice,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to approve escalation step.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 400 },
    );
  }
}
