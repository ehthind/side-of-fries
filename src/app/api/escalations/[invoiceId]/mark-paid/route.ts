import { NextResponse } from "next/server";
import { markInvoicePaid } from "@/lib/db/repository";

export async function POST(
  _request: Request,
  context: { params: Promise<{ invoiceId: string }> },
) {
  try {
    const { invoiceId } = await context.params;
    const invoice = await markInvoicePaid(invoiceId);

    return NextResponse.json({
      invoice,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to mark invoice as paid.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 400 },
    );
  }
}
