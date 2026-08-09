import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/cn";

/**
 * A dashboard count that doubles as a filter.
 *
 * The number is the point, so it gets the visual weight and tabular figures —
 * proportional digits make a row of counts look ragged as they change.
 *
 * When `href` is given the whole card becomes a link. It renders as an <a>
 * rather than a div with an onClick so that middle-click, cmd-click and
 * "open in new tab" all work, and so the filter is shareable — an operator
 * can send "today's pending pickups" to a driver as a URL.
 */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
  href,
  active = false,
}: {
  label: string;
  value: number | string;
  hint?: string;
  icon?: LucideIcon;
  tone?: "neutral" | "brand" | "warning" | "success";
  href?: string;
  active?: boolean;
}) {
  const tones = {
    neutral: "text-fg-subtle bg-surface-sunken",
    brand: "text-brand-fg bg-brand-soft",
    warning: "text-warning-fg bg-warning-soft",
    success: "text-success-fg bg-success-soft",
  } as const;

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-fg-muted">{label}</p>
        {Icon ? (
          <span
            className={cn(
              "flex size-7 items-center justify-center rounded-md transition-colors",
              tones[tone],
            )}
          >
            <Icon aria-hidden className="size-4" />
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-fg">
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-fg-subtle">{hint}</p> : null}
    </>
  );

  const base = "rounded-xl border bg-surface p-4 shadow-sm transition-all";

  if (!href) {
    return <div className={cn(base, "border-line")}>{body}</div>;
  }

  return (
    <Link
      href={href}
      // Announces which filter is applied, rather than leaving the highlight
      // as a purely visual cue.
      aria-current={active ? "true" : undefined}
      className={cn(
        base,
        "block text-left hover:-translate-y-px hover:border-line-strong hover:shadow-md",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        active
          ? "border-brand ring-[3px] ring-brand/15"
          : "border-line",
      )}
    >
      {body}
      <span className="sr-only">
        {active ? " — filter applied, select again to clear" : " — filter the queue"}
      </span>
    </Link>
  );
}
