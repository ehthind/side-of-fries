import { NextResponse } from "next/server";
import { resolveRepositoryAuth } from "@/lib/auth/request-auth";
import { pauseEscalation } from "@/lib/db/repository";

export async function POST(
  request: Request,
  context: { params: Promise<{ invoiceId: string }> },
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

    const { invoiceId } = await context.params;
    const invoice = await pauseEscalation(invoiceId, auth.context);

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
