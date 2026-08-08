import { NextResponse } from "next/server";

import { activeProvider } from "@/lib/places";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

/**
 * Deployment diagnostic.
 *
 * A missing environment variable surfaces as an opaque 500 with a Next.js
 * error digest and nothing else — and only on the code path that happens to
 * read it, so the app looks half-working. This turns that into one request.
 *
 * It reports which variables are MISSING and never echoes a value, so it is
 * safe to leave reachable: it tells an operator what to fix and tells an
 * attacker nothing they could not already infer.
 */
const REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SESSION_SECRET",
] as const;

const OPTIONAL = [
  "GOOGLE_MAPS_API_KEY",
  "APP_TIMEZONE",
  "ADDRESS_COUNTRY_CODES",
  "GEOCODER_USER_AGENT",
] as const;

export async function GET() {
  const missing = REQUIRED.filter((name) => !process.env[name]?.trim());
  const missingOptional = OPTIONAL.filter((name) => !process.env[name]?.trim());

  // SESSION_SECRET being present but too short fails exactly like a missing
  // one, at exactly the same unhelpful moment, so check it separately.
  const secret = process.env.SESSION_SECRET?.trim() ?? "";
  const secretTooShort = secret.length > 0 && secret.length < 32;

  let database: string;
  let laundromatConfigured: boolean | null = null;
  try {
    const settings = await getSettings();
    database = "reachable";
    laundromatConfigured = settings !== null;
  } catch (error) {
    database = `unreachable: ${error instanceof Error ? error.message : "unknown"}`;
  }

  const ok = missing.length === 0 && !secretTooShort && database === "reachable";

  return NextResponse.json(
    {
      ok,
      missingRequired: missing,
      missingOptional,
      sessionSecretTooShort: secretTooShort,
      database,
      laundromatConfigured,
      addressProvider: process.env.GOOGLE_MAPS_API_KEY?.trim()
        ? activeProvider()
        : "nominatim (no Google key set)",
    },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
