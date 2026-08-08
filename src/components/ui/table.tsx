import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

/**
 * Wide tables scroll inside their own container rather than pushing the page
 * sideways — the alternative is a horizontal scrollbar on <body>, which makes
 * every other element on the page drift.
 */
export function TableWrap({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "w-full overflow-x-auto rounded-xl border border-line bg-surface shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

export function Table({ className, ...props }: ComponentProps<"table">) {
  return (
    <table
      className={cn("w-full caption-bottom border-collapse text-sm", className)}
      {...props}
    />
  );
}

export function THead({ className, ...props }: ComponentProps<"thead">) {
  return (
    <thead
      className={cn("border-b border-line bg-surface-sunken/60", className)}
      {...props}
    />
  );
}

export function TBody({ className, ...props }: ComponentProps<"tbody">) {
  return <tbody className={cn("divide-y divide-line", className)} {...props} />;
}

export function TR({ className, ...props }: ComponentProps<"tr">) {
  return (
    <tr
      className={cn("transition-colors hover:bg-surface-sunken/50", className)}
      {...props}
    />
  );
}

export function TH({ className, ...props }: ComponentProps<"th">) {
  return (
    <th
      scope="col"
      className={cn(
        "px-4 py-2.5 text-left text-2xs font-semibold uppercase tracking-wider text-fg-subtle",
        className,
      )}
      {...props}
    />
  );
}

export function TD({ className, ...props }: ComponentProps<"td">) {
  return <td className={cn("px-4 py-3 align-top text-fg", className)} {...props} />;
}
