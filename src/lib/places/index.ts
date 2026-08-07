import "server-only";

import { GeocodeError, type GeocodeResult } from "../geocode-error";
import { getSettings } from "../settings";
import * as google from "./google";
import * as nominatim from "./nominatim";
import type {
  AddressSuggestion,
  ResolvedAddress,
  SuggestOptions,
} from "./types";

export type { AddressSuggestion, ResolvedAddress, SuggestOptions };
export { GeocodeError };
export type { GeocodeResult };

const MIN_QUERY_LENGTH = 3;

/**
 * Google when a key is present, OpenStreetMap otherwise.
 *
 * Keeping Nominatim as a working fallback means the app still runs for anyone
 * who clones it without a Google account, and a billing problem degrades the
 * suggestions rather than taking scheduling down.
 */
export function activeProvider(): "google" | "nominatim" {
  return google.isGoogleConfigured() ? "google" : "nominatim";
}

/** Predictions are biased toward the shop, so local streets rank first. */
async function origin() {
  const settings = await getSettings().catch(() => null);
  if (!settings) return undefined;
  return { latitude: settings.latitude, longitude: settings.longitude };
}

/**
 * Typeahead suggestions.
 *
 * Returns [] rather than throwing on failure: a dropdown that quietly shows
 * nothing is the right degradation, because the user can always finish typing
 * and submit. The real validation is checkCoverage() at submit time, and that
 * one does surface its errors.
 */
export async function suggestAddresses(
  query: string,
  options: SuggestOptions,
): Promise<AddressSuggestion[]> {
  const q = query.trim().replace(/\s+/g, " ");
  if (q.length < MIN_QUERY_LENGTH) return [];

  const where = await origin();

  if (activeProvider() === "google") {
    try {
      return await google.suggest(q, options, where);
    } catch (error) {
      // A key that is present but rejected — APIs not enabled, billing
      // lapsed, quota blown — would otherwise leave the dropdown permanently
      // empty, which looks identical to "no such address". Fall back so
      // customers can still complete the form.
      warnGoogleUnavailable(error);
      try {
        return await nominatim.suggest(q, options, where);
      } catch {
        return [];
      }
    }
  }

  try {
    return await nominatim.suggest(q, options, where);
  } catch {
    return [];
  }
}

let warnedAt = 0;
const WARN_INTERVAL_MS = 60_000;

/**
 * A silent fallback would hide a broken Google key indefinitely — the app
 * would look fine while quietly serving worse addresses. Say so in the server
 * log, throttled so a busy form does not flood it.
 */
function warnGoogleUnavailable(error: unknown) {
  const now = Date.now();
  if (now - warnedAt < WARN_INTERVAL_MS) return;
  warnedAt = now;
  console.warn(
    "[places] GOOGLE_MAPS_API_KEY is set but Google rejected the request; " +
      "falling back to OpenStreetMap. Check that Places API (New) and " +
      "Geocoding API are enabled and billing is active. " +
      (error instanceof Error ? error.message : String(error)),
  );
}

/**
 * Second half of the two-phase flow: turn the row the user clicked into a
 * full address. Google predictions carry no coordinates, so this is a real
 * lookup; Nominatim already returned everything, so the caller skips it.
 */
export async function resolveSuggestion(
  placeId: string,
  sessionToken?: string,
  signal?: AbortSignal,
): Promise<ResolvedAddress | null> {
  if (activeProvider() !== "google") return null;
  try {
    return await google.resolve(placeId, sessionToken, signal);
  } catch {
    return null;
  }
}

/**
 * Free-form address to coordinates, used by every service-area gate.
 *
 * Falls back to OpenStreetMap if Google is configured but failing, so a
 * billing lapse degrades accuracy instead of blocking registrations outright.
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult> {
  const query = address.trim();
  if (query.length < 5) {
    throw new GeocodeError(
      "Please enter a fuller address, including street, city, and ZIP code.",
      "invalid_input",
    );
  }

  if (activeProvider() === "google") {
    try {
      return await google.geocode(query);
    } catch (error) {
      // A genuine "no such address" is an answer, not an outage — surface it
      // rather than asking a second provider and getting a different verdict.
      if (error instanceof GeocodeError && error.kind === "not_found") throw error;
      return nominatim.geocode(query);
    }
  }

  return nominatim.geocode(query);
}

/** Join address parts into the single line the geocoder expects. */
export function composeAddress(parts: {
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  postalCode: string;
}): string {
  return [
    parts.addressLine1,
    parts.addressLine2 || null,
    parts.city,
    parts.state,
    parts.postalCode,
  ]
    .filter((part): part is string => Boolean(part && part.trim()))
    .map((part) => part.trim())
    .join(", ");
}
