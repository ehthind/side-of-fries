import Stripe from "stripe";
import { env, hasStripeConfig } from "@/lib/env";

let stripeClient: Stripe | null | undefined;

export function getStripeClient(): Stripe | null {
  if (!hasStripeConfig()) {
    return null;
  }

  if (stripeClient === undefined) {
    stripeClient = new Stripe(env.STRIPE_SECRET_KEY!);
  }

  return stripeClient;
}

export async function createCheckoutSession(params: {
  workspaceSlug: string;
  email?: string;
}) {
  const stripe = getStripeClient();
  if (!stripe) {
    return {
      mock: true,
      url: `${env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/dashboard?billing=mock`,
    };
  }

  const baseUrl = env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [
      {
        price: env.STRIPE_PRICE_ID,
        quantity: 1,
      },
    ],
    customer_email: params.email,
    metadata: {
      workspace_slug: params.workspaceSlug,
    },
    success_url: `${baseUrl}/dashboard?billing=success`,
    cancel_url: `${baseUrl}/dashboard?billing=cancelled`,
  });

  return {
    mock: false,
    url: session.url,
    id: session.id,
  };
}

export async function createPortalSession(customerId: string) {
  const stripe = getStripeClient();
  if (!stripe) {
    return {
      mock: true,
      url: `${env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/dashboard?billing=mock-portal`,
    };
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/dashboard`,
  });

  return {
    mock: false,
    url: session.url,
    id: session.id,
  };
}
