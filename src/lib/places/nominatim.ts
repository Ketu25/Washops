import "server-only";

import { env } from "../env";
import { GeocodeError, type GeocodeResult } from "../geocode-error";
import { isValidCoordinates } from "../geo";
import { COUNTRY_CODES, debugPlaces, isCountryRestricted } from "./region";
import type {
  AddressSuggestion,
  ResolvedAddress,
  SuggestOptions,
  SuggestScope,
} from "./types";

const SEARCH_URL = "https://nominatim.openstreetmap.org/search";
const TIMEOUT_MS = 10_000;

/**
 * Nominatim's usage policy caps us at one request per second from a single
 * source. Chaining every lookup onto a shared promise serialises concurrent
 * callers instead of letting a burst get us rate-limited or banned.
 */
const MIN_INTERVAL_MS = 1_100;
let queue: Promise<unknown> = Promise.resolve();
let lastRequestAt = 0;

function schedule<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const waitFor = lastRequestAt + MIN_INTERVAL_MS - Date.now();
    if (waitFor > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitFor));
    }
    lastRequestAt = Date.now();
    return task();
  });
  queue = run.catch(() => undefined);
  return run;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 500;
const cache = new Map<string, { value: GeocodeResult; expiresAt: number }>();

function readCache(key: string): GeocodeResult | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  cache.delete(key);
  cache.set(key, hit);
  return hit.value;
}

