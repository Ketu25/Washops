"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";

/**
 * Highlights the section you are in. Client-side because it needs the current
 * path; kept separate so the header itself stays a Server Component and can
 * keep reading the session directly.
 */
export function NavLinks({
  links,
}: {
  links: Array<{ href: string; label: string }>;
}) {
  const pathname = usePathname();
  if (links.length === 0) return <div className="flex-1" />;

  return (
    <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
      {links.map((link) => {
        // Exact match only: /dashboard must not stay lit on /dashboard/profile,
        // which is where a naive startsWith check goes wrong.
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-surface-sunken text-fg"
                : "text-fg-muted hover:bg-surface-sunken/60 hover:text-fg",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
