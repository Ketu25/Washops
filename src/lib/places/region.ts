import "server-only";

/**
 * Countries the portal will accept addresses from.
 *
 * A laundromat that drives a van to your door is inherently one-country, so
 * this defaults to the US. It is enforced on both the suggestion dropdown and
 * the submit-time geocode: restricting only the dropdown would still let
 * someone type a foreign address by hand and have it accepted.
 *
 * ISO 3166-1 alpha-2, comma-separated. Set to an empty string to allow
 * anywhere.
 */
const RAW = process.env.ADDRESS_COUNTRY_CODES ?? "us";

export const COUNTRY_CODES: string[] = RAW.split(",")
  .map((code) => code.trim().toLowerCase())
  .filter((code) => /^[a-z]{2}$/.test(code));

export const isCountryRestricted = COUNTRY_CODES.length > 0;

/**
 * Set DEBUG_PLACES=1 to log the exact upstream request each provider builds.
 * "What did we actually ask for?" is the first question whenever suggestions
 * look wrong, and it is otherwise invisible.
 */
export function debugPlaces(label: string, detail: unknown) {
  if (process.env.DEBUG_PLACES === "1") {
    console.log(`[places] ${label}`, detail);
  }
}
