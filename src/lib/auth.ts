import "server-only";

import bcrypt from "bcryptjs";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { env } from "./env";
import { db } from "./supabase";
import type { PublicUser, UserRole, UserRow } from "./types";

const SESSION_COOKIE = "laundromat_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7; // 7 days
const BCRYPT_ROUNDS = 12;

const secretKey = () => new TextEncoder().encode(env.sessionSecret);

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

interface SessionPayload {
  sub: string;
  role: UserRole;
}

export async function createSession(user: {
  id: string;
  role: UserRole;
}): Promise<void> {
  const token = await new SignJWT({ role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(secretKey());

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

async function readSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  // Resolve the key OUTSIDE the try. Inside it, a missing or too-short
  // SESSION_SECRET would be swallowed by the catch below and reported as
  // "not signed in" — so a misconfigured deployment would look like an
  // ordinary logged-out visitor on every page, while login itself 500s. A
  // configuration fault must not be indistinguishable from a bad cookie.
  const key = secretKey();

  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ["HS256"],
    });
    if (typeof payload.sub !== "string") return null;
    const role = payload.role;
    if (role !== "customer" && role !== "admin") return null;
    return { sub: payload.sub, role };
  } catch {
    // Expired, tampered with, or signed by an older SESSION_SECRET.
    return null;
  }
}

/**
 * The signed-in user, or null.
 *
 * The role is re-read from the database rather than trusted from the JWT, so
 * revoking an admin takes effect on their next request instead of whenever
 * their week-old cookie happens to expire. Wrapped in React's `cache` so the
 * layout, page, and any server action in one render share a single query.
 */
export const getCurrentUser = cache(async (): Promise<PublicUser | null> => {
  const session = await readSession();
  if (!session) return null;

  const { data, error } = await db()
    .from("users")
    .select(
      "id, email, full_name, phone, role, address_line1, address_line2, city, state, postal_code, formatted_address, latitude, longitude, distance_miles, created_at, updated_at",
    )
    .eq("id", session.sub)
    .maybeSingle();

  if (error || !data) return null;
  return data as PublicUser;
});

export async function requireUser(): Promise<PublicUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireCustomer(): Promise<PublicUser> {
  const user = await requireUser();
  // An admin landing on a customer page is not an error worth showing —
  // send them where they meant to go.
  if (user.role !== "customer") redirect("/admin");
  return user;
}

export async function requireAdmin(): Promise<PublicUser> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/dashboard");
  return user;
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const { data, error } = await db()
    .from("users")
    .select("*")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();

  if (error) throw new Error(`Failed to look up user: ${error.message}`);
  return (data as UserRow) ?? null;
}
