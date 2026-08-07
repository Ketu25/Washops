import { NextResponse } from "next/server";

import { resolveSuggestion } from "@/lib/places";

/**
 * Second half of the two-phase autocomplete: exchange the place the user
 * clicked for its full address and coordinates.
 *
 * Called once per completed address, not once per keystroke. Passing the same
 * session token the predictions used closes the Places session, which is what
 * keeps this from being billed per keystroke.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const placeId = searchParams.get("placeId")?.slice(0, 256);
  const sessionToken = searchParams.get("session")?.slice(0, 64) || undefined;

  if (!placeId) {
    return NextResponse.json(
      { error: "placeId is required" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const resolved = await resolveSuggestion(placeId, sessionToken, request.signal);

  return NextResponse.json(
    { resolved },
    { headers: { "Cache-Control": "no-store" } },
  );
}
