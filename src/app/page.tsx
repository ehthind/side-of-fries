import Link from "next/link";
import { SiteNav } from "@/components/site-nav";

export default function Home() {
  return (
    <div className="app-shell flex min-h-screen flex-col gap-8 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-ink-muted)]">
            Invoice Recovery Copilot
          </p>
          <h1 className="mt-1 text-2xl text-[var(--color-ink-strong)]">
            Recover overdue invoices without chasing clients manually
          </h1>
        </div>
        <SiteNav />
      </header>

      <section className="panel grid gap-8 p-6 md:grid-cols-2 md:p-10">
        <div className="space-y-4">
          <p className="inline-flex rounded-full border border-[var(--color-border)] bg-[var(--color-accent-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-ink-strong)]">
            Guided escalation
          </p>
          <h2 className="text-4xl leading-tight text-[var(--color-ink-strong)]">
            Polite nudge to small-claims prep in one timeline
          </h2>
          <p className="max-w-xl text-[var(--color-ink)]">
            Import invoices, review staged messages, approve sends, and keep a
            complete audit trail across email and SMS. Designed for freelancers
            and tiny teams who need recoveries without legal chaos.
          </p>
          <div className="flex flex-wrap gap-3 pt-3">
            <Link href="/onboarding" className="button-primary px-5 py-2.5">
              Start onboarding
            </Link>
            <Link href="/dashboard" className="button-soft px-5 py-2.5">
              Open dashboard
            </Link>
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--color-border)] bg-white/75 p-5">
          <p className="text-sm font-medium text-[var(--color-ink-muted)]">
            Why this exists
          </p>
          <ul className="mt-4 space-y-4 text-sm text-[var(--color-ink)]">
            <li className="rounded-xl border border-[var(--color-border)] bg-white p-4">
              Built for freelancers losing revenue to clients who ghost
              invoices.
            </li>
            <li className="rounded-xl border border-[var(--color-border)] bg-white p-4">
              Approval-gated automation keeps legal risk controlled.
            </li>
            <li className="rounded-xl border border-[var(--color-border)] bg-white p-4">
              Supabase and Vercel architecture supports fast launch and scale.
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}
