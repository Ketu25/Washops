"use client";

import { ArrowDownToLine, ArrowUpFromLine, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";

import type { FormState } from "@/app/actions/auth";
import { createRequestAction } from "@/app/actions/requests";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/lib/cn";
import { TIME_WINDOWS, type RequestType } from "@/lib/types";

const initialState: FormState = {};

const CHOICES: Array<{
  value: RequestType;
  title: string;
  body: string;
  icon: typeof ArrowUpFromLine;
}> = [
  {
    value: "pickup",
    title: "Pickup",
    body: "Collect my laundry",
    icon: ArrowUpFromLine,
  },
  {
    value: "dropoff",
    title: "Drop-off",
    body: "Return my clean laundry",
    icon: ArrowDownToLine,
  },
];

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
  const [type, setType] = useState<RequestType>(
    (values.type as RequestType) || "pickup",
  );

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.success ? (
        <Alert tone="success" title="Request submitted">
          <p>{state.success}</p>
          <p className="mt-2">
            <Link href="/dashboard">View your requests</Link>
          </p>
        </Alert>
      ) : null}

      <fieldset disabled={disabled} className="flex flex-col gap-5">
        {/*
          Two large radio cards rather than a dropdown: there are exactly two
          choices, it is the most consequential field on the form, and the
          direction of travel is easier to read as an icon than as words.
          A visually-hidden native radio keeps it keyboard- and
          screen-reader-native.
        */}
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium text-fg">
            What do you need?
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {CHOICES.map((choice) => {
              const active = type === choice.value;
              return (
                <label
                  key={choice.value}
                  className={cn(
                    "relative flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-all",
                    "hover:border-line-strong",
                    active
                      ? "border-brand bg-brand-soft/50 ring-[3px] ring-brand/15"
                      : "border-line bg-surface",
                    "has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-brand/30",
                  )}
                >
                  <input
                    // Stable ids so tests and labels can target a specific
                    // choice; the visible card is the label for it.
                    id={`type-${choice.value}`}
                    type="radio"
                    name="type"
                    value={choice.value}
                    checked={active}
                    onChange={() => setType(choice.value)}
                    className="sr-only"
                  />
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-md",
                      active
                        ? "bg-brand text-fg-on-brand"
                        : "bg-surface-sunken text-fg-subtle",
                    )}
                  >
                    <choice.icon aria-hidden className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-fg">
                      {choice.title}
                    </span>
                    <span className="block text-xs text-fg-muted">{choice.body}</span>
                  </span>
                  {active ? (
                    <CheckCircle2
                      aria-hidden
                      className="absolute right-3 top-3 size-4 text-brand"
                    />
                  ) : null}
                </label>
              );
            })}
          </div>
          {errors.type ? (
            <p className="text-xs font-medium text-danger-fg">{errors.type}</p>
          ) : null}
        </fieldset>

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
          Submit request
        </SubmitButton>
      </fieldset>
    </form>
  );
}
