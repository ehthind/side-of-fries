import { addDays, differenceInCalendarDays, format } from "date-fns";

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export function formatCurrency(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function toIsoDate(value: Date): string {
  return format(value, "yyyy-MM-dd");
}

export function computeDaysOverdue(dueDate: string): number {
  return Math.max(0, differenceInCalendarDays(new Date(), new Date(dueDate)));
}

export function defaultTargetDate(days = 5): string {
  return toIsoDate(addDays(new Date(), days));
}

export function titleCase(value: string): string {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((chunk) => chunk[0].toUpperCase() + chunk.slice(1))
    .join(" ");
}

export function randomId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 12)}`;
}
