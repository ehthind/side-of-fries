"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_WORKSPACE_SLUG } from "@/lib/constants";

const steps = [
  "Workspace",
  "Brand",
  "Invoices",
  "Escalation",
  "Review",
] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [workspaceName, setWorkspaceName] = useState("Acorn Creative Studio");
  const [workspaceSlug, setWorkspaceSlug] = useState(DEFAULT_WORKSPACE_SLUG);
  const [senderName, setSenderName] = useState("Sam Rivera");
  const [csv, setCsv] = useState(
    "clientName,clientEmail,invoiceNumber,amount,dueDate\nNorth Ridge Labs,accounts@northridge.example,NR-1043,2600.00,2026-01-30",
  );
  const [sendEmail, setSendEmail] = useState(true);
  const [sendSms, setSendSms] = useState(true);
  const [daysBetween, setDaysBetween] = useState(4);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const progress = useMemo(
    () => Math.round(((index + 1) / steps.length) * 100),
    [index],
  );

  const next = () => setIndex((value) => Math.min(steps.length - 1, value + 1));
  const previous = () => setIndex((value) => Math.max(0, value - 1));

  async function finishOnboarding() {
    try {
      setIsSubmitting(true);
      setError(null);

      window.localStorage.setItem(
        "invoice-copilot-settings",
        JSON.stringify({
          workspaceName,
          workspaceSlug,
          senderName,
          sendEmail,
          sendSms,
          daysBetween,
        }),
      );

      if (csv.trim()) {
        await fetch("/api/invoices/import-csv", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            workspaceSlug,
            csv,
          }),
        });
      }

      router.push(`/dashboard?workspaceSlug=${encodeURIComponent(workspaceSlug)}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to finish onboarding.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="app-shell min-h-screen py-8">
      <header className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-ink-muted)]">
            Setup wizard
          </p>
          <h1 className="text-3xl text-[var(--color-ink-strong)]">
            Launch your recovery workflow in 5 steps
          </h1>
        </div>
        <p className="text-sm text-[var(--color-ink-muted)]">Step {index + 1} of 5</p>
      </header>

      <section className="panel p-6 md:p-8">
        <div className="mb-6">
          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-accent-soft)]">
            <div
              className="h-full rounded-full bg-[var(--color-ink-strong)] transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-[1fr_2fr]">
          <ul className="space-y-2">
            {steps.map((step, stepIndex) => {
              const active = stepIndex === index;
              const complete = stepIndex < index;
              return (
                <li
                  key={step}
                  className={`rounded-xl border px-3 py-2 text-sm ${
                    active
                      ? "border-[var(--color-ink-strong)] bg-white"
                      : complete
                        ? "border-[var(--color-border)] bg-[var(--color-accent-soft)]"
                        : "border-[var(--color-border)] bg-transparent"
                  }`}
                >
                  {step}
                </li>
              );
            })}
          </ul>

          <div className="space-y-4">
            {index === 0 ? (
              <>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium">Workspace name</span>
                  <input
                    className="input-base"
                    value={workspaceName}
                    onChange={(event) => setWorkspaceName(event.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium">Workspace slug</span>
                  <input
                    className="input-base"
                    value={workspaceSlug}
                    onChange={(event) => setWorkspaceSlug(event.target.value.toLowerCase().replace(/\s+/g, "-"))}
                  />
                </label>
              </>
            ) : null}

            {index === 1 ? (
              <>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium">Sender display name</span>
                  <input
                    className="input-base"
                    value={senderName}
                    onChange={(event) => setSenderName(event.target.value)}
                  />
                </label>
                <p className="rounded-xl border border-[var(--color-border)] bg-white p-3 text-sm text-[var(--color-ink-muted)]">
                  This name appears in escalation message signatures and legal packet headers.
                </p>
              </>
            ) : null}

            {index === 2 ? (
              <>
                <p className="text-sm text-[var(--color-ink-muted)]">
                  Paste CSV now or skip and add invoices from the dashboard.
                </p>
                <textarea
                  className="input-base min-h-48 font-mono text-xs"
                  value={csv}
                  onChange={(event) => setCsv(event.target.value)}
                />
                <p className="text-xs text-[var(--color-ink-muted)]">
                  Required columns: `clientName`, `invoiceNumber`, `amount` or `amountCents`, `dueDate`.
                </p>
              </>
            ) : null}

            {index === 3 ? (
              <>
                <label className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-white p-3">
                  <span className="text-sm font-medium">Enable email escalation</span>
                  <input
                    type="checkbox"
                    checked={sendEmail}
                    onChange={(event) => setSendEmail(event.target.checked)}
                  />
                </label>
                <label className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-white p-3">
                  <span className="text-sm font-medium">Enable SMS escalation</span>
                  <input
                    type="checkbox"
                    checked={sendSms}
                    onChange={(event) => setSendSms(event.target.checked)}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium">Days between steps</span>
                  <input
                    className="input-base"
                    type="number"
                    min={1}
                    max={30}
                    value={daysBetween}
                    onChange={(event) => setDaysBetween(Number(event.target.value))}
                  />
                </label>
              </>
            ) : null}

            {index === 4 ? (
              <div className="space-y-3 rounded-2xl border border-[var(--color-border)] bg-white p-4 text-sm">
                <p>
                  <strong>Workspace:</strong> {workspaceName} ({workspaceSlug})
                </p>
                <p>
                  <strong>Sender:</strong> {senderName}
                </p>
                <p>
                  <strong>Channels:</strong> {sendEmail ? "Email" : ""}
                  {sendEmail && sendSms ? " + " : ""}
                  {sendSms ? "SMS" : ""}
                </p>
                <p>
                  <strong>Escalation cadence:</strong> every {daysBetween} day(s)
                </p>
                <p className="text-xs text-[var(--color-ink-muted)]">
                  Default mode remains approval-gated for every escalation step.
                </p>
              </div>
            ) : null}

            {error ? (
              <p className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700">
                {error}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <button className="button-soft px-5 py-2.5" onClick={previous} disabled={index === 0}>
            Back
          </button>
          {index < steps.length - 1 ? (
            <button className="button-primary px-5 py-2.5" onClick={next}>
              Continue
            </button>
          ) : (
            <button
              className="button-primary px-5 py-2.5"
              onClick={finishOnboarding}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Finishing..." : "Launch dashboard"}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
