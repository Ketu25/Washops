"use client";

import { X } from "lucide-react";
import { useActionState, useRef } from "react";

import type { FormState } from "@/app/actions/auth";
import { cancelRequestAction } from "@/app/actions/requests";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const initialState: FormState = {};

export function CancelRequestButton({
  requestId,
  label,
}: {
  requestId: string;
  label: string;
}) {
  const [state, formAction] = useActionState(cancelRequestAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <form ref={formRef} action={formAction}>
        <input type="hidden" name="requestId" value={requestId} />
        <ConfirmDialog
          trigger={
            <Button type="button" variant="danger" size="sm">
              <X aria-hidden />
              Cancel
            </Button>
          }
          title="Cancel this request?"
          description={`Your ${label} will be cancelled. This cannot be undone, though you can book that day again afterwards.`}
          confirmLabel="Cancel request"
          onConfirm={() => formRef.current?.requestSubmit()}
        />
      </form>
      {state.error ? (
        <p className="max-w-64 text-right text-xs text-danger-fg">{state.error}</p>
      ) : null}
    </div>
  );
}
