import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: string | number;
  hint?: string;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white/90 p-5 shadow-sm",
        className,
      )}
    >
      <div className="absolute -right-10 -top-10 h-24 w-24 rounded-full bg-[var(--color-accent-soft)]" />
      <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-ink-muted)]">
        {label}
      </p>
      <p className="relative mt-2 text-3xl font-semibold text-[var(--color-ink-strong)]">
        {value}
      </p>
      {hint ? (
        <p className="relative mt-1 text-sm text-[var(--color-ink-muted)]">{hint}</p>
      ) : null}
    </article>
  );
}
