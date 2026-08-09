"use client";

import { Check, MoreHorizontal, Truck, X } from "lucide-react";
import { useActionState, useRef } from "react";

import type { FormState } from "@/app/actions/auth";
import { updateRequestStatusAction } from "@/app/actions/requests";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SubmitButton } from "@/components/ui/submit-button";
import { canTransition } from "@/lib/transitions";
import type { RequestStatus, RequestType } from "@/lib/types";
import { ScheduleDropoffDialog } from "./schedule-dropoff-dialog";

const initialState: FormState = {};

/**
 * Status controls for one request.
 *
 * The single most likely next step gets a real button, because an operator
 * working a queue does it dozens of times; everything else lives behind the
 * overflow menu. Three side-by-side buttons per row is what made the old
 * table wrap raggedly, and it gave a destructive action the same weight as
 * the routine one.
 *
 * Only transitions the server would actually accept are offered, so the UI
 * never presents a move that is going to be rejected.
 */
export function RequestStatusActions({
  requestId,
  status,
  type,
  dropoff,
}: {
  requestId: string;
  status: RequestStatus;
  type: RequestType;
  /**
   * Present only on completed pickups: everything the return dialog needs,
   * plus whether one is already booked.
   */
  dropoff?: {
    scheduled: boolean;
    customerName: string;
    pickupDate: string;
    minDate: string;
    maxDate: string;
  };
}) {
  const [state, formAction] = useActionState(
    updateRequestStatusAction,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const statusRef = useRef<HTMLInputElement>(null);

  const canPlan = canTransition(status, "planned");
  const canComplete = canTransition(status, "completed");
  const canCancel = canTransition(status, "cancelled");

  // A completed pickup is terminal as a *request*, but it is the point at
  // which the return becomes schedulable — so this is the one terminal state
  // that still has an action.
  if (type === "pickup" && status === "completed" && dropoff) {
    return dropoff.scheduled ? (
      <span className="text-xs text-fg-subtle">Drop-off booked</span>
    ) : (
      <ScheduleDropoffDialog
        pickupId={requestId}
        customerName={dropoff.customerName}
        pickupDate={dropoff.pickupDate}
        minDate={dropoff.minDate}
        maxDate={dropoff.maxDate}
      />
    );
  }

  if (!canPlan && !canComplete && !canCancel) {
    return <span className="text-xs text-fg-subtle">—</span>;
  }

  // The primary action is whatever moves this request forward one step.
  const primary = canPlan
    ? { value: "planned", label: "Mark planned", Icon: Truck }
    : { value: "completed", label: "Mark completed", Icon: Check };

  const overflow = [
    canPlan && canComplete
      ? { value: "completed", label: "Mark completed", Icon: Check, destructive: false }
      : null,
    canCancel
      ? { value: "cancelled", label: "Cancel request", Icon: X, destructive: true }
      : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null);

  /** Menu items submit the same form, so there is one code path server-side. */
  function submitWith(value: string) {
    if (statusRef.current) statusRef.current.value = value;
    formRef.current?.requestSubmit();
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      <form ref={formRef} action={formAction} className="flex items-center gap-1.5">
        <input type="hidden" name="requestId" value={requestId} />
        <input ref={statusRef} type="hidden" name="status" defaultValue={primary.value} />

        <SubmitButton
          size="sm"
          variant="secondary"
          pendingLabel="Saving…"
          onClick={() => submitWith(primary.value)}
        >
          <primary.Icon aria-hidden />
          {primary.label}
        </SubmitButton>

        {overflow.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label="More actions"
              >
                <MoreHorizontal aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {overflow.map((item) => (
                <DropdownMenuItem
                  key={item.value}
                  destructive={item.destructive}
                  onSelect={() => submitWith(item.value)}
                >
                  <item.Icon aria-hidden />
                  {item.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </form>

      {state.error ? (
        <p className="max-w-52 text-xs text-danger-fg">{state.error}</p>
      ) : null}
    </div>
  );
}
