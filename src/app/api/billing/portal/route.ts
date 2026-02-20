import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createPortalSession } from "@/lib/services/stripe";

const schema = z.object({
  customerId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const payload = schema.parse(body);

    const session = await createPortalSession(payload.customerId);
    return NextResponse.json({
      portal: session,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to create customer portal session.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 400 },
    );
  }
}
