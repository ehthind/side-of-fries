import { NextResponse } from "next/server";
import { getInvoiceById } from "@/lib/db/repository";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const invoice = await getInvoiceById(id);

    if (!invoice) {
      return NextResponse.json(
        {
          error: "Invoice not found.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      invoice,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to load invoice.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
