import { DEFAULT_WORKSPACE_SLUG } from "@/lib/constants";
import type {
  Client,
  EscalationRun,
  EscalationStep,
  Invoice,
  LegalPacket,
  MessageEvent,
  Workspace,
} from "@/lib/types";

interface MockStore {
  workspaces: Workspace[];
  clients: Client[];
  invoices: Invoice[];
  runs: EscalationRun[];
  steps: EscalationStep[];
  events: MessageEvent[];
  legalPackets: LegalPacket[];
}

declare global {
  var __invoiceRecoveryStore: MockStore | undefined;
}

function createSeedStore(): MockStore {
  const now = new Date().toISOString();
  const workspace: Workspace = {
    id: "ws_demo",
    slug: DEFAULT_WORKSPACE_SLUG,
    name: "Demo Studio",
    plan: "trial",
  };

  const client: Client = {
    id: "client_demo",
    workspaceId: workspace.id,
    name: "North Ridge Labs",
    primaryEmail: "accounts@northridge.example",
    primaryPhone: "+15550001234",
  };

  const invoice: Invoice = {
    id: "inv_demo",
    workspaceId: workspace.id,
    clientId: client.id,
    invoiceNumber: "NR-1042",
    amountCents: 285000,
    currency: "USD",
    issueDate: "2026-01-02",
    dueDate: "2026-01-22",
    status: "at_risk",
    notes: "Brand refresh retainer",
    createdAt: now,
    updatedAt: now,
  };

  const run: EscalationRun = {
    id: "run_demo",
    invoiceId: invoice.id,
    state: "awaiting_approval",
    currentStage: "polite_nudge",
    createdAt: now,
    updatedAt: now,
  };

  const step: EscalationStep = {
    id: "step_demo",
    runId: run.id,
    stage: "polite_nudge",
    channel: "email",
    status: "awaiting_approval",
    previewBody:
      "Hi North Ridge Labs, quick reminder that invoice NR-1042 ($2,850.00) is outstanding.",
    createdAt: now,
  };

  return {
    workspaces: [workspace],
    clients: [client],
    invoices: [invoice],
    runs: [run],
    steps: [step],
    events: [],
    legalPackets: [],
  };
}

export function getMockStore(): MockStore {
  if (!globalThis.__invoiceRecoveryStore) {
    globalThis.__invoiceRecoveryStore = createSeedStore();
  }
  return globalThis.__invoiceRecoveryStore;
}
