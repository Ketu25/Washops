import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/cn";

/**
 * The number is the point, so it gets the visual weight and tabular figures —
 * proportional digits make a row of counts look ragged as they change.
 */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: number | string;
  hint?: string;
  icon?: LucideIcon;
  tone?: "neutral" | "brand" | "warning" | "success";
}) {
  const tones = {
    neutral: "text-fg-subtle bg-surface-sunken",
    brand: "text-brand-fg bg-brand-soft",
    warning: "text-warning-fg bg-warning-soft",
    success: "text-success-fg bg-success-soft",
  } as const;

  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-fg-muted">{label}</p>
        {Icon ? (
          <span
            className={cn(
              "flex size-7 items-center justify-center rounded-md",
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
    </div>
  );
}
