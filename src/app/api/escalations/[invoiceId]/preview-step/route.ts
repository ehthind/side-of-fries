import { NextResponse } from "next/server";
import { resolveRepositoryAuth } from "@/lib/auth/request-auth";
import { previewEscalationStep } from "@/lib/db/repository";

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
    const preview = await previewEscalationStep(invoiceId, auth.context);

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
