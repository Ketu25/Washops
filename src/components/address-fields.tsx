"use client";

import { useState } from "react";

import type { ResolvedAddress } from "@/lib/places/types";
import { AddressAutocomplete } from "./address-autocomplete";
import { Field, Input } from "./ui";

export interface AddressDefaults {
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
}

/**
 * The structured address block shared by registration and profile editing.
 * Keeping it in one place means both paths feed the geocoder identically —
 * which matters, because both are service-area gates.
 *
 * Picking a suggestion on the street line fills in city, state, and ZIP from
 * the same provider record, so the four fields cannot disagree with each
 * other. Every field stays editable by hand for addresses the provider does
 * not know.
 *
 * Do NOT give this a changing `key` from the parent. Remounting it while the
 * parent's useActionState is committing its result resets that state, which
 * silently swallows every server-side error the form is supposed to show —
 * including the out-of-range message. Reseeding is not needed regardless:
 * these inputs already hold exactly what the customer typed, so a rejected
 * submit keeps their input without any remount.
 */
export function AddressFields({
  defaults = {},
  errors = {},
}: {
  defaults?: AddressDefaults;
  errors?: Record<string, string>;
}) {
  const [addressLine1, setAddressLine1] = useState(defaults.addressLine1 ?? "");
  const [city, setCity] = useState(defaults.city ?? "");
  const [state, setState] = useState(defaults.state ?? "");
  const [postalCode, setPostalCode] = useState(defaults.postalCode ?? "");

  function applySuggestion(resolved: ResolvedAddress) {
    // Only overwrite a sibling field when the resolved address actually
    // carries that component — a partial record should not blank out
    // something the user already typed correctly.
    if (resolved.city) setCity(resolved.city);
    if (resolved.state) setState(resolved.state);
    if (resolved.postalCode) setPostalCode(resolved.postalCode);
  }

  return (
    <>
      <Field
        label="Street address"
        htmlFor="addressLine1"
        error={errors.addressLine1}
        hint="Start typing and pick your address from the list."
      >
        <AddressAutocomplete
          id="addressLine1"
          name="addressLine1"
          value={addressLine1}
          onValueChange={setAddressLine1}
          onSelect={applySuggestion}
          scope="address"
          required
          maxLength={200}
          autoComplete="off"
          invalid={Boolean(errors.addressLine1)}
          placeholder="120 Main Street"
        />
      </Field>

      <Field
        label="Apartment, unit, floor"
        htmlFor="addressLine2"
        error={errors.addressLine2}
        hint="Optional — helps our driver find you."
      >
        <Input
          id="addressLine2"
          name="addressLine2"
          autoComplete="address-line2"
          defaultValue={defaults.addressLine2}
          invalid={Boolean(errors.addressLine2)}
          placeholder="Apt 4B"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="City" htmlFor="city" error={errors.city}>
          <AddressAutocomplete
            id="city"
            name="city"
            value={city}
            onValueChange={setCity}
            onSelect={(resolved) => {
              if (resolved.state) setState(resolved.state);
            }}
            scope="city"
            required
            maxLength={100}
            invalid={Boolean(errors.city)}
          />
        </Field>

        <Field label="State" htmlFor="state" error={errors.state}>
          <AddressAutocomplete
            id="state"
            name="state"
            value={state}
            onValueChange={setState}
            scope="state"
            required
            maxLength={60}
            invalid={Boolean(errors.state)}
          />
        </Field>

        <Field label="ZIP code" htmlFor="postalCode" error={errors.postalCode}>
          <AddressAutocomplete
            id="postalCode"
            name="postalCode"
            value={postalCode}
            onValueChange={setPostalCode}
            onSelect={(resolved) => {
              if (resolved.city) setCity(resolved.city);
              if (resolved.state) setState(resolved.state);
            }}
            scope="postcode"
            required
            maxLength={20}
            invalid={Boolean(errors.postalCode)}
          />
        </Field>
      </div>
    </>
  );
}
