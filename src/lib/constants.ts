import type { EscalationStage, MessageChannel } from "@/lib/types";

export const DEFAULT_WORKSPACE_SLUG = "demo-workspace";

export const ESCALATION_STAGE_ORDER: EscalationStage[] = [
  "polite_nudge",
  "firm_follow_up",
  "collections_warning",
  "small_claims_template",
];

export const STAGE_LABEL: Record<EscalationStage, string> = {
  polite_nudge: "Polite nudge",
  firm_follow_up: "Firm follow-up",
  collections_warning: "Collections warning",
  small_claims_template: "Small-claims prep",
};

export const MESSAGE_TEMPLATES: Record<
  EscalationStage,
  Record<MessageChannel, string>
> = {
  polite_nudge: {
    email:
      "Hi {{client_name}},\n\nQuick reminder that invoice {{invoice_number}} for {{amount}} was due on {{due_date}}. Please let me know if anything is needed to process payment this week.\n\nThank you,\n{{workspace_name}}",
    sms: "Hi {{client_name}} - friendly reminder invoice {{invoice_number}} ({{amount}}) was due {{due_date}}. Can you confirm payment timing?",
  },
  firm_follow_up: {
    email:
      "Hi {{client_name}},\n\nFollowing up on invoice {{invoice_number}} ({{amount}}), now {{days_overdue}} days overdue. Please confirm payment by {{target_date}} to avoid escalation.\n\nRegards,\n{{workspace_name}}",
    sms: "Invoice {{invoice_number}} is {{days_overdue}} days overdue. Please confirm payment by {{target_date}} to avoid escalation.",
  },
  collections_warning: {
    email:
      "Hi {{client_name}},\n\nThis is a formal notice regarding unpaid invoice {{invoice_number}} ({{amount}}). If payment is not received by {{target_date}}, the account may be referred for collections and small-claims preparation.\n\nThis notice is sent in good faith to resolve the balance without further action.\n\n{{workspace_name}}",
    sms: "Formal notice: invoice {{invoice_number}} ({{amount}}) remains unpaid. Please settle by {{target_date}} to avoid collections escalation.",
  },
  small_claims_template: {
    email:
      "Hi {{client_name}},\n\nI have prepared a small-claims filing packet for invoice {{invoice_number}} ({{amount}}), currently {{days_overdue}} days overdue. Payment received by {{target_date}} will close this matter.\n\n{{workspace_name}}",
    sms: "Small-claims prep started for invoice {{invoice_number}}. Payment by {{target_date}} resolves this without filing.",
  },
};
