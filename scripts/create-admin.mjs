#!/usr/bin/env node
/**
 * Create or reset the admin account.
 *
 * There is deliberately no public path to an admin account — the owner is
 * seeded from the command line, so nobody can register their way into the
 * admin portal.
 *
 *   npm run create-admin -- owner@example.com "Owner Name" "s3cret-pass"
 *
 * Re-running with an existing email resets that account's password and
 * promotes it to admin.
 */

import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import ws from "ws";

const [email, fullName, password] = process.argv.slice(2);

if (!email || !fullName || !password) {
  console.error(
    'Usage: npm run create-admin -- <email> "<full name>" "<password>"',
  );
  process.exit(1);
}

if (password.length < 8 || password.length > 72) {
  console.error("Password must be between 8 and 72 characters.");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Copy .env.example to .env.local and fill it in first.",
  );
  process.exit(1);
}

const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
  // Node 20 has no global WebSocket; supabase-js builds a realtime client
  // regardless, so give it a transport.
  realtime: { transport: ws },
});

const normalisedEmail = email.trim().toLowerCase();
const passwordHash = await bcrypt.hash(password, 12);

const { data: existing, error: lookupError } = await db
  .from("users")
  .select("id")
  .eq("email", normalisedEmail)
  .maybeSingle();

if (lookupError) {
  console.error(`Lookup failed: ${lookupError.message}`);
  process.exit(1);
}

if (existing) {
  const { error } = await db
    .from("users")
    .update({
      password_hash: passwordHash,
      full_name: fullName.trim(),
      role: "admin",
    })
    .eq("id", existing.id);

  if (error) {
    console.error(`Update failed: ${error.message}`);
    process.exit(1);
  }
  console.log(`Updated existing account ${normalisedEmail} — now an admin.`);
} else {
  const { error } = await db.from("users").insert({
    email: normalisedEmail,
    password_hash: passwordHash,
    full_name: fullName.trim(),
    role: "admin",
  });

  if (error) {
    console.error(`Insert failed: ${error.message}`);
    process.exit(1);
  }
  console.log(`Created admin account ${normalisedEmail}.`);
}

console.log("Sign in at /login, then configure your service area at /admin/settings.");
