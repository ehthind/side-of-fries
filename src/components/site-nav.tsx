"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const items = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/onboarding", label: "Onboarding" },
  { href: "/templates", label: "Templates" },
];

export function SiteNav() {
  const pathname = usePathname();

  return (
    <nav className="rounded-full border border-[var(--color-border)] bg-white/70 p-1 backdrop-blur-md">
      <ul className="flex items-center gap-1">
        {items.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "inline-flex rounded-full px-3 py-1.5 text-sm font-medium transition",
                  isActive
                    ? "bg-[var(--color-accent)] text-[var(--color-ink-strong)]"
                    : "text-[var(--color-ink)] hover:bg-white",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
