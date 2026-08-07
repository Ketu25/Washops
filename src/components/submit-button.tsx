"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { cn } from "./ui";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const variants: Record<Variant, string> = {
  primary:
    "bg-brand text-white hover:bg-brand-strong focus-visible:outline-brand",
  secondary:
    "border border-line bg-surface hover:bg-background focus-visible:outline-brand",
  danger:
    "border border-red-300 bg-surface text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/50",
  ghost: "text-muted hover:text-foreground underline underline-offset-4",
};

/**
 * Submit button that disables itself while its own form is in flight.
 *
 * This is the front line against double submissions — a customer
 * double-clicking "Schedule" would otherwise fire two identical requests.
 * The partial unique index in Postgres is the backstop for when it does
 * happen anyway (two tabs, a slow network, a replayed request).
 */
export function SubmitButton({
  children,
  variant = "primary",
  pendingLabel,
  className,
  confirm,
  name,
  value,
}: {
  children: ReactNode;
  variant?: Variant;
  pendingLabel?: string;
  className?: string;
  confirm?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      onClick={
        confirm
          ? (event) => {
              if (!window.confirm(confirm)) event.preventDefault();
            }
          : undefined
      }
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium",
        "transition disabled:cursor-not-allowed disabled:opacity-60",
        variants[variant],
        className,
      )}
    >
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
