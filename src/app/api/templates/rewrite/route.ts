import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { EscalationStage } from "@/lib/types";
import { rewriteMessageTemplate } from "@/lib/services/ai-rewrite";

const schema = z.object({
  stage: z.enum([
    "polite_nudge",
    "firm_follow_up",
    "collections_warning",
    "small_claims_template",
  ]),
  body: z.string().min(8),
  tone: z.enum(["conservative", "balanced", "assertive"]).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const raw = await request.json();
    const payload = schema.parse(raw) as {
      stage: EscalationStage;
      body: string;
      tone?: "conservative" | "balanced" | "assertive";
    };

    const rewritten = rewriteMessageTemplate(payload);

    return NextResponse.json({
      rewritten,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to rewrite template.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 400 },
    );
  }
}
