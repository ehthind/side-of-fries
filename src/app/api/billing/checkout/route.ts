import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { DEFAULT_WORKSPACE_SLUG } from "@/lib/constants";
import { createCheckoutSession } from "@/lib/services/stripe";

const schema = z.object({
  workspaceSlug: z.string().min(1).default(DEFAULT_WORKSPACE_SLUG),
  email: z.string().email().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const payload = schema.parse(body);

    const session = await createCheckoutSession({
      workspaceSlug: payload.workspaceSlug,
      email: payload.email,
    });

    return NextResponse.json({
      checkout: session,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to create checkout session.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 400 },
    );
  }
}
