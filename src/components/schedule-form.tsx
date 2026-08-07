"use client";

import Link from "next/link";
import { useActionState } from "react";

import type { FormState } from "@/app/actions/auth";
import { createRequestAction } from "@/app/actions/requests";
import { TIME_WINDOWS } from "@/lib/types";
import { SubmitButton } from "./submit-button";
import { Alert, Field, Input, Select, Textarea } from "./ui";

const initialState: FormState = {};

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
    <form action={formAction} className="flex flex-col gap-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.success ? (
        <Alert tone="success" title="Request submitted">
          <p>{state.success}</p>
          <p className="mt-2">
            <Link href="/dashboard" className="font-medium underline underline-offset-4">
              View your requests
            </Link>
          </p>
        </Alert>
      ) : null}

      <fieldset disabled={disabled} className="flex flex-col gap-4">
        <Field label="What do you need?" htmlFor="type" error={errors.type}>
          <Select
            id="type"
            name="type"
            required
            defaultValue={values.type || "pickup"}
            invalid={Boolean(errors.type)}
          >
            <option value="pickup">Pickup — collect my laundry</option>
            <option value="dropoff">Drop-off — return my clean laundry</option>
          </Select>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Date"
            htmlFor="scheduledDate"
            error={errors.scheduledDate}
          >
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

          <Field
            label="Time window"
            htmlFor="timeWindow"
            error={errors.timeWindow}
          >
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

        <SubmitButton pendingLabel="Submitting…" className="sm:self-start">
          Submit request
        </SubmitButton>
      </fieldset>
    </form>
  );
}
