import "server-only";

import { isValidCoordinates } from "../geo";
import { GeocodeError, type GeocodeResult } from "../geocode-error";
import { COUNTRY_CODES, debugPlaces, isCountryRestricted } from "./region";
import type {
  AddressSuggestion,
  ResolvedAddress,
  SuggestOptions,
  SuggestScope,
} from "./types";

const AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";
const DETAILS_URL = "https://places.googleapis.com/v1/places";
const GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";
const TIMEOUT_MS = 8_000;

function apiKey(): string {
  const key = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!key) throw new Error("GOOGLE_MAPS_API_KEY is not set");
  return key;
}

export function isGoogleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_MAPS_API_KEY?.trim());
}

/**
 * Restricting the prediction types is what stops the dropdown filling up with
 * restaurants and landmarks when someone types a street name — the single
 * biggest quality difference between this and an unfiltered search.
 */
const PRIMARY_TYPES: Record<SuggestScope, string[]> = {
  address: ["street_address", "premise", "subpremise", "route"],
  city: ["locality", "administrative_area_level_3"],
  state: ["administrative_area_level_1"],
  postcode: ["postal_code"],
};

interface GooglePrediction {
  placePrediction?: {
    placeId?: string;
    text?: { text?: string };
    structuredFormat?: {
      mainText?: { text?: string };
      secondaryText?: { text?: string };
    };
  };
}

/**
 * Bias predictions toward the shop so "120 Main" offers the Main Street a
 * driver can actually reach. This is a bias, not a restriction: an address
 * outside the circle still appears, and the service-area check at submit time
 * is what refuses it — with the distance spelled out.
 */
function locationBias(origin?: { latitude: number; longitude: number }) {
  if (!origin) return undefined;
  return {
    circle: {
      center: { latitude: origin.latitude, longitude: origin.longitude },
      radius: 50_000, // metres — Google's maximum
    },
  };
}

export async function suggest(
  query: string,
  options: SuggestOptions,
  origin?: { latitude: number; longitude: number },
): Promise<AddressSuggestion[]> {
  const body: Record<string, unknown> = {
    input: query,
    includedPrimaryTypes: PRIMARY_TYPES[options.scope],
    locationBias: locationBias(origin),
  };
  if (isCountryRestricted) body.includedRegionCodes = COUNTRY_CODES;
  if (options.sessionToken) body.sessionToken = options.sessionToken;

  debugPlaces("google.suggest", body);

  let response = await post(body, options.signal);

  // The set of valid primary types shifts between API revisions. Rather than
  // return nothing if Google rejects our filter, retry unfiltered once — a
  // slightly noisier dropdown beats an empty one.
  if (response.status === 400) {
    delete body.includedPrimaryTypes;
    response = await post(body, options.signal);
  }

  if (!response.ok) {
    throw new GeocodeError(
      "The address lookup service is unavailable. Please try again.",
      response.status === 429 ? "unavailable" : "unavailable",
    );
  }

  const payload = (await response.json()) as { suggestions?: GooglePrediction[] };

  return (payload.suggestions ?? [])
    .map((item, index): AddressSuggestion | null => {
      const prediction = item.placePrediction;
      if (!prediction?.placeId) return null;

      // `text` is Google's full one-line prediction, already formatted the
      // way the dropdown wants it. `mainText` is the street on its own.
      const label =
        prediction.text?.text ??
        [
          prediction.structuredFormat?.mainText?.text,
          prediction.structuredFormat?.secondaryText?.text,
        ]
          .filter(Boolean)
          .join(", ");
      const primary =
        prediction.structuredFormat?.mainText?.text ?? label.split(",")[0] ?? "";
      if (!label) return null;

      return {
        id: `${prediction.placeId}:${index}`,
        label,
        primary,
        placeId: prediction.placeId,
      };
    })
    .filter((item): item is AddressSuggestion => item !== null);
}

function post(body: unknown, signal?: AbortSignal) {
  return fetch(AUTOCOMPLETE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey(),
    },
    body: JSON.stringify(body),
    signal: signal ?? AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
}

interface GoogleAddressComponent {
  longText?: string;
  shortText?: string;
  types?: string[];
}

function componentValue(
  components: GoogleAddressComponent[],
  type: string,
  prefer: "long" | "short" = "long",
): string {
  const match = components.find((component) => component.types?.includes(type));
  if (!match) return "";
  return (prefer === "short" ? match.shortText : match.longText) ?? "";
}

function toResolved(
  components: GoogleAddressComponent[],
  formattedAddress: string,
  latitude: number,
  longitude: number,
): ResolvedAddress {
  const streetNumber = componentValue(components, "street_number");
  const route = componentValue(components, "route");

  // Google spreads the locality across different component types depending on
  // the country and the density of the area.
  const city =
    componentValue(components, "locality") ||
    componentValue(components, "postal_town") ||
    componentValue(components, "sublocality_level_1") ||
    componentValue(components, "sublocality") ||
    componentValue(components, "administrative_area_level_3");

  return {
    formattedAddress,
    addressLine1: [streetNumber, route].filter(Boolean).join(" ") || formattedAddress,
    city,
    // shortText gives "NY" rather than "New York", which is what a state box wants.
    state: componentValue(components, "administrative_area_level_1", "short"),
    postalCode: componentValue(components, "postal_code"),
    latitude,
    longitude,
  };
}

