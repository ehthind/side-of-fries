import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveRepositoryAuth } from "@/lib/auth/request-auth";
import { generateLegalPacket } from "@/lib/db/repository";

const schema = z.object({
  jurisdiction: z.string().min(2).default("Global - Basic"),
});

export async function POST(
  request: NextRequest,
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
    const body = await request.json().catch(() => ({}));
    const payload = schema.parse(body);

    const packet = await generateLegalPacket(
      invoiceId,
      payload.jurisdiction,
      auth.context,
    );
    return NextResponse.json({
      packet,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to generate legal packet.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 400 },
    );
  }
}
