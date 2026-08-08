import { ChevronDown } from "lucide-react";
import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";
import { controlClasses } from "./field";

/**
 * A styled NATIVE select, deliberately — not a Radix listbox.
 *
 * On phones the native control opens the OS picker, which is faster and more
 * accessible than any custom menu, and it needs no JavaScript to work. The
 * only thing wrong with a native select is its chrome, and `appearance: none`
 * plus our own chevron fixes exactly that.
 */
export function Select({
  className,
  invalid,
  children,
  ...props
}: ComponentProps<"select"> & { invalid?: boolean }) {
  return (
    <div className="relative">
      <select
        aria-invalid={invalid || undefined}
        className={cn(controlClasses, "h-9 cursor-pointer pr-9", className)}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle"
      />
    </div>
  );
}
