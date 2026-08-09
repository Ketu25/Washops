"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin, requireCustomer } from "@/lib/auth";
import {
  cancelRequest,
  createRequest,
  scheduleDropoff,
  setRequestStatus,
} from "@/lib/requests";
import type { RequestStatus } from "@/lib/types";
import {
  createRequestSchema,
  fieldErrors,
  scheduleDropoffSchema,
} from "@/lib/validation";

import type { FormState } from "./auth";

/** Both portals show request data, so a change on either must refresh both. */
function revalidateRequestViews() {
  revalidatePath("/dashboard");
  revalidatePath("/admin");
}

export async function createRequestAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireCustomer();

  const raw = {
    scheduledDate: String(formData.get("scheduledDate") ?? ""),
    timeWindow: String(formData.get("timeWindow") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  };

  const parsed = createRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: fieldErrors(parsed.error), values: raw };
  }

  // `type` is never read from the form: customers book pickups, and the
  // return is the laundromat's to schedule.
  const result = await createRequest(user, {
    scheduledDate: parsed.data.scheduledDate,
    timeWindow: parsed.data.timeWindow,
    notes: parsed.data.notes || null,
  });

  if (!result.ok) return { error: result.error, values: raw };

  revalidateRequestViews();
  return {
    success: "Your pickup has been submitted and is awaiting confirmation.",
  };
}

export async function cancelRequestAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireCustomer();
  const requestId = String(formData.get("requestId") ?? "");

  if (!requestId) return { error: "Missing request reference." };

  const result = await cancelRequest(user.id, requestId);
  if (!result.ok) return { error: result.error };

  revalidateRequestViews();
  return { success: "Pickup cancelled." };
}

const ADMIN_STATUSES: RequestStatus[] = ["planned", "completed", "cancelled"];

export async function updateRequestStatusAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const requestId = String(formData.get("requestId") ?? "");
  const status = String(formData.get("status") ?? "") as RequestStatus;

  if (!requestId) return { error: "Missing request reference." };
  if (!ADMIN_STATUSES.includes(status)) {
    return { error: "Unrecognised status change." };
  }

  const result = await setRequestStatus(requestId, status);
  if (!result.ok) return { error: result.error };

  revalidateRequestViews();
  return { success: `Request marked as ${status}.` };
}

/**
 * Schedule the return of a completed pickup. Admin only — this is the half
 * of the workflow the customer does not control.
 */
export async function scheduleDropoffAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const raw = {
    pickupId: String(formData.get("pickupId") ?? ""),
    scheduledDate: String(formData.get("scheduledDate") ?? ""),
    timeWindow: String(formData.get("timeWindow") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  };

  const parsed = scheduleDropoffSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: fieldErrors(parsed.error), values: raw };
  }

  const result = await scheduleDropoff({
    pickupId: parsed.data.pickupId,
    scheduledDate: parsed.data.scheduledDate,
    timeWindow: parsed.data.timeWindow,
    notes: parsed.data.notes || null,
  });

  if (!result.ok) return { error: result.error, values: raw };

  revalidateRequestViews();
  return { success: "Drop-off scheduled. The customer can see it now." };
}
