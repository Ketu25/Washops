"use client";

import { useActionState } from "react";

import { registerAction, type FormState } from "@/app/actions/auth";
import { AddressFields } from "./address-fields";
import { SubmitButton } from "./submit-button";
import { Alert, Field, Input } from "./ui";

const initialState: FormState = {};

export function RegisterForm({ radiusLabel }: { radiusLabel: string | null }) {
  const [state, formAction] = useActionState(registerAction, initialState);
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error ? (
        <Alert tone="error" title="We cannot serve this address">
          {state.error}
        </Alert>
      ) : null}

      <Field label="Full name" htmlFor="fullName" error={errors.fullName}>
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
        <Field label="Email" htmlFor="email" error={errors.email}>
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

      <div className="mt-2 border-t border-line pt-4">
        <h2 className="text-sm font-semibold">Home address</h2>
        <p className="mb-4 mt-0.5 text-xs text-muted">
          {radiusLabel
            ? `We verify this against our ${radiusLabel} mile service area before creating your account.`
            : "We verify this against our service area before creating your account."}
        </p>
        <div className="flex flex-col gap-4">
          <AddressFields
            defaults={values}
            errors={errors}
          />
        </div>
      </div>

      <SubmitButton pendingLabel="Checking your address…">
        Create account
      </SubmitButton>
    </form>
  );
}
