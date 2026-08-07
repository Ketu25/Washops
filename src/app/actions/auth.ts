"use server";

import { redirect } from "next/navigation";

import {
  createSession,
  destroySession,
  findUserByEmail,
  hashPassword,
  requireUser,
  verifyPassword,
} from "@/lib/auth";
import { checkCoverage } from "@/lib/service-area";
import { db } from "@/lib/supabase";
import {
  fieldErrors,
  loginSchema,
  profileSchema,
  registerSchema,
} from "@/lib/validation";

export interface FormState {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: string;
  /** Echoed back so the form can repopulate after a failed submit. */
  values?: Record<string, string>;
}

function readForm(formData: FormData, keys: string[]): Record<string, string> {
  const values: Record<string, string> = {};
  for (const key of keys) {
    const value = formData.get(key);
    if (typeof value === "string") values[key] = value;
  }
  return values;
}

const REGISTER_FIELDS = [
  "fullName",
  "email",
  "phone",
  "password",
  "addressLine1",
  "addressLine2",
  "city",
  "state",
  "postalCode",
];

export async function registerAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const raw = readForm(formData, REGISTER_FIELDS);
  // Never echo the password back into the rendered HTML.
  const echo = { ...raw };
  delete echo.password;

  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: fieldErrors(parsed.error), values: echo };
  }
  const input = parsed.data;

  const existing = await findUserByEmail(input.email);
  if (existing) {
    return {
      fieldErrors: { email: "An account with that email already exists." },
      values: echo,
    };
  }

  // Service-area gate #1: you cannot register outside the coverage zone.
  const coverage = await checkCoverage(input);
  if (!coverage.covered) {
    return { error: coverage.message, values: echo };
  }

  const passwordHash = await hashPassword(input.password);

  const { data, error } = await db()
    .from("users")
    .insert({
      email: input.email,
      password_hash: passwordHash,
      full_name: input.fullName,
      phone: input.phone?.trim() || null,
      role: "customer",
      address_line1: input.addressLine1,
      address_line2: input.addressLine2?.trim() || null,
      city: input.city,
      state: input.state,
      postal_code: input.postalCode,
      formatted_address: coverage.formattedAddress,
      latitude: coverage.latitude,
      longitude: coverage.longitude,
      distance_miles: coverage.distanceMiles,
    })
    .select("id, role")
    .single();

  if (error) {
    // Someone registered the same email between our check and this insert.
    if (error.code === "23505") {
      return {
        fieldErrors: { email: "An account with that email already exists." },
        values: echo,
      };
    }
    return { error: `Could not create your account: ${error.message}`, values: echo };
  }

  await createSession({ id: data.id, role: "customer" });
  redirect("/dashboard");
}

/**
 * A genuine bcrypt hash of a value nobody can supply, computed once at first
 * use. It has to be a real hash with the same cost factor — bcrypt rejects a
 * malformed string immediately, which would reintroduce the timing signal
 * this is meant to remove.
 */
let decoyHashPromise: Promise<string> | null = null;
function decoyHash(): Promise<string> {
  decoyHashPromise ??= hashPassword(
    `decoy:${Math.random().toString(36).slice(2)}`,
  );
  return decoyHashPromise;
}

export async function loginAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const raw = readForm(formData, ["email", "password"]);
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      fieldErrors: fieldErrors(parsed.error),
      values: { email: raw.email ?? "" },
    };
  }

  const user = await findUserByEmail(parsed.data.email);
  // Compare against a real decoy hash when the user is missing so a failed
  // login costs the same either way and cannot be used to enumerate accounts.
  const hash = user?.password_hash ?? (await decoyHash());
  const valid = await verifyPassword(parsed.data.password, hash);

  if (!user || !valid) {
    return {
      error: "Incorrect email or password.",
      values: { email: parsed.data.email },
    };
  }

  await createSession({ id: user.id, role: user.role });
  redirect(user.role === "admin" ? "/admin" : "/dashboard");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}

const PROFILE_FIELDS = [
  "fullName",
  "phone",
  "addressLine1",
  "addressLine2",
  "city",
  "state",
  "postalCode",
];

export async function updateProfileAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const raw = readForm(formData, PROFILE_FIELDS);

  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: fieldErrors(parsed.error), values: raw };
  }
  const input = parsed.data;

  // Service-area gate #2: you cannot move your address out of coverage.
  const coverage = await checkCoverage(input);
  if (!coverage.covered) {
    return { error: coverage.message, values: raw };
  }

  const { error } = await db()
    .from("users")
    .update({
      full_name: input.fullName,
      phone: input.phone?.trim() || null,
      address_line1: input.addressLine1,
      address_line2: input.addressLine2?.trim() || null,
      city: input.city,
      state: input.state,
      postal_code: input.postalCode,
      formatted_address: coverage.formattedAddress,
      latitude: coverage.latitude,
      longitude: coverage.longitude,
      distance_miles: coverage.distanceMiles,
    })
    .eq("id", user.id);

  if (error) {
    return { error: `Could not save your profile: ${error.message}`, values: raw };
  }

  return {
    success: `Profile saved. Your address is ${coverage.distanceMiles.toFixed(
      1,
    )} miles from ${coverage.laundromatName}.`,
  };
}
