import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-line-strong bg-surface/50 px-6 py-14 text-center">
      {Icon ? (
        <span className="mb-3 flex size-10 items-center justify-center rounded-full bg-surface-sunken text-fg-subtle">
          <Icon aria-hidden className="size-5" />
        </span>
      ) : null}
      <p className="font-medium text-fg">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-fg-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
