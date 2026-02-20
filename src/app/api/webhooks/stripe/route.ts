import { NextResponse } from "next/server";
import Stripe from "stripe";
import { env } from "@/lib/env";
import { getStripeClient } from "@/lib/services/stripe";

export async function POST(request: Request) {
  const stripe = getStripeClient();
  if (!stripe) {
    return NextResponse.json({
      ok: true,
      mode: "mock",
    });
  }

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature || !env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json(
      {
        error: "Stripe webhook signature configuration is missing.",
      },
      { status: 400 },
    );
  }

  try {
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
    );

    const handledTypes = new Set([
      "checkout.session.completed",
      "customer.subscription.updated",
      "customer.subscription.deleted",
    ]);

    if (!handledTypes.has(event.type)) {
      return NextResponse.json({
        ok: true,
        ignored: event.type,
      });
    }

    return NextResponse.json({
      ok: true,
      type: event.type,
      id: event.id,
    });
  } catch (error) {
    const message = error instanceof Stripe.errors.StripeError
      ? error.message
      : "Invalid webhook payload.";

    return NextResponse.json(
      {
        error: message,
      },
      { status: 400 },
    );
  }
}
