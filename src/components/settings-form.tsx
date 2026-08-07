"use client";

import { useActionState, useState } from "react";

import type { FormState } from "@/app/actions/auth";
import { updateSettingsAction } from "@/app/actions/settings";
import { AddressAutocomplete } from "./address-autocomplete";
import { SubmitButton } from "./submit-button";
import { Alert, Field, Input } from "./ui";

const initialState: FormState = {};

export interface SettingsDefaults {
  name: string;
  address: string;
  serviceRadiusMiles: string;
}

export function SettingsForm({ defaults }: { defaults: SettingsDefaults }) {
  const [state, formAction] = useActionState(updateSettingsAction, initialState);
  const errors = state.fieldErrors ?? {};
  const values = { ...defaults, ...(state.values ?? {}) };
  const [address, setAddress] = useState(defaults.address);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}

      <Field label="Laundromat name" htmlFor="name" error={errors.name}>
        <Input
          id="name"
          name="name"
          required
          defaultValue={values.name}
          invalid={Boolean(errors.name)}
          placeholder="Sparkle Wash Laundromat"
        />
      </Field>

      <Field
        label="Laundromat address"
        htmlFor="address"
        error={errors.address}
        hint="Start typing and pick it from the list. We geocode this to anchor your service area."
      >
        <AddressAutocomplete
          id="address"
          name="address"
          value={address}
          onValueChange={setAddress}
          scope="address"
          fillWith="full"
          required
          maxLength={300}
          invalid={Boolean(errors.address)}
          placeholder="45 Elm Street, Springfield, IL 62701"
        />
      </Field>

      <Field
        label="Service radius (miles)"
        htmlFor="serviceRadiusMiles"
        error={errors.serviceRadiusMiles}
        hint="Straight-line distance. Customers beyond this cannot register or book."
      >
        <Input
          id="serviceRadiusMiles"
          name="serviceRadiusMiles"
          type="number"
          inputMode="decimal"
          step="0.1"
          min="0.1"
          max="500"
          required
          defaultValue={values.serviceRadiusMiles}
          invalid={Boolean(errors.serviceRadiusMiles)}
          className="max-w-40"
        />
      </Field>

      <SubmitButton pendingLabel="Verifying address…" className="sm:self-start">
        Save settings
      </SubmitButton>
    </form>
  );
}
