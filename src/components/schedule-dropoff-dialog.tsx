"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowDownToLine } from "lucide-react";
import { useActionState, useState } from "react";

import type { FormState } from "@/app/actions/auth";
import { scheduleDropoffAction } from "@/app/actions/requests";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/lib/cn";
import { TIME_WINDOWS } from "@/lib/types";

const initialState: FormState = {};

/**
 * Books the return of a completed pickup.
 *
 * A dialog rather than a separate page: the admin is working a queue and the
 * decision is two fields long, so bouncing them out of the table and back
 * would lose their place in it.
 */
export function ScheduleDropoffDialog({
  pickupId,
  customerName,
  pickupDate,
  minDate,
  maxDate,
}: {
  pickupId: string;
  customerName: string;
  pickupDate: string;
  /** Today, or the pickup date if that is later — never return before collecting. */
  minDate: string;
  maxDate: string;
}) {
  const [state, formAction] = useActionState(scheduleDropoffAction, initialState);
  const [open, setOpen] = useState(false);
  const errors = state.fieldErrors ?? {};

  // No effect closes this on success. The action revalidates /admin, the row
  // re-renders as "Drop-off booked", and this trigger — and with it the
  // portalled dialog — unmounts. The success alert below covers the window
  // before that lands, and closing on click instead would hide a failure.

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <Button type="button" size="sm">
          <ArrowDownToLine aria-hidden />
          Schedule drop-off
        </Button>
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-[2px]",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2",
            "rounded-xl border border-line bg-surface p-6 shadow-lg",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          )}
        >
          <DialogPrimitive.Title className="text-base font-semibold text-fg">
            Schedule drop-off
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="mt-1.5 text-sm text-fg-muted">
            Returning {customerName}&rsquo;s laundry, collected {pickupDate}. They
            will see this on their dashboard straight away.
          </DialogPrimitive.Description>

          <form action={formAction} className="mt-5 flex flex-col gap-4">
            <input type="hidden" name="pickupId" value={pickupId} />

            {state.error ? <Alert tone="error">{state.error}</Alert> : null}
            {state.success ? <Alert tone="success">{state.success}</Alert> : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Date"
                htmlFor={`dropoff-date-${pickupId}`}
                error={errors.scheduledDate}
                required
              >
                <Input
                  id={`dropoff-date-${pickupId}`}
                  name="scheduledDate"
                  type="date"
                  required
                  min={minDate}
                  max={maxDate}
                  defaultValue={minDate}
                  invalid={Boolean(errors.scheduledDate)}
                />
              </Field>

              <Field
                label="Time window"
                htmlFor={`dropoff-window-${pickupId}`}
                error={errors.timeWindow}
                required
              >
                <Select
                  id={`dropoff-window-${pickupId}`}
                  name="timeWindow"
                  required
                  defaultValue={TIME_WINDOWS[0]}
                  invalid={Boolean(errors.timeWindow)}
                >
                  {TIME_WINDOWS.map((window) => (
                    <option key={window} value={window}>
                      {window}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field
              label="Notes"
              htmlFor={`dropoff-notes-${pickupId}`}
              error={errors.notes}
              hint="Optional — visible to the customer."
            >
              <Textarea
                id={`dropoff-notes-${pickupId}`}
                name="notes"
                maxLength={500}
                invalid={Boolean(errors.notes)}
                placeholder="Two bags, folded."
              />
            </Field>

            <div className="mt-1 flex justify-end gap-2">
              <DialogPrimitive.Close asChild>
                <Button type="button" variant="secondary" size="sm">
                  Cancel
                </Button>
              </DialogPrimitive.Close>
              <SubmitButton size="sm" pendingLabel="Scheduling…">
                Schedule drop-off
              </SubmitButton>
            </div>
          </form>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
