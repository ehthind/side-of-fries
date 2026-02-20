import twilio from "twilio";
import { env, hasTwilioConfig } from "@/lib/env";

let twilioClient: ReturnType<typeof twilio> | null | undefined;

export function getTwilioClient() {
  if (!hasTwilioConfig()) {
    return null;
  }

  if (twilioClient === undefined) {
    twilioClient = twilio(env.TWILIO_ACCOUNT_SID!, env.TWILIO_AUTH_TOKEN!);
  }

  return twilioClient;
}

export async function sendSms(params: { to: string; body: string }) {
  const client = getTwilioClient();

  if (!client) {
    return {
      mock: true,
      sid: `mock_${Math.random().toString(36).slice(2, 12)}`,
      status: "queued",
    };
  }

  const message = await client.messages.create({
    to: params.to,
    body: params.body,
    from: env.TWILIO_PHONE_NUMBER,
  });

  return {
    mock: false,
    sid: message.sid,
    status: message.status,
  };
}

export function validateTwilioWebhook(url: string, signature: string, body: string) {
  if (!env.TWILIO_WEBHOOK_TOKEN) {
    return true;
  }

  return twilio.validateRequest(
    env.TWILIO_WEBHOOK_TOKEN,
    signature,
    url,
    new URLSearchParams(body),
  );
}
