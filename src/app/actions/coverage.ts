"use server";

import { formatMiles, haversineMiles } from "@/lib/geo";
import { geocodeAddress, GeocodeError } from "@/lib/places";
import { checkDistanceAgainstSettings, outOfRangeMessage } from "@/lib/service-area";
import { getSettings } from "@/lib/settings";

export interface CoverageState {
  status: "idle" | "covered" | "out_of_range" | "error";
  message?: string;
  distanceMiles?: number;
  radiusMiles?: number;
  matchedAddress?: string;
  address?: string;
}

/**
 * Public, unauthenticated coverage lookup for the home page.
 *
 * This takes a single free-form address line rather than the structured form
 * used at registration — visitors checking "do you serve me?" should not have
 * to fill in five fields before getting an answer.
 */
export async function checkCoverageAction(
  _prev: CoverageState,
  formData: FormData,
): Promise<CoverageState> {
  const address = String(formData.get("address") ?? "").trim();

  if (address.length < 5) {
    return {
      status: "error",
      message: "Enter a full address including city and ZIP code.",
      address,
    };
  }

  const settings = await getSettings();
  if (!settings) {
    return {
      status: "error",
      message:
        "The laundromat has not published its service area yet. Please check back shortly.",
      address,
    };
  }

  let geocoded;
  try {
    geocoded = await geocodeAddress(address);
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof GeocodeError
          ? error.message
          : "We could not verify that address. Please try again.",
      address,
    };
  }

  const distanceMiles = haversineMiles(
    { latitude: settings.latitude, longitude: settings.longitude },
    geocoded,
  );

  const shared = {
    distanceMiles,
    radiusMiles: settings.service_radius_miles,
    matchedAddress: geocoded.formattedAddress,
    address,
  };

  if (!checkDistanceAgainstSettings(distanceMiles, settings)) {
    return {
      status: "out_of_range",
      message: outOfRangeMessage(distanceMiles, settings.service_radius_miles),
      ...shared,
    };
  }

  return {
    status: "covered",
    message: `Good news — you are ${formatMiles(
      distanceMiles,
    )} miles from ${settings.name}, inside our ${formatMiles(
      settings.service_radius_miles,
    )} mile service area.`,
    ...shared,
  };
}