function writeCache(key: string, value: GeocodeResult) {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

interface NominatimAddress {
  house_number?: string;
  road?: string;
  pedestrian?: string;
  city?: string;
  town?: string;
  village?: string;
  hamlet?: string;
  municipality?: string;
  suburb?: string;
  city_district?: string;
  county?: string;
  state?: string;
  "ISO3166-2-lvl4"?: string;
  postcode?: string;
  country?: string;
}

interface NominatimHit {
  lat?: string;
  lon?: string;
  display_name?: string;
  name?: string;
  address?: NominatimAddress;
}

function pickCity(address: NominatimAddress): string {
  return (
    address.city ||
    address.town ||
    address.village ||
    address.municipality ||
    address.hamlet ||
    address.city_district ||
    address.suburb ||
    ""
  );
}

function pickState(address: NominatimAddress): string {
  const iso = address["ISO3166-2-lvl4"];
  if (iso && iso.includes("-")) return iso.split("-")[1];
  return address.state ?? "";
}

function toResolved(hit: NominatimHit): ResolvedAddress | null {
  const latitude = Number.parseFloat(hit.lat ?? "");
  const longitude = Number.parseFloat(hit.lon ?? "");
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const address = hit.address ?? {};
  const street = [address.house_number, address.road || address.pedestrian]
    .filter(Boolean)
    .join(" ");

  return {
    formattedAddress: hit.display_name?.trim() ?? "",
    addressLine1: street,
    city: pickCity(address),
    state: pickState(address),
    postalCode: address.postcode ?? "",
    latitude,
    longitude,
  };
}

/**
 * Nominatim's display_name is an administrative dump — "Empire State Building,
 * 350, 5th Avenue, Koreatown, Manhattan Community Board 5, Manhattan, New York
 * County, New York, 10118, United States". Rebuilding the two lines from the
 * structured components instead gets it close to what a maps autocomplete
 * shows, though it will never match Google for street-level coverage.
 */
function toSuggestion(
  hit: NominatimHit,
  index: number,
  scope: SuggestScope,
): AddressSuggestion | null {
  const resolved = toResolved(hit);
  if (!resolved) return null;

  const country = countryLabel(hit.address?.country);
  const street = resolved.addressLine1 || hit.name?.trim() || "";

  // Each scope owns a different part of the address, so the label and the
  // value written back into the field both depend on it. Building one generic
  // line instead produces "Chicago, Chicago, IL" on the city field and
  // "10118, New York, NY" on the ZIP field.
  let primary: string;
  let parts: Array<string | undefined>;

  switch (scope) {
    case "city":
      primary = resolved.city || street;
      parts = [primary, resolved.state, country];
      break;
    case "state":
      primary = resolved.state || street;
      parts = [primary, country];
      break;
    case "postcode":
      primary = resolved.postalCode || street;
      parts = [
        resolved.city,
        [resolved.state, primary].filter(Boolean).join(" "),
        country,
      ];
      break;
    default:
      primary = street;
      parts = [primary, resolved.city, resolved.state, country];
  }

  if (!primary) return null;

  // Guard against a component repeating itself — a city whose name matches its
  // county, for instance.
  const seen = new Set<string>();
  const label = parts
    .filter((part): part is string => Boolean(part && part.trim()))
    .filter((part) => {
      const key = part.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join(", ");

  // The dropdown row and the resolved address are deliberately different, the
  // same way Google's are: the prediction row stays short and scannable
  // ("350 5th Avenue, New York, NY, USA") while the address written into the
  // field carries the ZIP, which the submit-time geocode needs to pin down the
  // right street.
  const formattedAddress =
    scope === "address"
      ? [
          street,
          resolved.city,
          [resolved.state, resolved.postalCode].filter(Boolean).join(" "),
          country,
        ]
          .filter(Boolean)
          .join(", ")
      : label;

  return {
    id: `${resolved.latitude},${resolved.longitude},${index}`,
    label,
    primary,
    // Nominatim returns everything in one call, so there is nothing further
    // to look up when the user picks a row.
    resolved: { ...resolved, formattedAddress },
  };
}

/** "United States" is what OSM says; "USA" is what an address line says. */
function countryLabel(country?: string): string {
  if (!country) return "";
  return country === "United States" ? "USA" : country;
}

const FEATURE_TYPE: Partial<Record<SuggestScope, string>> = {
  city: "city",
  state: "state",
};

export async function suggest(
  query: string,
  options: SuggestOptions,
  origin?: { latitude: number; longitude: number },
): Promise<AddressSuggestion[]> {
  const url = new URL(SEARCH_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "6");

  const featureType = FEATURE_TYPE[options.scope];
  if (featureType) url.searchParams.set("featureType", featureType);

  if (isCountryRestricted) {
    url.searchParams.set("countrycodes", COUNTRY_CODES.join(","));
  }

  if (origin) {
    const pad = 1.0;
    url.searchParams.set(
      "viewbox",
      `${origin.longitude - pad},${Math.min(90, origin.latitude + pad)},` +
        `${origin.longitude + pad},${Math.max(-90, origin.latitude - pad)}`,
    );
    url.searchParams.set("bounded", "0");
  }

  debugPlaces("nominatim.suggest", url.toString());

  if (options.signal?.aborted) return [];

  const response = await schedule(async () => {
    if (options.signal?.aborted) return null;
    return fetch(url, {
      headers: {
        "User-Agent": env.geocoderUserAgent,
        Accept: "application/json",
      },
      signal: options.signal ?? AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  });

  if (!response || !response.ok) return [];

  const payload = (await response.json()) as NominatimHit[];
  if (!Array.isArray(payload)) return [];

  // Nominatim returns one row per feature, so a single street address can
  // come back several times over — once for the building, once for a business
  // inside it, once for a radio station licensed there. Dropping the POI name
  // to get a clean label makes those collapse into visually identical rows,
  // so collapse them for real.
  const seen = new Set<string>();
  return payload
    .map((hit, index) => toSuggestion(hit, index, options.scope))
    .filter((item): item is AddressSuggestion => item !== null)
    .filter((item) => {
      const key = item.label.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export async function geocode(address: string): Promise<GeocodeResult> {
  const key = address.trim().toLowerCase().replace(/\s+/g, " ");
  const cached = readCache(key);
  if (cached) return cached;

  const url = new URL(SEARCH_URL);
  url.searchParams.set("q", address.trim());
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "0");
  if (isCountryRestricted) {
    url.searchParams.set("countrycodes", COUNTRY_CODES.join(","));
  }

  debugPlaces("nominatim.geocode", url.toString());

  let payload: NominatimHit[];
  try {
    const response = await schedule(() =>
      fetch(url, {
        headers: {
          "User-Agent": env.geocoderUserAgent,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      }),
    );

    if (response.status === 429 || response.status === 503) {
      throw new GeocodeError(
        "The address lookup service is busy. Please try again in a moment.",
        "unavailable",
      );
    }
    if (!response.ok) {
      throw new GeocodeError(
        "We could not verify that address right now. Please try again.",
        "unavailable",
      );
    }
    payload = (await response.json()) as NominatimHit[];
  } catch (error) {
    if (error instanceof GeocodeError) throw error;
    throw new GeocodeError(
      "We could not reach the address lookup service. Please try again.",
      "unavailable",
    );
  }

  const hit = Array.isArray(payload) ? payload[0] : undefined;
  if (!hit?.lat || !hit?.lon) {
    throw new GeocodeError(
      "We could not find that address. Please check the street, city, and ZIP code.",
      "not_found",
    );
  }

  const result: GeocodeResult = {
    latitude: Number.parseFloat(hit.lat),
    longitude: Number.parseFloat(hit.lon),
    formattedAddress: hit.display_name?.trim() || address.trim(),
  };

  if (!isValidCoordinates(result)) {
    throw new GeocodeError(
      "The address lookup returned an invalid location. Please try again.",
      "unavailable",
    );
  }

  writeCache(key, result);
  return result;
}
