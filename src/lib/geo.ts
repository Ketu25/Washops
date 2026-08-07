const EARTH_RADIUS_MILES = 3958.7613;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Great-circle distance in miles between two points (Haversine).
 *
 * Uses atan2 rather than asin so the result stays numerically stable for
 * antipodal points, and clamps the intermediate term to guard against a
 * value drifting a hair above 1 through floating-point error.
 */
export function haversineMiles(a: Coordinates, b: Coordinates): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  const clamped = Math.min(1, Math.max(0, h));
  const c = 2 * Math.atan2(Math.sqrt(clamped), Math.sqrt(1 - clamped));

  return EARTH_RADIUS_MILES * c;
}

/** Distances are quoted to one decimal everywhere in the UI. */
export function formatMiles(miles: number): string {
  return miles.toFixed(1);
}

export function isValidCoordinates(value: unknown): value is Coordinates {
  if (typeof value !== "object" || value === null) return false;
  const { latitude, longitude } = value as Partial<Coordinates>;
  return (
    typeof latitude === "number" &&
    Number.isFinite(latitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    typeof longitude === "number" &&
    Number.isFinite(longitude) &&
    longitude >= -180 &&
    longitude <= 180
  );
}
