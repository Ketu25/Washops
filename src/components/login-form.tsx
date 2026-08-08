"use client";

import { useActionState } from "react";

import { loginAction, type FormState } from "@/app/actions/auth";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";

const initialState: FormState = {};

export function LoginForm() {
  const [state, formAction] = useActionState(loginAction, initialState);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}

      <Field label="Email" htmlFor="email" error={errors.email} required>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.values?.email}
          invalid={Boolean(errors.email)}
          placeholder="you@example.com"
        />
      </Field>

      <Field label="Password" htmlFor="password" error={errors.password} required>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          invalid={Boolean(errors.password)}
        />
      </Field>

      <SubmitButton size="lg" className="mt-1 w-full" pendingLabel="Signing in…">
        Sign in
      </SubmitButton>
    </form>
  );
}
