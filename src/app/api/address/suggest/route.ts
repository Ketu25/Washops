import { NextResponse } from "next/server";

import { suggestAddresses } from "@/lib/places";
import type { SuggestScope } from "@/lib/places/types";

const SCOPES: SuggestScope[] = ["address", "city", "state", "postcode"];

/**
 * Typeahead endpoint for the address inputs.
 *
 * Deliberately public — the coverage checker on the home page uses it before
 * anyone has an account. The provider key stays on the server, which is the
 * main reason this is a proxy rather than a browser-side Places call.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").slice(0, 200);
  const sessionToken = searchParams.get("session")?.slice(0, 64) || undefined;

  const rawScope = searchParams.get("scope") ?? "address";
  const scope = (SCOPES as string[]).includes(rawScope)
    ? (rawScope as SuggestScope)
    : "address";

  const suggestions = await suggestAddresses(query, {
    scope,
    sessionToken,
    signal: request.signal,
  });

  return NextResponse.json(
    { suggestions },
    {
      headers: {
        // Predictions are per-keystroke and provider terms restrict storing
        // them, so nothing is cached beyond the life of the request.
        "Cache-Control": "no-store",
      },
    },
  );
}
