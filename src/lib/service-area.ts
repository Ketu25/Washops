import "server-only";

import { composeAddress, geocodeAddress, GeocodeError } from "./places";
import { formatMiles, haversineMiles } from "./geo";
import { getSettings } from "./settings";
import type { SettingsRow } from "./types";

export interface AddressInput {
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  postalCode: string;
}

export interface InRangeResult {
  covered: true;
  distanceMiles: number;
  radiusMiles: number;
  latitude: number;
  longitude: number;
  formattedAddress: string;
  laundromatName: string;
}

export interface OutOfRangeResult {
  covered: false;
  reason: "out_of_range";
  message: string;
  distanceMiles: number;
  radiusMiles: number;
  latitude: number;
  longitude: number;
  formattedAddress: string;
  laundromatName: string;
}

export interface UnavailableResult {
  covered: false;
  reason: "not_configured" | "geocode_failed";
  message: string;
}

export type CoverageResult =
  | InRangeResult
  | OutOfRangeResult
  | UnavailableResult;

/**
 * Distance readings are quoted to one decimal place, so a point sitting a
 * hair over the boundary would otherwise be told "5.0 miles away; the limit
 * is 5 miles" — a message that reads like a bug. Allowing a ~26ft tolerance
 * makes the number the customer sees agree with the decision we made.
 */
const BOUNDARY_TOLERANCE_MILES = 0.005;

export function checkDistanceAgainstSettings(
  distanceMiles: number,
  settings: Pick<SettingsRow, "service_radius_miles">,
): boolean {
  return distanceMiles <= settings.service_radius_miles + BOUNDARY_TOLERANCE_MILES;
}

/**
 * Geocode an address and decide whether it falls inside the configured
 * service radius. This is the single chokepoint every registration, address
 * update, and new request goes through.
 */
export async function checkCoverage(
  address: AddressInput,
): Promise<CoverageResult> {
  const settings = await getSettings();

  if (!settings) {
    return {
      covered: false,
      reason: "not_configured",
      message:
        "The laundromat has not published its service area yet. Please check back shortly.",
    };
  }

  let geocoded;
  try {
    geocoded = await geocodeAddress(composeAddress(address));
  } catch (error) {
    return {
      covered: false,
      reason: "geocode_failed",
      message:
        error instanceof GeocodeError
          ? error.message
          : "We could not verify that address. Please try again.",
    };
  }

  const distanceMiles = haversineMiles(
    { latitude: settings.latitude, longitude: settings.longitude },
    geocoded,
  );

  const shared = {
    distanceMiles,
    radiusMiles: settings.service_radius_miles,
    latitude: geocoded.latitude,
    longitude: geocoded.longitude,
    formattedAddress: geocoded.formattedAddress,
    laundromatName: settings.name,
  };

  if (!checkDistanceAgainstSettings(distanceMiles, settings)) {
    return {
      covered: false,
      reason: "out_of_range",
      message: outOfRangeMessage(distanceMiles, settings.service_radius_miles),
      ...shared,
    };
  }

  return { covered: true, ...shared };
}

export function outOfRangeMessage(
  distanceMiles: number,
  radiusMiles: number,
): string {
  return (
    `Your address is ${formatMiles(distanceMiles)} miles away; ` +
    `our service limit is ${formatMiles(radiusMiles)} miles. ` +
    `We are not able to schedule pickups or drop-offs at this location.`
  );
}
