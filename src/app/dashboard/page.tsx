"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SiteNav } from "@/components/site-nav";
import { StatCard } from "@/components/stat-card";
import { StatusPill } from "@/components/status-pill";
import { DEFAULT_WORKSPACE_SLUG } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";

type InvoiceItem = {
  invoice: {
    id: string;
    invoiceNumber: string;
    amountCents: number;
    currency: string;
    dueDate: string;
    status: string;
  };
  client: {
    name: string;
    primaryEmail?: string | null;
    primaryPhone?: string | null;
  };
  escalationRun: {
    state: string;
    currentStage?: string | null;
  } | null;
};

export default function DashboardPage() {
  const [workspaceSlug, setWorkspaceSlug] = useState(DEFAULT_WORKSPACE_SLUG);

  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [stats, setStats] = useState({
    totalOutstandingCents: 0,
    activeRecoveries: 0,
    awaitingApproval: 0,
    resolvedThisMonth: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const [newInvoice, setNewInvoice] = useState({
    clientName: "",
    clientEmail: "",
    clientPhone: "",
    invoiceNumber: "",
    amount: "",
    dueDate: "",
    notes: "",
  });

  const [csv, setCsv] = useState(
    "clientName,clientEmail,invoiceNumber,amount,dueDate\n",
  );

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [invoiceResponse, statsResponse] = await Promise.all([
        fetch(`/api/invoices?workspaceSlug=${encodeURIComponent(workspaceSlug)}`, {
          cache: "no-store",
        }),
        fetch(
          `/api/dashboard/stats?workspaceSlug=${encodeURIComponent(workspaceSlug)}`,
          {
            cache: "no-store",
          },
        ),
      ]);

      if (!invoiceResponse.ok) {
        const payload = await invoiceResponse.json();
        throw new Error(payload.details ?? payload.error ?? "Invoice fetch failed.");
      }

      if (!statsResponse.ok) {
        const payload = await statsResponse.json();
        throw new Error(payload.details ?? payload.error ?? "Stats fetch failed.");
      }

      const invoicePayload = await invoiceResponse.json();
      const statsPayload = await statsResponse.json();

      setItems(invoicePayload.invoices ?? []);
      setStats(statsPayload.stats);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load dashboard.");
    } finally {
      setLoading(false);
    }
  }, [workspaceSlug]);

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("workspaceSlug");
    if (fromUrl) {
      setWorkspaceSlug(fromUrl);
    }
  }, []);

  useEffect(() => {
    loadDashboard().catch(() => undefined);
  }, [loadDashboard]);

  const atRiskCount = useMemo(
    () => items.filter((item) => item.invoice.status === "at_risk").length,
    [items],
  );

  async function addInvoice() {
    try {
      setError(null);
      const amountNumeric = Number(newInvoice.amount);
      const response = await fetch("/api/invoices", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          workspaceSlug,
          clientName: newInvoice.clientName,
          clientEmail: newInvoice.clientEmail || undefined,
          clientPhone: newInvoice.clientPhone || undefined,
          invoiceNumber: newInvoice.invoiceNumber,
          amountCents: Math.round(amountNumeric * 100),
          currency: "USD",
          dueDate: newInvoice.dueDate,
          notes: newInvoice.notes || undefined,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.details ?? payload.error ?? "Unable to add invoice.");
      }

      setNewInvoice({
        clientName: "",
        clientEmail: "",
        clientPhone: "",
        invoiceNumber: "",
        amount: "",
        dueDate: "",
        notes: "",
      });
      setFlash("Invoice added to recovery queue.");
      await loadDashboard();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to add invoice.");
    }
  }

  async function importCsv() {
    try {
      setError(null);
      const response = await fetch("/api/invoices/import-csv", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          workspaceSlug,
          csv,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.details ?? payload.error ?? "CSV import failed.");
      }

      setFlash(`Imported ${payload.created} invoice(s).`);
      await loadDashboard();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "CSV import failed.");
    }
  }

  async function quickAction(invoiceId: string, action: "approve" | "pause" | "paid") {
    const url =
      action === "approve"
        ? `/api/escalations/${invoiceId}/approve-step`
        : action === "pause"
          ? `/api/escalations/${invoiceId}/pause`
          : `/api/escalations/${invoiceId}/mark-paid`;

    try {
      setError(null);
      const response = await fetch(url, {
        method: "POST",
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.details ?? payload.error ?? "Action failed.");
      }

      setFlash(
        action === "approve"
          ? "Escalation step approved."
          : action === "pause"
            ? "Escalation paused."
            : "Invoice marked paid.",
      );
      await loadDashboard();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Action failed.");
    }
  }

  return (
    <div className="app-shell min-h-screen py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-ink-muted)]">
            Workspace
          </p>
          <h1 className="text-3xl text-[var(--color-ink-strong)]">Recovery dashboard</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
            {workspaceSlug} · approval-gated escalation mode
          </p>
        </div>
        <SiteNav />
      </header>

      <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Outstanding"
          value={formatCurrency(stats.totalOutstandingCents)}
          hint="Unpaid balance"
        />
        <StatCard
          label="Active"
          value={stats.activeRecoveries}
          hint="In recovery"
        />
        <StatCard
          label="Awaiting approval"
          value={stats.awaitingApproval}
          hint="Needs your click"
        />
        <StatCard label="At risk" value={atRiskCount} hint="Past due, not started" />
      </section>

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

      <section className="mb-6 grid gap-4 lg:grid-cols-2">
        <div className="panel p-5">
          <h2 className="text-xl text-[var(--color-ink-strong)]">Add invoice</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input
              className="input-base"
              placeholder="Client name"
              value={newInvoice.clientName}
              onChange={(event) =>
                setNewInvoice((current) => ({ ...current, clientName: event.target.value }))
              }
            />
            <input
              className="input-base"
              placeholder="Client email"
              value={newInvoice.clientEmail}
              onChange={(event) =>
                setNewInvoice((current) => ({ ...current, clientEmail: event.target.value }))
              }
            />
            <input
              className="input-base"
              placeholder="Client phone"
              value={newInvoice.clientPhone}
              onChange={(event) =>
                setNewInvoice((current) => ({ ...current, clientPhone: event.target.value }))
              }
            />
            <input
              className="input-base"
              placeholder="Invoice number"
              value={newInvoice.invoiceNumber}
              onChange={(event) =>
                setNewInvoice((current) => ({ ...current, invoiceNumber: event.target.value }))
              }
            />
            <input
              className="input-base"
              placeholder="Amount (e.g. 1450.00)"
              value={newInvoice.amount}
              onChange={(event) =>
                setNewInvoice((current) => ({ ...current, amount: event.target.value }))
              }
            />
            <input
              type="date"
              className="input-base"
              value={newInvoice.dueDate}
              onChange={(event) =>
                setNewInvoice((current) => ({ ...current, dueDate: event.target.value }))
              }
            />
          </div>
          <textarea
            className="input-base mt-3 min-h-20"
            placeholder="Notes"
            value={newInvoice.notes}
            onChange={(event) =>
              setNewInvoice((current) => ({ ...current, notes: event.target.value }))
            }
          />
          <button className="button-primary mt-3 px-4 py-2" onClick={addInvoice}>
            Save invoice
          </button>
        </div>

        <div className="panel p-5">
          <h2 className="text-xl text-[var(--color-ink-strong)]">Bulk import CSV</h2>
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
            Supports `clientName`, `invoiceNumber`, `amount`, `dueDate` plus optional contact fields.
          </p>
          <textarea
            className="input-base mt-3 min-h-44 font-mono text-xs"
            value={csv}
            onChange={(event) => setCsv(event.target.value)}
          />
          <button className="button-soft mt-3 px-4 py-2" onClick={importCsv}>
            Import CSV
          </button>
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <h2 className="text-xl text-[var(--color-ink-strong)]">Recovery queue</h2>
          <button className="button-soft px-4 py-2 text-sm" onClick={() => loadDashboard()}>
            Refresh
          </button>
        </div>

        {loading ? (
          <p className="p-5 text-sm text-[var(--color-ink-muted)]">Loading invoices...</p>
        ) : items.length === 0 ? (
          <p className="p-5 text-sm text-[var(--color-ink-muted)]">No invoices yet. Add your first one above.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-white/70 text-left text-xs uppercase tracking-[0.16em] text-[var(--color-ink-muted)]">
                  <th className="px-4 py-3">Invoice</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Due</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.invoice.id} className="border-b border-[var(--color-border)]/70">
                    <td className="px-4 py-3 font-medium text-[var(--color-ink-strong)]">
                      <Link href={`/invoices/${item.invoice.id}`} className="underline-offset-4 hover:underline">
                        {item.invoice.invoiceNumber}
                      </Link>
                      <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
                        {item.escalationRun?.currentStage ?? "not started"}
                      </p>
                    </td>
                    <td className="px-4 py-3">{item.client.name}</td>
                    <td className="px-4 py-3">
                      {formatCurrency(item.invoice.amountCents, item.invoice.currency)}
                    </td>
                    <td className="px-4 py-3">{item.invoice.dueDate}</td>
                    <td className="px-4 py-3">
                      <StatusPill status={item.invoice.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="button-soft px-3 py-1.5 text-xs"
                          onClick={() => quickAction(item.invoice.id, "approve")}
                        >
                          Approve step
                        </button>
                        <button
                          className="button-soft px-3 py-1.5 text-xs"
                          onClick={() => quickAction(item.invoice.id, "pause")}
                        >
                          Pause
                        </button>
                        <button
                          className="button-soft px-3 py-1.5 text-xs"
                          onClick={() => quickAction(item.invoice.id, "paid")}
                        >
                          Mark paid
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
