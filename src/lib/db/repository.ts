import { addDays, format } from "date-fns";
import {
  DEFAULT_WORKSPACE_SLUG,
  ESCALATION_STAGE_ORDER,
  MESSAGE_TEMPLATES,
} from "@/lib/constants";
import {
  getSupabaseServiceClient,
  type AppSupabaseClient,
} from "@/lib/db/supabase";
import { getMockStore } from "@/lib/db/mock";
import type {
  Client,
  CreateInvoiceInput,
  DashboardStats,
  EscalationPreview,
  EscalationRun,
  EscalationStage,
  EscalationStep,
  Invoice,
  InvoiceWithRelations,
  LegalPacket,
  MessageChannel,
  MessageEvent,
  Workspace,
} from "@/lib/types";
import { computeDaysOverdue, formatCurrency, randomId } from "@/lib/utils";

type CsvInvoiceRow = {
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  invoiceNumber: string;
  amount?: string | number;
  amountCents?: string | number;
  currency?: string;
  dueDate: string;
  issueDate?: string;
  notes?: string;
};

interface PreviewContext {
  client_name: string;
  invoice_number: string;
  amount: string;
  due_date: string;
  days_overdue: string;
  target_date: string;
  workspace_name: string;
}

export interface RepositoryContext {
  actorEmail?: string | null;
  supabase?: AppSupabaseClient | null;
}

function resolveSupabaseClient(
  context?: RepositoryContext,
): AppSupabaseClient | null {
  if (context?.supabase) {
    return context.supabase;
  }

  return getSupabaseServiceClient();
}

function relationValue<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function parseAmountCents(value: number | string | undefined): number {
  if (value === undefined) {
    return 0;
  }

  if (typeof value === "number") {
    return Number.isInteger(value) ? value : Math.round(value * 100);
  }

  const numeric = Number(value.replace(/[^0-9.-]/g, ""));
  if (Number.isNaN(numeric)) {
    return 0;
  }

  return value.includes(".") ? Math.round(numeric * 100) : Math.round(numeric);
}

function renderTemplate(template: string, context: PreviewContext): string {
  return template.replace(/\{\{(.*?)\}\}/g, (_, key) => {
    const token = String(key).trim() as keyof PreviewContext;
    return context[token] ?? "";
  });
}

function buildPreviewContext(
  invoice: Invoice,
  client: Client,
  workspace: Workspace,
): PreviewContext {
  const daysOverdue = computeDaysOverdue(invoice.dueDate);
  const targetDate = format(addDays(new Date(), 5), "yyyy-MM-dd");

  return {
    client_name: client.name,
    invoice_number: invoice.invoiceNumber,
    amount: formatCurrency(invoice.amountCents, invoice.currency),
    due_date: invoice.dueDate,
    days_overdue: String(daysOverdue),
    target_date: targetDate,
    workspace_name: workspace.name,
  };
}

function determineNextStage(detail: InvoiceWithRelations): EscalationStage {
  const pending = detail.steps
    .filter((step) =>
      ["drafted", "awaiting_approval", "scheduled"].includes(step.status),
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];

  if (pending) {
    return pending.stage;
  }

  const seen = new Set(detail.steps.map((step) => step.stage));
  for (const stage of ESCALATION_STAGE_ORDER) {
    if (!seen.has(stage)) {
      return stage;
    }
  }

  return ESCALATION_STAGE_ORDER[ESCALATION_STAGE_ORDER.length - 1];
}

function computeRecommendedSendAt(): string {
  return new Date().toISOString();
}

function mapWorkspaceRow(row: Record<string, unknown>): Workspace {
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    plan: String(row.plan ?? "trial"),
  };
}

function mapClientRow(row: Record<string, unknown>): Client {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    name: String(row.name),
    primaryEmail: (row.primary_email as string | null) ?? null,
    primaryPhone: (row.primary_phone as string | null) ?? null,
  };
}

