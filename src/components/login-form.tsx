"use client";

import { useActionState } from "react";

import { loginAction, type FormState } from "@/app/actions/auth";
import { SubmitButton } from "./submit-button";
import { Alert, Field, Input } from "./ui";

const initialState: FormState = {};

export function LoginForm() {
  const [state, formAction] = useActionState(loginAction, initialState);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}

      <Field label="Email" htmlFor="email" error={errors.email}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.values?.email}
          invalid={Boolean(errors.email)}
        />
      </Field>

      <Field label="Password" htmlFor="password" error={errors.password}>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          invalid={Boolean(errors.password)}
        />
      </Field>

      <SubmitButton pendingLabel="Signing in…">Sign in</SubmitButton>
    </form>
  );
}
