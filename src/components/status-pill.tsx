import { cn } from "@/lib/utils";

const palette: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-800",
  in_recovery: "bg-amber-100 text-amber-900",
  paused: "bg-zinc-200 text-zinc-800",
  at_risk: "bg-sky-100 text-sky-800",
  new: "bg-violet-100 text-violet-700",
  closed_unresolved: "bg-rose-100 text-rose-800",
  default: "bg-zinc-100 text-zinc-700",
};

export function StatusPill({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide",
        palette[status] ?? palette.default,
        className,
      )}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
