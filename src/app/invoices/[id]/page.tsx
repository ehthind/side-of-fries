"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { SiteNav } from "@/components/site-nav";
import { StatusPill } from "@/components/status-pill";
import { STAGE_LABEL } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";

type DetailResponse = {
  invoice: {
    invoice: {
      id: string;
      invoiceNumber: string;
      amountCents: number;
      currency: string;
      dueDate: string;
      issueDate?: string | null;
      status: string;
      notes?: string | null;
      updatedAt: string;
    };
    client: {
      name: string;
      primaryEmail?: string | null;
      primaryPhone?: string | null;
    };
    escalationRun: {
      id: string;
      state: string;
      currentStage?: string | null;
    } | null;
    steps: Array<{
      id: string;
      stage: keyof typeof STAGE_LABEL;
      channel: string;
      status: string;
      previewBody?: string | null;
      createdAt: string;
    }>;
    events: Array<{
      id: string;
      stage?: keyof typeof STAGE_LABEL | null;
      channel: string;
      direction: string;
      body: string;
      deliveryState?: string | null;
      createdAt: string;
    }>;
    legalPacket: {
      jurisdiction: string;
      content: string;
      generatedAt: string;
    } | null;
  };
};

type Preview = {
  stage: keyof typeof STAGE_LABEL;
  emailBody?: string;
  smsBody?: string;
  recommendedSendAt: string;
};

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const invoiceId = params.id;

  const [detail, setDetail] = useState<DetailResponse["invoice"] | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [jurisdiction, setJurisdiction] = useState("Global - Basic");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const loadDetail = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/invoices/${invoiceId}`, {
        cache: "no-store",
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.details ?? payload.error ?? "Failed to load invoice.");
      }

      setDetail(payload.invoice);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load invoice.");
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => {
    loadDetail().catch(() => undefined);
  }, [loadDetail]);

  async function requestPreview() {
    try {
      setBusy(true);
      setError(null);
      const response = await fetch(`/api/escalations/${invoiceId}/preview-step`, {
        method: "POST",
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.details ?? payload.error ?? "Unable to preview step.");
      }
      setPreview(payload.preview);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to preview step.");
    } finally {
      setBusy(false);
    }
  }

  async function runAction(action: "approve" | "pause" | "paid") {
    try {
      setBusy(true);
      setError(null);
      const url =
        action === "approve"
          ? `/api/escalations/${invoiceId}/approve-step`
          : action === "pause"
            ? `/api/escalations/${invoiceId}/pause`
            : `/api/escalations/${invoiceId}/mark-paid`;

      const response = await fetch(url, {
        method: "POST",
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.details ?? payload.error ?? "Action failed.");
      }

      setFlash(
        action === "approve"
          ? "Step approved and queued."
          : action === "pause"
            ? "Escalation paused."
            : "Invoice marked paid.",
      );
      await loadDetail();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function generatePacket() {
    try {
      setBusy(true);
      setError(null);
      const response = await fetch(`/api/legal-packets/${invoiceId}/generate`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ jurisdiction }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.details ?? payload.error ?? "Unable to generate packet.");
      }

      setFlash("Legal packet generated.");
      await loadDetail();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to generate packet.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="app-shell min-h-screen py-8">
        <p className="text-sm text-[var(--color-ink-muted)]">Loading invoice...</p>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="app-shell min-h-screen py-8">
        <p className="text-sm text-rose-700">Invoice not found.</p>
        <Link href="/dashboard" className="button-soft mt-3 inline-flex px-4 py-2 text-sm">
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="app-shell min-h-screen py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/dashboard" className="text-xs uppercase tracking-[0.16em] text-[var(--color-ink-muted)]">
            Back to queue
          </Link>
          <h1 className="mt-1 text-3xl text-[var(--color-ink-strong)]">
            Invoice {detail.invoice.invoiceNumber}
          </h1>
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">{detail.client.name}</p>
        </div>
        <SiteNav />
      </header>

      {flash ? (
        <p className="mb-4 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-700">
          {flash}
        </p>
      ) : null}
      {error ? (
        <p className="mb-4 rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <section className="mb-6 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="panel p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl text-[var(--color-ink-strong)]">Invoice summary</h2>
            <StatusPill status={detail.invoice.status} />
          </div>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-[0.12em] text-[var(--color-ink-muted)]">Amount</dt>
              <dd className="text-lg font-semibold text-[var(--color-ink-strong)]">
                {formatCurrency(detail.invoice.amountCents, detail.invoice.currency)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.12em] text-[var(--color-ink-muted)]">Due date</dt>
              <dd className="text-lg font-semibold text-[var(--color-ink-strong)]">{detail.invoice.dueDate}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.12em] text-[var(--color-ink-muted)]">Escalation state</dt>
              <dd className="text-lg font-semibold text-[var(--color-ink-strong)]">
                {detail.escalationRun?.state ?? "not started"}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.12em] text-[var(--color-ink-muted)]">Current stage</dt>
              <dd className="text-lg font-semibold text-[var(--color-ink-strong)]">
                {detail.escalationRun?.currentStage
                  ? STAGE_LABEL[detail.escalationRun.currentStage as keyof typeof STAGE_LABEL]
                  : "none"}
              </dd>
            </div>
          </dl>
          {detail.invoice.notes ? (
            <p className="mt-3 rounded-xl border border-[var(--color-border)] bg-white p-3 text-sm text-[var(--color-ink)]">
              {detail.invoice.notes}
            </p>
          ) : null}
        </div>

        <div className="panel p-5">
          <h2 className="text-xl text-[var(--color-ink-strong)]">Actions</h2>
          <div className="mt-3 flex flex-col gap-2">
            <button className="button-soft px-4 py-2 text-sm" onClick={requestPreview} disabled={busy}>
              Preview next step
            </button>
            <button className="button-primary px-4 py-2 text-sm" onClick={() => runAction("approve")} disabled={busy}>
              Approve next step
            </button>
            <button className="button-soft px-4 py-2 text-sm" onClick={() => runAction("pause")} disabled={busy}>
              Pause escalation
            </button>
            <button className="button-soft px-4 py-2 text-sm" onClick={() => runAction("paid")} disabled={busy}>
              Mark paid
            </button>
          </div>

          <div className="mt-5 border-t border-[var(--color-border)] pt-4">
            <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--color-ink-muted)]">
              Small-claims packet
            </h3>
            <input
              className="input-base mt-2"
              value={jurisdiction}
              onChange={(event) => setJurisdiction(event.target.value)}
            />
            <button className="button-soft mt-2 px-4 py-2 text-sm" onClick={generatePacket} disabled={busy}>
              Generate packet
            </button>
          </div>
        </div>
      </section>

      {preview ? (
        <section className="panel mb-6 p-5">
          <h2 className="text-xl text-[var(--color-ink-strong)]">Preview</h2>
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
            {STAGE_LABEL[preview.stage]} · suggested send {preview.recommendedSendAt}
          </p>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <article className="rounded-xl border border-[var(--color-border)] bg-white p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-[var(--color-ink-muted)]">Email</p>
              <pre className="mt-2 whitespace-pre-wrap text-sm text-[var(--color-ink)]">
                {preview.emailBody ?? "No email contact available."}
              </pre>
            </article>
            <article className="rounded-xl border border-[var(--color-border)] bg-white p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-[var(--color-ink-muted)]">SMS</p>
              <pre className="mt-2 whitespace-pre-wrap text-sm text-[var(--color-ink)]">
                {preview.smsBody ?? "No phone contact available."}
              </pre>
            </article>
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="panel p-5">
          <h2 className="text-xl text-[var(--color-ink-strong)]">Timeline events</h2>
          {detail.events.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--color-ink-muted)]">No message events yet.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {detail.events.map((event) => (
                <li key={event.id} className="rounded-xl border border-[var(--color-border)] bg-white p-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-[var(--color-ink-muted)]">
                    {event.direction} · {event.channel} · {event.deliveryState ?? "pending"}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--color-ink)]">{event.body}</p>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="panel p-5">
          <h2 className="text-xl text-[var(--color-ink-strong)]">Step log</h2>
          {detail.steps.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--color-ink-muted)]">No steps created yet.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {detail.steps.map((step) => (
                <li key={step.id} className="rounded-xl border border-[var(--color-border)] bg-white p-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-[var(--color-ink-muted)]">
                    {STAGE_LABEL[step.stage]} · {step.channel} · {step.status}
                  </p>
                  <p className="mt-1 text-sm text-[var(--color-ink)]">{step.previewBody}</p>
                </li>
              ))}
            </ul>
          )}

          {detail.legalPacket ? (
            <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-white p-3">
              <p className="text-xs uppercase tracking-[0.12em] text-[var(--color-ink-muted)]">
                Legal packet · {detail.legalPacket.jurisdiction}
              </p>
              <pre className="mt-2 whitespace-pre-wrap text-xs text-[var(--color-ink)]">
                {detail.legalPacket.content}
              </pre>
            </div>
          ) : null}
        </article>
      </section>
    </div>
  );
}
