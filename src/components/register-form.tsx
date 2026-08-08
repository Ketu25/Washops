"use client";

import { useActionState } from "react";

import { registerAction, type FormState } from "@/app/actions/auth";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { AddressFields } from "./address-fields";

const initialState: FormState = {};

export function RegisterForm({ radiusLabel }: { radiusLabel: string | null }) {
  const [state, formAction] = useActionState(registerAction, initialState);
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {state.error ? (
        <Alert tone="error" title="We cannot serve this address">
          {state.error}
        </Alert>
      ) : null}

      <div className="flex flex-col gap-4">
        <Field label="Full name" htmlFor="fullName" error={errors.fullName} required>
          <Input
            id="fullName"
            name="fullName"
            autoComplete="name"
            required
            defaultValue={values.fullName}
            invalid={Boolean(errors.fullName)}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" htmlFor="email" error={errors.email} required>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              defaultValue={values.email}
              invalid={Boolean(errors.email)}
            />
          </Field>

          <Field
            label="Phone"
            htmlFor="phone"
            error={errors.phone}
            hint="Optional — so our driver can reach you."
          >
            <Input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              defaultValue={values.phone}
              invalid={Boolean(errors.phone)}
            />
          </Field>
        </div>

        <Field
          label="Password"
          htmlFor="password"
          error={errors.password}
          hint="At least 8 characters."
          required
        >
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={72}
            invalid={Boolean(errors.password)}
          />
        </Field>
      </div>

      <div className="border-t border-line pt-5">
        <h2 className="text-sm font-semibold text-fg">Home address</h2>
        <p className="mb-4 mt-1 text-xs text-fg-subtle">
          {radiusLabel
            ? `We check this against our ${radiusLabel} mile service area before creating your account.`
            : "We check this against our service area before creating your account."}
        </p>
        <AddressFields defaults={values} errors={errors} />
      </div>

      <SubmitButton size="lg" className="w-full" pendingLabel="Checking your address…">
        Create account
      </SubmitButton>
    </form>
  );
}
