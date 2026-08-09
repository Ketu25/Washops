"use client";

import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";

import type { FormState } from "@/app/actions/auth";
import { createRequestAction } from "@/app/actions/requests";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { TIME_WINDOWS } from "@/lib/types";

const initialState: FormState = {};

/**
 * Books a PICKUP. There is no type selector any more: the customer asks us
 * to collect, and the return is scheduled by the laundromat once the laundry
 * is actually in the shop. The panel below says so, because otherwise the
 * absence of a drop-off option reads as a missing feature.
 */
export function ScheduleForm({
  minDate,
  maxDate,
  disabled,
}: {
  minDate: string;
  maxDate: string;
  disabled: boolean;
}) {
  const [state, formAction] = useActionState(createRequestAction, initialState);
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.success ? (
        <Alert tone="success" title="Pickup submitted">
          <p>{state.success}</p>
          <p className="mt-2">
            <Link href="/dashboard">View your requests</Link>
          </p>
        </Alert>
      ) : null}

      <fieldset disabled={disabled} className="flex flex-col gap-5">
        <div className="rounded-lg border border-line bg-surface-sunken/60 p-4">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-brand text-fg-on-brand">
              <ArrowUpFromLine aria-hidden className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-fg">
                We&rsquo;ll collect your laundry
              </p>
              <p className="mt-0.5 flex items-start gap-1.5 text-xs text-fg-muted">
                <ArrowDownToLine aria-hidden className="mt-0.5 size-3 shrink-0" />
                <span>
                  Once it&rsquo;s washed we book the return and it appears on
                  your dashboard — you don&rsquo;t need to schedule that.
                </span>
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date" htmlFor="scheduledDate" error={errors.scheduledDate} required>
            <Input
              id="scheduledDate"
              name="scheduledDate"
              type="date"
              required
              min={minDate}
              max={maxDate}
              defaultValue={values.scheduledDate || minDate}
              invalid={Boolean(errors.scheduledDate)}
            />
          </Field>

          <Field label="Time window" htmlFor="timeWindow" error={errors.timeWindow} required>
            <Select
              id="timeWindow"
              name="timeWindow"
              required
              defaultValue={values.timeWindow || TIME_WINDOWS[0]}
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
          label="Notes for our driver"
          htmlFor="notes"
          error={errors.notes}
          hint="Optional — gate codes, buzzer number, where to leave the bag."
        >
          <Textarea
            id="notes"
            name="notes"
            maxLength={500}
            defaultValue={values.notes}
            invalid={Boolean(errors.notes)}
            placeholder="Ring the bell for 4B. Bag will be by the door."
          />
        </Field>

        <SubmitButton size="lg" className="sm:self-start" pendingLabel="Submitting…">
          Request pickup
        </SubmitButton>
      </fieldset>
    </form>
  );
}
