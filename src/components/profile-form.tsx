"use client";

import { useActionState } from "react";

import { updateProfileAction, type FormState } from "@/app/actions/auth";
import { AddressFields } from "./address-fields";
import { SubmitButton } from "./submit-button";
import { Alert, Field, Input } from "./ui";

const initialState: FormState = {};

export interface ProfileDefaults {
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
}

export function ProfileForm({ defaults }: { defaults: ProfileDefaults }) {
  const [state, formAction] = useActionState(updateProfileAction, initialState);
  const errors = state.fieldErrors ?? {};
  // Prefer what the user just typed over what is stored, so a rejected
  // address does not silently revert to the old one in the inputs.
  const values = { ...defaults, ...(state.values ?? {}) };

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error ? (
        <Alert tone="error" title="Address not saved">
          {state.error}
        </Alert>
      ) : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}

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

      <Field label="Phone" htmlFor="phone" error={errors.phone}>
        <Input
          id="phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          defaultValue={values.phone}
          invalid={Boolean(errors.phone)}
        />
      </Field>

      <div className="mt-2 border-t border-line pt-4">
        <h2 className="text-sm font-semibold">Home address</h2>
        <p className="mb-4 mt-0.5 text-xs text-muted">
          Changing this re-checks your address against the service area. If the
          new address is outside it, the change is rejected and your existing
          address stays in place.
        </p>
        <div className="flex flex-col gap-4">
          <AddressFields
            defaults={values}
            errors={errors}
          />
        </div>
      </div>

      <SubmitButton pendingLabel="Verifying address…" className="sm:self-start">
        Save changes
      </SubmitButton>
    </form>
  );
}
