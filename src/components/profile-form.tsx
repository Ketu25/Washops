"use client";

import { useActionState } from "react";

import { updateProfileAction, type FormState } from "@/app/actions/auth";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { AddressFields } from "./address-fields";

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
    <form action={formAction} className="flex flex-col gap-5">
      {state.error ? (
        <Alert tone="error" title="Address not saved">
          {state.error}
        </Alert>
      ) : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2">
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
      </div>

      <div className="border-t border-line pt-5">
        <h2 className="text-sm font-semibold text-fg">Home address</h2>
        <p className="mb-4 mt-1 text-xs text-fg-subtle">
          Changing this re-checks your address against the service area. If the
          new address is outside it, the change is rejected and your existing
          address stays in place.
        </p>
        <AddressFields defaults={values} errors={errors} />
      </div>

      <SubmitButton className="sm:self-start" pendingLabel="Verifying address…">
        Save changes
      </SubmitButton>
    </form>
  );
}
