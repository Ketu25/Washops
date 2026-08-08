import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

const badgeVariants = cva(
  cn(
    "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full",
    "px-2.5 py-0.5 text-xs font-medium",
  ),
  {
    variants: {
      tone: {
        neutral: "bg-surface-sunken text-fg-muted",
        brand: "bg-brand-soft text-brand-fg",
        success: "bg-success-soft text-success-fg",
        warning: "bg-warning-soft text-warning-fg",
        danger: "bg-danger-soft text-danger-fg",
      },
      outline: {
        true: "border",
        false: "",
      },
    },
    defaultVariants: { tone: "neutral", outline: false },
  },
);

export function Badge({
  className,
  tone,
  outline,
  ...props
}: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span className={cn(badgeVariants({ tone, outline }), className)} {...props} />
  );
}

/** A small filled circle, for status that reads better as a dot than a pill. */
export function Dot({
  tone = "neutral",
  className,
}: {
  tone?: "neutral" | "brand" | "success" | "warning" | "danger";
  className?: string;
}) {
  const tones = {
    neutral: "bg-fg-subtle",
    brand: "bg-brand",
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-danger",
  } as const;
  return (
    <span
      aria-hidden
      className={cn("size-1.5 shrink-0 rounded-full", tones[tone], className)}
    />
  );
}
