import { z } from "zod";

import { TIME_WINDOWS } from "./types";

const trimmed = (max: number) => z.string().trim().max(max);

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Email is required.")
  .max(254, "That email is too long.")
  .email("Enter a valid email address.");

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  // bcrypt silently ignores bytes past 72; reject rather than truncate so a
  // long password never validates against only its first 72 bytes.
  .max(72, "Password must be 72 characters or fewer.");

export const addressSchema = z.object({
  addressLine1: trimmed(200).min(3, "Street address is required."),
  addressLine2: trimmed(200).optional().or(z.literal("")),
  city: trimmed(100).min(2, "City is required."),
  state: trimmed(60).min(2, "State is required."),
  postalCode: trimmed(20).min(3, "ZIP / postal code is required."),
});

export const registerSchema = addressSchema.extend({
  fullName: trimmed(120).min(2, "Please enter your full name."),
  email: emailSchema,
  phone: trimmed(30).optional().or(z.literal("")),
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required."),
});

export const profileSchema = addressSchema.extend({
  fullName: trimmed(120).min(2, "Please enter your full name."),
  phone: trimmed(30).optional().or(z.literal("")),
});

/** Bare `YYYY-MM-DD`, validated as a real calendar date (rejects 2026-02-30). */
export const dateStringSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date.")
  .refine((value) => {
    const [y, m, d] = value.split("-").map(Number);
    const parsed = new Date(Date.UTC(y, m - 1, d));
    return (
      parsed.getUTCFullYear() === y &&
      parsed.getUTCMonth() === m - 1 &&
      parsed.getUTCDate() === d
    );
  }, "Choose a valid date.");

export const createRequestSchema = z.object({
  type: z.enum(["pickup", "dropoff"], {
    message: "Choose pickup or drop-off.",
  }),
  scheduledDate: dateStringSchema,
  timeWindow: z.enum(TIME_WINDOWS, { message: "Choose a time window." }),
  notes: trimmed(500).optional().or(z.literal("")),
});

export const settingsSchema = z.object({
  name: trimmed(120).min(2, "Laundromat name is required."),
  address: trimmed(300).min(5, "Enter the full laundromat address."),
  serviceRadiusMiles: z.coerce
    .number({ message: "Enter the service radius in miles." })
    .positive("Service radius must be greater than zero.")
    .max(500, "Service radius must be 500 miles or less."),
});

export const coverageCheckSchema = z.object({
  address: trimmed(300).min(5, "Enter a full address including city and ZIP."),
});

/** Collapse a ZodError into the `{ field: message }` shape the forms render. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !result[key]) {
      result[key] = issue.message;
    }
  }
  return result;
}
