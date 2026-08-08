import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

const tones = {
  info: {
    box: "border-line bg-surface-sunken text-fg",
    icon: "text-fg-muted",
    Icon: Info,
    role: "status",
  },
  success: {
    box: "border-success/25 bg-success-soft text-success-fg",
    icon: "text-success",
    Icon: CheckCircle2,
    role: "status",
  },
  warning: {
    box: "border-warning/30 bg-warning-soft text-warning-fg",
    icon: "text-warning",
    Icon: AlertTriangle,
    role: "status",
  },
  error: {
    box: "border-danger/30 bg-danger-soft text-danger-fg",
    icon: "text-danger",
    Icon: XCircle,
    role: "alert",
  },
} as const;

export type AlertTone = keyof typeof tones;

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: AlertTone;
  title?: string;
  children?: ReactNode;
  className?: string;
}) {
  const { box, icon, Icon, role } = tones[tone];
  return (
    <div
      role={role}
      className={cn("flex gap-3 rounded-lg border px-4 py-3 text-sm", box, className)}
    >
      <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", icon)} />
      <div className="min-w-0 flex-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? (
          <div className={cn("[&_a]:font-medium [&_a]:underline [&_a]:underline-offset-4", title && "mt-1")}>
            {children}
          </div>
        ) : null}
      </div>
    </div>
  );
}
