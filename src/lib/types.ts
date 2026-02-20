export type WorkspaceRole = "owner" | "admin" | "member";

export type InvoiceStatus =
  | "new"
  | "at_risk"
  | "in_recovery"
  | "paused"
  | "paid"
  | "closed_unresolved";

export type EscalationState =
  | "new"
  | "awaiting_approval"
  | "scheduled"
  | "paused"
  | "completed";

export type EscalationStage =
  | "polite_nudge"
  | "firm_follow_up"
  | "collections_warning"
  | "small_claims_template";

export type MessageChannel = "email" | "sms";
export type MessageDirection = "outbound" | "inbound";

export interface Workspace {
  id: string;
  slug: string;
  name: string;
  plan: string;
}

export interface Client {
  id: string;
  workspaceId: string;
  name: string;
  primaryEmail?: string | null;
  primaryPhone?: string | null;
}

export interface Invoice {
  id: string;
  workspaceId: string;
  clientId: string;
  invoiceNumber: string;
  amountCents: number;
  currency: string;
  issueDate?: string | null;
  dueDate: string;
  status: InvoiceStatus;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EscalationRun {
  id: string;
  invoiceId: string;
  state: EscalationState;
  currentStage?: EscalationStage | null;
  createdAt: string;
  updatedAt: string;
}

export interface EscalationStep {
  id: string;
  runId: string;
  stage: EscalationStage;
  channel: MessageChannel;
  status:
    | "drafted"
    | "awaiting_approval"
    | "scheduled"
    | "sent"
    | "acknowledged"
    | "failed";
  previewBody?: string | null;
  scheduledFor?: string | null;
  approvedAt?: string | null;
  sentAt?: string | null;
  createdAt: string;
}

export interface MessageEvent {
  id: string;
  invoiceId: string;
  stage?: EscalationStage | null;
  channel: MessageChannel;
  direction: MessageDirection;
  body: string;
  providerMessageId?: string | null;
  deliveryState?: string | null;
  metadata: Record<string, string | number | boolean | null>;
  createdAt: string;
}

export interface LegalPacket {
  id: string;
  invoiceId: string;
  jurisdiction: string;
  content: string;
  generatedAt: string;
}

export interface InvoiceWithRelations {
  invoice: Invoice;
  client: Client;
  escalationRun: EscalationRun | null;
  steps: EscalationStep[];
  events: MessageEvent[];
  legalPacket: LegalPacket | null;
}

export interface CreateInvoiceInput {
  workspaceSlug: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  invoiceNumber: string;
  amountCents: number;
  currency: string;
  dueDate: string;
  issueDate?: string;
  notes?: string;
}

export interface EscalationPreview {
  invoiceId: string;
  stage: EscalationStage;
  emailBody?: string;
  smsBody?: string;
  recommendedSendAt: string;
}

export interface DashboardStats {
  totalOutstandingCents: number;
  activeRecoveries: number;
  awaitingApproval: number;
  resolvedThisMonth: number;
}
