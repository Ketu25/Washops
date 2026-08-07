"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin, requireCustomer } from "@/lib/auth";
import {
  cancelRequest,
  createRequest,
  setRequestStatus,
} from "@/lib/requests";
import type { RequestStatus } from "@/lib/types";
import { createRequestSchema, fieldErrors } from "@/lib/validation";

import type { FormState } from "./auth";

export async function createRequestAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireCustomer();

  const raw = {
    type: String(formData.get("type") ?? ""),
    scheduledDate: String(formData.get("scheduledDate") ?? ""),
    timeWindow: String(formData.get("timeWindow") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  };

  const parsed = createRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: fieldErrors(parsed.error), values: raw };
  }

  const result = await createRequest(user, {
    type: parsed.data.type,
    scheduledDate: parsed.data.scheduledDate,
    timeWindow: parsed.data.timeWindow,
    notes: parsed.data.notes || null,
  });

  if (!result.ok) {
    return { error: result.error, values: raw };
  }

  revalidatePath("/dashboard");
  revalidatePath("/admin");
  return { success: "Your request has been submitted and is awaiting confirmation." };
}

export async function cancelRequestAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireCustomer();
  const requestId = String(formData.get("requestId") ?? "");

  if (!requestId) {
    return { error: "Missing request reference." };
  }

  const result = await cancelRequest(user.id, requestId);
  if (!result.ok) {
    return { error: result.error };
  }

  revalidatePath("/dashboard");
  revalidatePath("/admin");
  return { success: "Request cancelled." };
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
  if (!result.ok) {
    return { error: result.error };
  }

  revalidatePath("/admin");
  revalidatePath("/dashboard");
  return { success: `Request marked as ${status}.` };
}
