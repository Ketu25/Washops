"use client";

import { useActionState } from "react";

import type { FormState } from "@/app/actions/auth";
import { updateRequestStatusAction } from "@/app/actions/requests";
import { canTransition } from "@/lib/transitions";
import type { RequestStatus } from "@/lib/types";
import { SubmitButton } from "./submit-button";

const initialState: FormState = {};

/**
 * The admin's status controls for one request. Buttons are rendered only for
 * transitions the server would actually allow, so the UI never offers a move
 * that is going to be rejected.
 */
export function RequestStatusActions({
  requestId,
  status,
}: {
  requestId: string;
  status: RequestStatus;
}) {
  const [state, formAction] = useActionState(
    updateRequestStatusAction,
    initialState,
  );

  const showPlan = canTransition(status, "planned");
  const showComplete = canTransition(status, "completed");
  const showCancel = canTransition(status, "cancelled");

  if (!showPlan && !showComplete && !showCancel) {
    return <span className="text-xs text-muted">No actions</span>;
  }

  return (
    <form action={formAction} className="flex flex-col items-start gap-1.5">
      <input type="hidden" name="requestId" value={requestId} />
      <div className="flex flex-wrap gap-1.5">
        {showPlan ? (
          <SubmitButton
            name="status"
            value="planned"
            variant="primary"
            pendingLabel="Saving…"
            className="px-3 py-1.5 text-xs"
          >
            Mark planned
          </SubmitButton>
        ) : null}
        {showComplete ? (
          <SubmitButton
            name="status"
            value="completed"
            variant="secondary"
            pendingLabel="Saving…"
            className="px-3 py-1.5 text-xs"
          >
            Mark completed
          </SubmitButton>
        ) : null}
        {showCancel ? (
          <SubmitButton
            name="status"
            value="cancelled"
            variant="danger"
            pendingLabel="Saving…"
            className="px-3 py-1.5 text-xs"
            confirm="Cancel this request? The customer will see it as cancelled."
          >
            Cancel
          </SubmitButton>
        ) : null}
      </div>
      {state.error ? (
        <p className="max-w-xs text-xs text-red-600 dark:text-red-400">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
