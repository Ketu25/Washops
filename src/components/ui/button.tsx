import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

const buttonVariants = cva(
  cn(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md",
    "font-medium transition-[background-color,border-color,color,box-shadow,transform]",
    "duration-150 ease-[var(--ease-out-quart)]",
    "disabled:pointer-events-none disabled:opacity-50",
    // Icons inside buttons should never be selectable or stretch the row.
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
    "active:translate-y-px",
  ),
  {
    variants: {
      variant: {
        primary:
          "bg-brand text-fg-on-brand shadow-xs hover:bg-brand-hover",
        secondary:
          "border border-line bg-surface text-fg shadow-xs hover:bg-surface-sunken hover:border-line-strong",
        ghost: "text-fg-muted hover:bg-surface-sunken hover:text-fg",
        danger:
          "border border-line bg-surface text-danger-fg shadow-xs hover:bg-danger-soft hover:border-danger/40",
        link: "text-brand-fg underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 px-3 text-xs [&_svg]:size-3.5",
        md: "h-9 px-3.5 text-sm [&_svg]:size-4",
        lg: "h-11 px-5 text-base [&_svg]:size-4",
        icon: "size-9 [&_svg]:size-4",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  // asChild lets a Link render with button styling without nesting an <a>
  // inside a <button>, which is invalid and breaks keyboard activation.
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { buttonVariants };
