import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge class names, with later Tailwind utilities beating earlier ones.
 *
 * Plain concatenation leaves both `px-3` and `px-6` in the class list and
 * lets source order in the stylesheet decide — so a component's prop would
 * sometimes win and sometimes not. twMerge resolves conflicts by utility
 * group, which is what makes `className` a reliable override everywhere.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
