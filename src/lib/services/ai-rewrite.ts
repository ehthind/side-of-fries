import type { EscalationStage } from "@/lib/types";

export function rewriteMessageTemplate(params: {
  stage: EscalationStage;
  body: string;
  tone?: "conservative" | "balanced" | "assertive";
}) {
  const tone = params.tone ?? "conservative";

  if (tone === "conservative") {
    return `${params.body}\n\nThis message is sent in good faith to resolve the balance professionally.`;
  }

  if (tone === "balanced") {
    return `${params.body}\n\nPlease confirm next steps today so we can close this without further escalation.`;
  }

  return `${params.body}\n\nImmediate response is requested to avoid collections and filing actions.`;
}
