"use client";

import { MapPin } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";

import { checkCoverageAction, type CoverageState } from "@/app/actions/coverage";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { AddressAutocomplete } from "./address-autocomplete";

const initialState: CoverageState = { status: "idle" };

export function CoverageChecker({ configured }: { configured: boolean }) {
  const [state, formAction] = useActionState(checkCoverageAction, initialState);
  const [address, setAddress] = useState("");

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="flex flex-col gap-3">
        <Field
          label="Enter your address to make sure we service your location"
          htmlFor="coverage-address"
          hint="No account needed."
        >
          <AddressAutocomplete
            id="coverage-address"
            name="address"
            value={address}
            onValueChange={setAddress}
            scope="address"
            fillWith="full"
            required
            maxLength={300}
            placeholder="120 Main Street, Springfield, IL 62701"
            invalid={state.status === "error"}
          />
        </Field>

        <SubmitButton size="lg" pendingLabel="Checking…">
          <MapPin aria-hidden />
          Check my address
        </SubmitButton>
      </form>

      {!configured ? (
        <Alert tone="warning">
          The service area has not been configured yet. An administrator needs
          to set the laundromat location and radius before addresses can be
          checked.
        </Alert>
      ) : null}

      {state.status === "covered" ? (
        <Alert tone="success" title="You are in our service area">
          <p>{state.message}</p>
          <Button asChild size="sm" className="mt-3">
            <Link href="/register">Create an account</Link>
          </Button>
        </Alert>
      ) : null}

      {state.status === "out_of_range" ? (
        <Alert tone="error" title="Outside our service area">
          <p>{state.message}</p>
          {state.matchedAddress ? (
            <p className="mt-2 text-xs opacity-80">
              We matched your address to: {state.matchedAddress}
            </p>
          ) : null}
        </Alert>
      ) : null}

      {state.status === "error" ? <Alert tone="error">{state.message}</Alert> : null}
    </div>
  );
}