function mapInvoiceRow(row: Record<string, unknown>): Invoice {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    clientId: String(row.client_id),
    invoiceNumber: String(row.invoice_number),
    amountCents: Number(row.amount_cents),
    currency: String(row.currency),
    issueDate: (row.issue_date as string | null) ?? null,
    dueDate: String(row.due_date),
    status: row.status as Invoice["status"],
    notes: (row.notes as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapRunRow(row: Record<string, unknown>): EscalationRun {
  return {
    id: String(row.id),
    invoiceId: String(row.invoice_id),
    state: row.state as EscalationRun["state"],
    currentStage: (row.current_stage as EscalationStage | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapStepRow(row: Record<string, unknown>): EscalationStep {
  return {
    id: String(row.id),
    runId: String(row.run_id),
    stage: row.stage as EscalationStage,
    channel: row.channel as MessageChannel,
    status: row.status as EscalationStep["status"],
    previewBody: (row.preview_body as string | null) ?? null,
    scheduledFor: (row.scheduled_for as string | null) ?? null,
    approvedAt: (row.approved_at as string | null) ?? null,
    sentAt: (row.sent_at as string | null) ?? null,
    createdAt: String(row.created_at),
  };
}

function mapEventRow(row: Record<string, unknown>): MessageEvent {
  return {
    id: String(row.id),
    invoiceId: String(row.invoice_id),
    stage: (row.stage as EscalationStage | null) ?? null,
    channel: row.channel as MessageChannel,
    direction: row.direction as MessageEvent["direction"],
    body: String(row.body),
    providerMessageId: (row.provider_message_id as string | null) ?? null,
    deliveryState: (row.delivery_state as string | null) ?? null,
    metadata:
      (row.metadata as Record<string, string | number | boolean | null>) ?? {},
    createdAt: String(row.created_at),
  };
}

function mapLegalPacketRow(row: Record<string, unknown>): LegalPacket {
  return {
    id: String(row.id),
    invoiceId: String(row.invoice_id),
    jurisdiction: String(row.jurisdiction),
    content: String(row.content),
    generatedAt: String(row.generated_at),
  };
}

async function ensureWorkspaceBySlug(
  workspaceSlug: string,
  context?: RepositoryContext,
): Promise<Workspace> {
  const supabase = resolveSupabaseClient(context);

  if (supabase) {
    const slug = workspaceSlug || DEFAULT_WORKSPACE_SLUG;
    const existing = await supabase
      .from("workspaces")
      .select("id,slug,name,plan")
      .eq("slug", slug)
      .maybeSingle();

    if (existing.error) {
      throw new Error(existing.error.message);
    }

    if (existing.data) {
      return mapWorkspaceRow(existing.data as Record<string, unknown>);
    }

    const inserted = await supabase
      .from("workspaces")
      .insert({
        slug,
        name: slug
          .split("-")
          .filter(Boolean)
          .map((chunk) => chunk[0].toUpperCase() + chunk.slice(1))
          .join(" "),
        plan: "trial",
      })
      .select("id,slug,name,plan")
      .single();

    if (inserted.error) {
      if (inserted.error.code === "23505") {
        throw new Error("Workspace already exists but is not accessible.");
      }
      throw new Error(inserted.error.message);
    }

    const workspace = mapWorkspaceRow(inserted.data as Record<string, unknown>);

    await supabase.from("escalation_policies").upsert(
      {
        workspace_id: workspace.id,
        send_email: true,
        send_sms: true,
        days_between_steps: 4,
        require_approval: true,
        tone: "conservative",
      },
      {
        onConflict: "workspace_id",
      },
    );

    return workspace;
  }

  const store = getMockStore();
  const slug = workspaceSlug || DEFAULT_WORKSPACE_SLUG;
  const workspace = store.workspaces.find((item) => item.slug === slug);
  if (workspace) {
    return workspace;
  }

  const created: Workspace = {
    id: randomId("ws"),
    slug,
    name: slug,
    plan: "trial",
  };

  store.workspaces.push(created);
  return created;
}

async function ensureClient(
  input: {
    workspaceId: string;
    clientName: string;
    clientEmail?: string;
    clientPhone?: string;
  },
  context?: RepositoryContext,
): Promise<Client> {
  const supabase = resolveSupabaseClient(context);

  if (supabase) {
    const existing = await supabase
      .from("clients")
      .select("id,workspace_id,name,primary_email,primary_phone")
      .eq("workspace_id", input.workspaceId)
      .ilike("name", input.clientName)
      .maybeSingle();

    if (existing.error) {
      throw new Error(existing.error.message);
    }

    if (existing.data) {
      return mapClientRow(existing.data as Record<string, unknown>);
    }

    const inserted = await supabase
      .from("clients")
      .insert({
        workspace_id: input.workspaceId,
        name: input.clientName,
        primary_email: input.clientEmail ?? null,
        primary_phone: input.clientPhone ?? null,
      })
      .select("id,workspace_id,name,primary_email,primary_phone")
      .single();

    if (inserted.error) {
      throw new Error(inserted.error.message);
    }

    return mapClientRow(inserted.data as Record<string, unknown>);
  }

  const store = getMockStore();
  const existing = store.clients.find(
    (client) =>
      client.workspaceId === input.workspaceId &&
      client.name.toLowerCase() === input.clientName.toLowerCase(),
  );

  if (existing) {
    return existing;
  }

  const client: Client = {
    id: randomId("client"),
    workspaceId: input.workspaceId,
    name: input.clientName,
    primaryEmail: input.clientEmail ?? null,
    primaryPhone: input.clientPhone ?? null,
  };

  store.clients.push(client);
  return client;
}

async function ensureEscalationRun(
  invoiceId: string,
  context?: RepositoryContext,
): Promise<EscalationRun> {
  const supabase = resolveSupabaseClient(context);

  if (supabase) {
    const existing = await supabase
      .from("escalation_runs")
      .select("id,invoice_id,state,current_stage,created_at,updated_at")
      .eq("invoice_id", invoiceId)
      .maybeSingle();

    if (existing.error) {
      throw new Error(existing.error.message);
    }

    if (existing.data) {
      return mapRunRow(existing.data as Record<string, unknown>);
    }

    const inserted = await supabase
      .from("escalation_runs")
      .insert({
        invoice_id: invoiceId,
        state: "new",
        current_stage: null,
      })
      .select("id,invoice_id,state,current_stage,created_at,updated_at")
      .single();

    if (inserted.error) {
      throw new Error(inserted.error.message);
    }

    return mapRunRow(inserted.data as Record<string, unknown>);
  }

  const store = getMockStore();
  const existing = store.runs.find((run) => run.invoiceId === invoiceId);
  if (existing) {
    return existing;
  }

  const now = new Date().toISOString();
  const run: EscalationRun = {
    id: randomId("run"),
    invoiceId,
    state: "new",
    currentStage: null,
    createdAt: now,
    updatedAt: now,
  };

  store.runs.push(run);
  return run;
}

async function getWorkspaceById(
  workspaceId: string,
  context?: RepositoryContext,
): Promise<Workspace> {
  const supabase = resolveSupabaseClient(context);
  if (supabase) {
    const row = await supabase
      .from("workspaces")
      .select("id,slug,name,plan")
      .eq("id", workspaceId)
      .single();

    if (row.error) {
      throw new Error(row.error.message);
    }

    return mapWorkspaceRow(row.data as Record<string, unknown>);
  }

  const store = getMockStore();
  const workspace = store.workspaces.find((item) => item.id === workspaceId);
  if (!workspace) {
    throw new Error("Workspace not found.");
  }

  return workspace;
}

export async function listInvoices(
  workspaceSlug = DEFAULT_WORKSPACE_SLUG,
  context?: RepositoryContext,
): Promise<InvoiceWithRelations[]> {
  const workspace = await ensureWorkspaceBySlug(workspaceSlug, context);
  const supabase = resolveSupabaseClient(context);

  if (supabase) {
    const rows = await supabase
      .from("invoices")
      .select(
        "id,workspace_id,client_id,invoice_number,amount_cents,currency,issue_date,due_date,status,notes,created_at,updated_at,clients(id,workspace_id,name,primary_email,primary_phone),escalation_runs(id,invoice_id,state,current_stage,created_at,updated_at)",
      )
      .eq("workspace_id", workspace.id)
      .order("due_date", { ascending: true });

    if (rows.error) {
      throw new Error(rows.error.message);
    }

    const mapped = (rows.data ?? []).map((row: unknown) => {
      const invoice = mapInvoiceRow(row as unknown as Record<string, unknown>);
      const client = mapClientRow(
        relationValue((row as { clients: unknown }).clients) as Record<
          string,
          unknown
        >,
      );
      const runRow = relationValue(
        (row as { escalation_runs: unknown }).escalation_runs,
      );

      return {
        invoice,
        client,
        escalationRun: runRow
          ? mapRunRow(runRow as Record<string, unknown>)
          : null,
        steps: [],
        events: [],
        legalPacket: null,
      };
    });

    return mapped;
  }

  const store = getMockStore();
  return store.invoices
    .filter((invoice) => invoice.workspaceId === workspace.id)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .map((invoice) => {
      const client = store.clients.find((item) => item.id === invoice.clientId);
      if (!client) {
        throw new Error(`Missing client for invoice ${invoice.id}`);
      }

      return {
        invoice,
        client,
        escalationRun:
          store.runs.find((item) => item.invoiceId === invoice.id) ?? null,
        steps: store.steps.filter(
          (step) =>
            step.runId ===
            (store.runs.find((item) => item.invoiceId === invoice.id)?.id ?? ""),
        ),
        events: store.events.filter((event) => event.invoiceId === invoice.id),
        legalPacket:
          store.legalPackets.find((packet) => packet.invoiceId === invoice.id) ??
          null,
      };
    });
}

export async function getInvoiceById(
  invoiceId: string,
  context?: RepositoryContext,
): Promise<InvoiceWithRelations | null> {
  const supabase = resolveSupabaseClient(context);

  if (supabase) {
    const invoiceRow = await supabase
      .from("invoices")
      .select(
        "id,workspace_id,client_id,invoice_number,amount_cents,currency,issue_date,due_date,status,notes,created_at,updated_at,clients(id,workspace_id,name,primary_email,primary_phone)",
      )
      .eq("id", invoiceId)
      .maybeSingle();

    if (invoiceRow.error) {
      throw new Error(invoiceRow.error.message);
    }

    if (!invoiceRow.data) {
      return null;
    }

    const invoice = mapInvoiceRow(
      invoiceRow.data as unknown as Record<string, unknown>,
    );
    const client = mapClientRow(
      relationValue((invoiceRow.data as { clients: unknown }).clients) as Record<
        string,
        unknown
      >,
    );

    const runRow = await supabase
      .from("escalation_runs")
      .select("id,invoice_id,state,current_stage,created_at,updated_at")
      .eq("invoice_id", invoiceId)
      .maybeSingle();

    if (runRow.error) {
      throw new Error(runRow.error.message);
    }

    const stepRows = runRow.data
      ? await supabase
          .from("escalation_steps")
          .select(
            "id,run_id,stage,channel,status,preview_body,scheduled_for,approved_at,sent_at,created_at",
          )
          .eq(
            "run_id",
            String((runRow.data as Record<string, unknown>).id),
          )
          .order("created_at", { ascending: true })
      : { data: [], error: null };

    if (stepRows.error) {
      throw new Error(stepRows.error.message);
    }

    const eventRows = await supabase
      .from("message_events")
      .select(
        "id,invoice_id,stage,channel,direction,body,provider_message_id,delivery_state,metadata,created_at",
      )
      .eq("invoice_id", invoiceId)
      .order("created_at", { ascending: true });

    if (eventRows.error) {
      throw new Error(eventRows.error.message);
    }

    const packetRow = await supabase
      .from("legal_packets")
      .select("id,invoice_id,jurisdiction,content,generated_at")
      .eq("invoice_id", invoiceId)
      .maybeSingle();

    if (packetRow.error) {
      throw new Error(packetRow.error.message);
    }

    return {
      invoice,
      client,
      escalationRun: runRow.data
        ? mapRunRow(runRow.data as unknown as Record<string, unknown>)
        : null,
      steps: (stepRows.data ?? []).map((row: unknown) =>
        mapStepRow(row as unknown as Record<string, unknown>),
      ),
      events: (eventRows.data ?? []).map((row: unknown) =>
        mapEventRow(row as unknown as Record<string, unknown>),
      ),
      legalPacket: packetRow.data
        ? mapLegalPacketRow(packetRow.data as unknown as Record<string, unknown>)
        : null,
    };
  }

  const store = getMockStore();
  const invoice = store.invoices.find((item) => item.id === invoiceId);
  if (!invoice) {
    return null;
  }

  const client = store.clients.find((item) => item.id === invoice.clientId);
  if (!client) {
    throw new Error("Client record is missing.");
  }

  const run = store.runs.find((item) => item.invoiceId === invoice.id) ?? null;

  return {
    invoice,
    client,
    escalationRun: run,
    steps: run
      ? store.steps.filter((step) => step.runId === run.id)
      : ([] as EscalationStep[]),
    events: store.events.filter((event) => event.invoiceId === invoice.id),
    legalPacket:
      store.legalPackets.find((packet) => packet.invoiceId === invoice.id) ??
      null,
  };
}

export async function createInvoice(
  input: CreateInvoiceInput,
  context?: RepositoryContext,
): Promise<InvoiceWithRelations> {
  const workspace = await ensureWorkspaceBySlug(input.workspaceSlug, context);
  const client = await ensureClient({
    workspaceId: workspace.id,
    clientName: input.clientName,
    clientEmail: input.clientEmail,
    clientPhone: input.clientPhone,
  }, context);

  const supabase = resolveSupabaseClient(context);

  if (supabase) {
    const inserted = await supabase
      .from("invoices")
      .insert({
        workspace_id: workspace.id,
        client_id: client.id,
        invoice_number: input.invoiceNumber,
        amount_cents: input.amountCents,
        currency: input.currency,
        issue_date: input.issueDate ?? null,
        due_date: input.dueDate,
        status: "at_risk",
        notes: input.notes ?? null,
      })
      .select(
        "id,workspace_id,client_id,invoice_number,amount_cents,currency,issue_date,due_date,status,notes,created_at,updated_at",
      )
      .single();

    if (inserted.error) {
      throw new Error(inserted.error.message);
    }

    const invoice = mapInvoiceRow(inserted.data as Record<string, unknown>);

    await ensureEscalationRun(invoice.id, context);

    const detail = await getInvoiceById(invoice.id, context);
    if (!detail) {
      throw new Error("Unable to load created invoice.");
    }

    return detail;
  }

  const store = getMockStore();
  const now = new Date().toISOString();
  const invoice: Invoice = {
    id: randomId("inv"),
    workspaceId: workspace.id,
    clientId: client.id,
    invoiceNumber: input.invoiceNumber,
    amountCents: input.amountCents,
    currency: input.currency,
    issueDate: input.issueDate ?? null,
    dueDate: input.dueDate,
    status: "at_risk",
    notes: input.notes ?? null,
    createdAt: now,
    updatedAt: now,
  };

  store.invoices.push(invoice);
  await ensureEscalationRun(invoice.id, context);

  const detail = await getInvoiceById(invoice.id, context);
  if (!detail) {
    throw new Error("Unable to load created invoice.");
  }
  return detail;
}

export async function importCsvInvoices(
  workspaceSlug: string,
  rows: CsvInvoiceRow[],
  context?: RepositoryContext,
): Promise<{ created: number; failed: Array<{ row: number; reason: string }> }> {
  let created = 0;
  const failed: Array<{ row: number; reason: string }> = [];

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    try {
      const amountCents =
        row.amountCents !== undefined
          ? parseAmountCents(row.amountCents)
          : parseAmountCents(row.amount);

      if (!row.clientName || !row.invoiceNumber || !row.dueDate || !amountCents) {
        throw new Error("Missing required invoice fields.");
      }

      await createInvoice({
        workspaceSlug,
        clientName: row.clientName,
        clientEmail: row.clientEmail,
        clientPhone: row.clientPhone,
        invoiceNumber: row.invoiceNumber,
        amountCents,
        currency: row.currency || "USD",
        dueDate: row.dueDate,
        issueDate: row.issueDate,
        notes: row.notes,
      }, context);

      created += 1;
    } catch (error) {
      failed.push({
        row: index + 1,
        reason: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return {
    created,
    failed,
  };
}

export async function previewEscalationStep(
  invoiceId: string,
  context?: RepositoryContext,
): Promise<EscalationPreview> {
  const detail = await getInvoiceById(invoiceId, context);
  if (!detail) {
    throw new Error("Invoice not found.");
  }

  const workspace = await getWorkspaceById(detail.invoice.workspaceId, context);
  const stage = determineNextStage(detail);
  const previewContext = buildPreviewContext(
    detail.invoice,
    detail.client,
    workspace,
  );
  const emailBody = detail.client.primaryEmail
    ? renderTemplate(MESSAGE_TEMPLATES[stage].email, previewContext)
    : undefined;
  const smsBody = detail.client.primaryPhone
    ? renderTemplate(MESSAGE_TEMPLATES[stage].sms, previewContext)
    : undefined;

  return {
    invoiceId,
    stage,
    emailBody,
    smsBody,
    recommendedSendAt: computeRecommendedSendAt(),
  };
}

export async function approveEscalationStep(
  invoiceId: string,
  context?: RepositoryContext,
) {
  const preview = await previewEscalationStep(invoiceId, context);
  const detail = await getInvoiceById(invoiceId, context);
  if (!detail) {
    throw new Error("Invoice not found.");
  }

  const run = await ensureEscalationRun(invoiceId, context);
  const now = new Date().toISOString();
  const channels: Array<{ channel: MessageChannel; body: string }> = [];

  if (preview.emailBody) {
    channels.push({ channel: "email", body: preview.emailBody });
  }

  if (preview.smsBody) {
    channels.push({ channel: "sms", body: preview.smsBody });
  }

  const supabase = resolveSupabaseClient(context);

  if (supabase) {
    const runUpdate = await supabase
      .from("escalation_runs")
      .update({
        state: "scheduled",
        current_stage: preview.stage,
        updated_at: now,
      })
      .eq("id", run.id);

    if (runUpdate.error) {
      throw new Error(runUpdate.error.message);
    }

    for (const item of channels) {
      const stepUpsert = await supabase.from("escalation_steps").upsert(
        {
          run_id: run.id,
          stage: preview.stage,
          channel: item.channel,
          status: "scheduled",
          preview_body: item.body,
          scheduled_for: preview.recommendedSendAt,
          approved_at: now,
        },
        {
          onConflict: "run_id,stage,channel",
        },
      );

      if (stepUpsert.error) {
        throw new Error(stepUpsert.error.message);
      }

      const eventInsert = await supabase.from("message_events").insert({
        invoice_id: invoiceId,
        stage: preview.stage,
        channel: item.channel,
        direction: "outbound",
        body: item.body,
        delivery_state: "queued",
        metadata: {
          approved_at: now,
        },
      });

      if (eventInsert.error) {
        throw new Error(eventInsert.error.message);
      }
    }

    const invoiceUpdate = await supabase
      .from("invoices")
      .update({ status: "in_recovery", updated_at: now })
      .eq("id", invoiceId)
      .neq("status", "paid");

    if (invoiceUpdate.error) {
      throw new Error(invoiceUpdate.error.message);
    }

    await supabase.from("audit_logs").insert({
      workspace_id: detail.invoice.workspaceId,
      actor_email: context?.actorEmail ?? "system",
      action: "approve_escalation_step",
      entity_type: "invoice",
      entity_id: invoiceId,
      payload: {
        stage: preview.stage,
        channels: channels.map((item) => item.channel),
      },
    });

    return getInvoiceById(invoiceId, context);
  }

  const store = getMockStore();
  const runIndex = store.runs.findIndex((item) => item.id === run.id);
  if (runIndex >= 0) {
    store.runs[runIndex] = {
      ...store.runs[runIndex],
      state: "scheduled",
      currentStage: preview.stage,
      updatedAt: now,
    };
  }

  channels.forEach((item) => {
    const existing = store.steps.find(
      (step) =>
        step.runId === run.id &&
        step.stage === preview.stage &&
        step.channel === item.channel,
    );

    if (existing) {
      existing.status = "scheduled";
      existing.previewBody = item.body;
      existing.approvedAt = now;
      existing.scheduledFor = preview.recommendedSendAt;
    } else {
      store.steps.push({
        id: randomId("step"),
        runId: run.id,
        stage: preview.stage,
        channel: item.channel,
        status: "scheduled",
        previewBody: item.body,
        approvedAt: now,
        scheduledFor: preview.recommendedSendAt,
        createdAt: now,
      });
    }

    store.events.push({
      id: randomId("evt"),
      invoiceId,
      stage: preview.stage,
      channel: item.channel,
      direction: "outbound",
      body: item.body,
      providerMessageId: null,
      deliveryState: "queued",
      metadata: {
        approved_at: now,
      },
      createdAt: now,
    });
  });

  const invoiceIndex = store.invoices.findIndex((item) => item.id === invoiceId);
  if (invoiceIndex >= 0 && store.invoices[invoiceIndex].status !== "paid") {
    store.invoices[invoiceIndex] = {
      ...store.invoices[invoiceIndex],
      status: "in_recovery",
      updatedAt: now,
    };
  }

  return getInvoiceById(invoiceId, context);
}

export async function pauseEscalation(
  invoiceId: string,
  context?: RepositoryContext,
) {
  const detail = await getInvoiceById(invoiceId, context);
  if (!detail) {
    throw new Error("Invoice not found.");
  }

  const run = await ensureEscalationRun(invoiceId, context);
  const now = new Date().toISOString();
  const supabase = resolveSupabaseClient(context);

  if (supabase) {
    const runUpdate = await supabase
      .from("escalation_runs")
      .update({ state: "paused", updated_at: now })
      .eq("id", run.id);

    if (runUpdate.error) {
      throw new Error(runUpdate.error.message);
    }

    const invoiceUpdate = await supabase
      .from("invoices")
      .update({ status: "paused", updated_at: now })
      .eq("id", invoiceId)
      .neq("status", "paid");

    if (invoiceUpdate.error) {
      throw new Error(invoiceUpdate.error.message);
    }

    return getInvoiceById(invoiceId, context);
  }

  const store = getMockStore();
  const runIndex = store.runs.findIndex((item) => item.id === run.id);
  if (runIndex >= 0) {
    store.runs[runIndex] = {
      ...store.runs[runIndex],
      state: "paused",
      updatedAt: now,
    };
  }

  const invoiceIndex = store.invoices.findIndex((item) => item.id === invoiceId);
  if (invoiceIndex >= 0 && store.invoices[invoiceIndex].status !== "paid") {
    store.invoices[invoiceIndex] = {
      ...store.invoices[invoiceIndex],
      status: "paused",
      updatedAt: now,
    };
  }

  return getInvoiceById(invoiceId, context);
}

export async function markInvoicePaid(
  invoiceId: string,
  context?: RepositoryContext,
) {
  const detail = await getInvoiceById(invoiceId, context);
  if (!detail) {
    throw new Error("Invoice not found.");
  }

  const run = await ensureEscalationRun(invoiceId, context);
  const now = new Date().toISOString();
  const supabase = resolveSupabaseClient(context);

  if (supabase) {
    const invoiceUpdate = await supabase
      .from("invoices")
      .update({ status: "paid", updated_at: now })
      .eq("id", invoiceId);

    if (invoiceUpdate.error) {
      throw new Error(invoiceUpdate.error.message);
    }

    const runUpdate = await supabase
      .from("escalation_runs")
      .update({ state: "completed", updated_at: now })
      .eq("id", run.id);

    if (runUpdate.error) {
      throw new Error(runUpdate.error.message);
    }

    await supabase.from("audit_logs").insert({
      workspace_id: detail.invoice.workspaceId,
      actor_email: context?.actorEmail ?? "system",
      action: "mark_invoice_paid",
      entity_type: "invoice",
      entity_id: invoiceId,
      payload: {},
    });

    return getInvoiceById(invoiceId, context);
  }

  const store = getMockStore();
  const invoiceIndex = store.invoices.findIndex((item) => item.id === invoiceId);
  if (invoiceIndex >= 0) {
    store.invoices[invoiceIndex] = {
      ...store.invoices[invoiceIndex],
      status: "paid",
      updatedAt: now,
    };
  }

  const runIndex = store.runs.findIndex((item) => item.id === run.id);
  if (runIndex >= 0) {
    store.runs[runIndex] = {
      ...store.runs[runIndex],
      state: "completed",
      updatedAt: now,
    };
  }

  return getInvoiceById(invoiceId, context);
}

export async function generateLegalPacket(
  invoiceId: string,
  jurisdiction: string,
  context?: RepositoryContext,
): Promise<LegalPacket> {
  const detail = await getInvoiceById(invoiceId, context);
  if (!detail) {
    throw new Error("Invoice not found.");
  }

  const workspace = await getWorkspaceById(detail.invoice.workspaceId, context);
  const daysOverdue = computeDaysOverdue(detail.invoice.dueDate);
  const content = [
    "Small-Claims Preparation Template",
    "",
    "Disclaimer: This document is informational and not legal advice.",
    "",
    `Workspace: ${workspace.name}`,
    `Client: ${detail.client.name}`,
    `Invoice: ${detail.invoice.invoiceNumber}`,
    `Amount: ${formatCurrency(detail.invoice.amountCents, detail.invoice.currency)}`,
    `Days overdue: ${daysOverdue}`,
    `Jurisdiction: ${jurisdiction}`,
    "",
    "Suggested filing checklist:",
    "1. Confirm signed scope/contract and invoice delivery proof.",
    "2. Attach payment reminders and response history.",
    "3. Attach this invoice summary and amount calculation.",
    "4. File in the court matching your contract or debtor location.",
  ].join("\n");

  const now = new Date().toISOString();
  const supabase = resolveSupabaseClient(context);

  if (supabase) {
    const packet = await supabase
      .from("legal_packets")
      .upsert(
        {
          invoice_id: invoiceId,
          jurisdiction,
          content,
          generated_at: now,
        },
        {
          onConflict: "invoice_id",
        },
      )
      .select("id,invoice_id,jurisdiction,content,generated_at")
      .single();

    if (packet.error) {
      throw new Error(packet.error.message);
    }

    return mapLegalPacketRow(packet.data as Record<string, unknown>);
  }

  const store = getMockStore();
  const existing = store.legalPackets.find((item) => item.invoiceId === invoiceId);
  if (existing) {
    existing.jurisdiction = jurisdiction;
    existing.content = content;
    existing.generatedAt = now;
    return existing;
  }

  const packet: LegalPacket = {
    id: randomId("packet"),
    invoiceId,
    jurisdiction,
    content,
    generatedAt: now,
  };

  store.legalPackets.push(packet);
  return packet;
}

export async function getDashboardStats(
  workspaceSlug = DEFAULT_WORKSPACE_SLUG,
  context?: RepositoryContext,
): Promise<DashboardStats> {
  const invoices = await listInvoices(workspaceSlug, context);
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();

  const activeRecoveries = invoices.filter(
    (item) => item.invoice.status === "in_recovery",
  ).length;

  const awaitingApproval = invoices.filter(
    (item) => item.escalationRun?.state === "awaiting_approval",
  ).length;

  const resolvedThisMonth = invoices.filter((item) => {
    if (item.invoice.status !== "paid") {
      return false;
    }
    const paidDate = new Date(item.invoice.updatedAt);
    return paidDate.getMonth() === month && paidDate.getFullYear() === year;
  }).length;

  const totalOutstandingCents = invoices
    .filter((item) => item.invoice.status !== "paid")
    .reduce((sum, item) => sum + item.invoice.amountCents, 0);

  return {
    totalOutstandingCents,
    activeRecoveries,
    awaitingApproval,
    resolvedThisMonth,
  };
}

export function getStageTemplates() {
  return MESSAGE_TEMPLATES;
}