/**
 * Turn a prediction into a full address.
 *
 * Passing the same sessionToken used for the keystrokes closes the Places
 * session: Google then bills the session once here instead of billing every
 * autocomplete request that led to it.
 */
export async function resolve(
  placeId: string,
  sessionToken?: string,
  signal?: AbortSignal,
): Promise<ResolvedAddress | null> {
  const url = new URL(`${DETAILS_URL}/${encodeURIComponent(placeId)}`);
  if (sessionToken) url.searchParams.set("sessionToken", sessionToken);

  const response = await fetch(url, {
    headers: {
      "X-Goog-Api-Key": apiKey(),
      // Field masks are mandatory on this endpoint and control what is
      // billed — asking for less costs less.
      "X-Goog-FieldMask": "formattedAddress,addressComponents,location",
    },
    signal: signal ?? AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });

  if (!response.ok) return null;

  const payload = (await response.json()) as {
    formattedAddress?: string;
    addressComponents?: GoogleAddressComponent[];
    location?: { latitude?: number; longitude?: number };
  };

  const latitude = payload.location?.latitude;
  const longitude = payload.location?.longitude;
  if (typeof latitude !== "number" || typeof longitude !== "number") return null;

  return toResolved(
    payload.addressComponents ?? [],
    payload.formattedAddress ?? "",
    latitude,
    longitude,
  );
}

/**
 * Region types that mean Google could not place the address and fell back to
 * the enclosing area.
 *
 * This is a deny-list, not an allow-list. An allow-list looks safer but is
 * wrong here: a laundromat's own address is frequently a named business, which
 * Google types `establishment` / `point_of_interest`, and enumerating every
 * acceptable type would quietly reject the owner's own shop.
 */
const COARSE_TYPES = new Set([
  "country",
  "continent",
  "archipelago",
  "administrative_area_level_1", // state
  "administrative_area_level_2", // county
  "political", // never meaningful on its own
]);

/**
 * Accept unless *every* type is a coarse region. "United States" is
 * [country, political] and gets rejected; "Times Square" is
 * [establishment, point_of_interest, tourist_attraction] and does not.
 */
function isPreciseEnough(types?: string[]): boolean {
  if (!types || types.length === 0) return false;
  return !types.every((type) => COARSE_TYPES.has(type));
}

/** Free-form address to coordinates, for submit-time verification. */
export async function geocode(address: string): Promise<GeocodeResult> {
  const url = new URL(GEOCODE_URL);
  url.searchParams.set("address", address);
  url.searchParams.set("key", apiKey());
  if (isCountryRestricted) {
    // `region` only biases results; `components=country:` is the hard filter.
    // Using the wrong one here is how a London address slips through a
    // US-only service area.
    url.searchParams.set(
      "components",
      COUNTRY_CODES.map((code) => `country:${code.toUpperCase()}`).join("|"),
    );
  }

  debugPlaces("google.geocode", url.toString().replace(apiKey(), "<key>"));

  let payload: {
    status?: string;
    results?: Array<{
      formatted_address?: string;
      types?: string[];
      partial_match?: boolean;
      geometry?: { location?: { lat?: number; lng?: number } };
    }>;
  };

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) {
      throw new GeocodeError(
        "We could not verify that address right now. Please try again.",
        "unavailable",
      );
    }
    payload = await response.json();
  } catch (error) {
    if (error instanceof GeocodeError) throw error;
    throw new GeocodeError(
      "We could not reach the address lookup service. Please try again.",
      "unavailable",
    );
  }

  // Status must be checked BEFORE the results array, and the two must not be
  // collapsed. REQUEST_DENIED and OVER_QUERY_LIMIT also come back with no
  // results, so treating "no results" as not_found first would report an
  // operator outage as "we could not find that address" — telling every
  // customer their home does not exist, and suppressing the fallback to the
  // other provider, because not_found is deliberately not retried.
  if (payload.status !== "OK") {
    if (payload.status === "ZERO_RESULTS") {
      throw new GeocodeError(
        "We could not find that address. Please check the street, city, and ZIP code.",
        "not_found",
      );
    }
    // REQUEST_DENIED, OVER_QUERY_LIMIT, INVALID_REQUEST, UNKNOWN_ERROR — all
    // operator problems, none of which the customer can act on.
    throw new GeocodeError(
      "We could not verify that address right now. Please try again.",
      "unavailable",
    );
  }

  if (!payload.results?.length) {
    throw new GeocodeError(
      "We could not find that address. Please check the street, city, and ZIP code.",
      "not_found",
    );
  }

  const best = payload.results[0];

  // Google answers almost anything. "asdkjhasd nowhere at all 99999" comes
  // back status OK, formatted_address "United States" — the centroid of the
  // country, typed as `country`. Accepting that would geocode nonsense to a
  // real point and then measure a service-area distance from it, which is how
  // a garbage address ends up looking like a valid customer. Require the
  // match to be at least locality-precise.
  if (!isPreciseEnough(best.types)) {
    throw new GeocodeError(
      "We could not find that address. Please check the street, city, and ZIP code.",
      "not_found",
    );
  }

  const result: GeocodeResult = {
    latitude: best.geometry?.location?.lat ?? Number.NaN,
    longitude: best.geometry?.location?.lng ?? Number.NaN,
    formattedAddress: best.formatted_address?.trim() || address,
  };

  if (!isValidCoordinates(result)) {
    throw new GeocodeError(
      "The address lookup returned an invalid location. Please try again.",
      "unavailable",
    );
  }

  return result;
}
