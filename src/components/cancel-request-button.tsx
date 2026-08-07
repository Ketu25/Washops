"use client";

import { useActionState } from "react";

import type { FormState } from "@/app/actions/auth";
import { cancelRequestAction } from "@/app/actions/requests";
import { SubmitButton } from "./submit-button";

const initialState: FormState = {};

export function CancelRequestButton({
  requestId,
  label,
}: {
  requestId: string;
  label: string;
}) {
  const [state, formAction] = useActionState(cancelRequestAction, initialState);

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="requestId" value={requestId} />
      <SubmitButton
        variant="danger"
        pendingLabel="Cancelling…"
        confirm={`Cancel your ${label}? This cannot be undone.`}
      >
        Cancel
      </SubmitButton>
      {state.error ? (
        <p className="max-w-xs text-right text-xs text-red-600 dark:text-red-400">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
