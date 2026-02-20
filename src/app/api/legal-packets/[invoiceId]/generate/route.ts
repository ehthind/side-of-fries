import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateLegalPacket } from "@/lib/db/repository";

const schema = z.object({
  jurisdiction: z.string().min(2).default("Global - Basic"),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ invoiceId: string }> },
) {
  try {
    const { invoiceId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const payload = schema.parse(body);

    const packet = await generateLegalPacket(invoiceId, payload.jurisdiction);
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
