"use client";

import * as LabelPrimitive from "@radix-ui/react-label";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/cn";

/** Shared control chrome, so an input, select and textarea line up exactly. */
export const controlClasses = cn(
  "w-full rounded-md border border-line bg-surface text-fg",
  "px-3 text-sm shadow-xs outline-none transition-[border-color,box-shadow] duration-150",
  "placeholder:text-fg-subtle",
  "hover:border-line-strong",
  "focus:border-brand focus:ring-[3px] focus:ring-brand/15 focus-visible:outline-none",
  "disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:opacity-60",
  "aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/15",
);

export function Label({
  className,
  ...props
}: ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      className={cn(
        "text-sm font-medium text-fg select-none",
        "peer-disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Label + control + help text + error, wired together.
 *
 * The hint and error are linked with aria-describedby rather than left as
 * loose text, so a screen reader announces the requirement and the failure
 * with the field instead of stranding them in the page.
 */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required ? (
          <span aria-hidden className="ml-0.5 text-danger-fg">
            *
          </span>
        ) : null}
      </Label>
      {children}
      {hint && !error ? (
        <p id={`${htmlFor}-hint`} className="text-xs text-fg-subtle">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p
          id={`${htmlFor}-error`}
          className="text-xs font-medium text-danger-fg"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function describedBy(id: string, hint?: string, error?: string) {
  const parts = [error ? `${id}-error` : null, hint && !error ? `${id}-hint` : null];
  const joined = parts.filter(Boolean).join(" ");
  return joined || undefined;
}
