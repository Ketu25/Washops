import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

const widths = {
  sm: "max-w-md",
  md: "max-w-2xl",
  lg: "max-w-5xl",
  xl: "max-w-6xl",
  full: "max-w-7xl",
} as const;

/** One place that owns page gutters, so every screen lines up. */
export function Container({
  size = "lg",
  className,
  ...props
}: ComponentProps<"div"> & { size?: keyof typeof widths }) {
  return (
    <div
      className={cn("mx-auto w-full px-4 sm:px-6", widths[size], className)}
      {...props}
    />
  );
}
