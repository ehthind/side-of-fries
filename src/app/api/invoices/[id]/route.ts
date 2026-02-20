import { NextResponse } from "next/server";
import { resolveRepositoryAuth } from "@/lib/auth/request-auth";
import { getInvoiceById } from "@/lib/db/repository";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await resolveRepositoryAuth(request);
    if (auth.authError) {
      return NextResponse.json(
        {
          error: "Unauthorized.",
          details: auth.authError,
        },
        { status: 401 },
      );
    }

    const { id } = await context.params;
    const invoice = await getInvoiceById(id, auth.context);

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
