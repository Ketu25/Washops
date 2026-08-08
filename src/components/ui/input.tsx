import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";
import { controlClasses } from "./field";

export function Input({
  className,
  invalid,
  ...props
}: ComponentProps<"input"> & { invalid?: boolean }) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(controlClasses, "h-9", className)}
      {...props}
    />
  );
}

export function Textarea({
  className,
  invalid,
  ...props
}: ComponentProps<"textarea"> & { invalid?: boolean }) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={cn(controlClasses, "min-h-24 resize-y py-2 leading-relaxed", className)}
      {...props}
    />
  );
}
