"use client";

import { Loader2 } from "lucide-react";
import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "./button";

/**
 * Submit button that disables itself while its own form is in flight.
 *
 * This is the front line against double submissions — a customer
 * double-clicking "Schedule" would otherwise fire two identical requests. The
 * partial unique index in Postgres is the backstop for when it happens anyway
 * (two tabs, a slow network, a replayed request).
 */
export function SubmitButton({
  children,
  pendingLabel,
  ...props
}: ComponentProps<typeof Button> & { pendingLabel?: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} {...props}>
      {pending ? <Loader2 aria-hidden className="animate-spin" /> : null}
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}
