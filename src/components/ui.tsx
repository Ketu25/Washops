import type { ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import type { InputHTMLAttributes } from "react";

import type { RequestStatus, RequestType } from "@/lib/types";

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-line bg-surface p-6 shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PageHeading({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex gap-2">{actions}</div> : null}
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  const hintId = hint ? `${htmlFor}-hint` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && !error ? (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const controlClasses =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none " +
  "transition focus:border-brand focus:ring-2 focus:ring-brand/25 " +
  "disabled:cursor-not-allowed disabled:opacity-60";

export function Input({
  className,
  invalid,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      {...props}
      aria-invalid={invalid || undefined}
      className={cn(
        controlClasses,
        invalid && "border-red-500 focus:border-red-500 focus:ring-red-500/25",
        className,
      )}
    />
  );
}

export function Select({
  className,
  invalid,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select
      {...props}
      aria-invalid={invalid || undefined}
      className={cn(
        controlClasses,
        invalid && "border-red-500 focus:border-red-500 focus:ring-red-500/25",
        className,
      )}
    >
      {children}
    </select>
  );
}

export function Textarea({
  className,
  invalid,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      {...props}
      aria-invalid={invalid || undefined}
      className={cn(
        controlClasses,
        "min-h-24 resize-y",
        invalid && "border-red-500 focus:border-red-500 focus:ring-red-500/25",
        className,
      )}
    />
  );
}

type AlertTone = "error" | "success" | "info" | "warning";

const alertTones: Record<AlertTone, string> = {
  error:
    "border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200",
  success:
    "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200",
  info: "border-line bg-background text-foreground",
  warning:
    "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
};

export function Alert({
  tone,
  title,
  children,
}: {
  tone: AlertTone;
  title?: string;
  children: ReactNode;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("rounded-lg border px-4 py-3 text-sm", alertTones[tone])}
    >
      {title ? <p className="font-semibold">{title}</p> : null}
      <div className={title ? "mt-0.5" : undefined}>{children}</div>
    </div>
  );
}

const statusTones: Record<RequestStatus, string> = {
  pending:
    "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  planned: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  completed:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  cancelled:
    "bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
};

export function StatusBadge({ status }: { status: RequestStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
        statusTones[status],
      )}
    >
      {status}
    </span>
  );
}

export function TypeBadge({ type }: { type: RequestType }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        type === "pickup"
          ? "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200"
          : "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200",
      )}
    >
      {type === "pickup" ? "Pickup" : "Drop-off"}
    </span>
  );
}

export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-line px-6 py-12 text-center">
      <p className="font-medium">{title}</p>
      {children ? <div className="mt-1 text-sm text-muted">{children}</div> : null}
    </div>
  );
}
