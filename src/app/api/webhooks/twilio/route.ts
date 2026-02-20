import { NextResponse } from "next/server";
import { validateTwilioWebhook } from "@/lib/services/twilio";

export async function POST(request: Request) {
  const signature = request.headers.get("x-twilio-signature") || "";
  const body = await request.text();
  const url = request.url;

  const valid = validateTwilioWebhook(url, signature, body);
  if (!valid) {
    return NextResponse.json(
      {
        error: "Twilio signature validation failed.",
      },
      { status: 403 },
    );
  }

  const params = new URLSearchParams(body);

  return NextResponse.json({
    ok: true,
    from: params.get("From"),
    body: params.get("Body"),
    messageSid: params.get("MessageSid"),
  });
}
