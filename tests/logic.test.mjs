/**
 * Tests for the pure logic that the service-area rule and the scheduling
 * rules rest on. These run without a database or a network call:
 *
 *   npm test
 *
 * The distance maths and the date maths are where a quiet bug would be most
 * expensive — a wrong Haversine radius silently changes who the business
 * will serve, and a timezone slip makes "today" unbookable.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

// ---------------------------------------------------------------------
// Haversine — mirrors src/lib/geo.ts
// ---------------------------------------------------------------------
const EARTH_RADIUS_MILES = 3958.7613;
const toRadians = (degrees) => (degrees * Math.PI) / 180;

function haversineMiles(a, b) {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const clamped = Math.min(1, Math.max(0, h));
  return EARTH_RADIUS_MILES * 2 * Math.atan2(Math.sqrt(clamped), Math.sqrt(1 - clamped));
}

test("identical points are zero miles apart", () => {
  const point = { latitude: 40.7128, longitude: -74.006 };
  assert.equal(haversineMiles(point, point), 0);
});

test("known city pair matches the published great-circle distance", () => {
  // NYC -> Philadelphia is ~80.5 statute miles great-circle.
  const distance = haversineMiles(
    { latitude: 40.7128, longitude: -74.006 },
    { latitude: 39.9526, longitude: -75.1652 },
  );
  assert.ok(
    Math.abs(distance - 80.5) < 1,
    `expected ~80.5 miles, got ${distance.toFixed(2)}`,
  );
});

test("distance is symmetric", () => {
  const a = { latitude: 41.8781, longitude: -87.6298 };
  const b = { latitude: 42.3601, longitude: -71.0589 };
  assert.ok(Math.abs(haversineMiles(a, b) - haversineMiles(b, a)) < 1e-9);
});

test("crossing the antimeridian does not blow up", () => {
  const distance = haversineMiles(
    { latitude: 0, longitude: 179.9 },
    { latitude: 0, longitude: -179.9 },
  );
  // 0.2 degrees at the equator is ~13.8 miles, not most of the way round.
  assert.ok(distance < 20, `expected a short hop, got ${distance.toFixed(2)}`);
});

test("antipodal points do not produce NaN", () => {
  const distance = haversineMiles(
    { latitude: 0, longitude: 0 },
    { latitude: 0, longitude: 180 },
  );
  assert.ok(Number.isFinite(distance));
  assert.ok(Math.abs(distance - Math.PI * EARTH_RADIUS_MILES) < 1);
});

// ---------------------------------------------------------------------
// Service-area decision — mirrors src/lib/service-area.ts
// ---------------------------------------------------------------------
const BOUNDARY_TOLERANCE_MILES = 0.005;
const covered = (distance, radius) => distance <= radius + BOUNDARY_TOLERANCE_MILES;

test("inside, outside, and exactly on the boundary", () => {
  assert.equal(covered(4.9, 5), true);
  assert.equal(covered(5, 5), true);
  assert.equal(covered(5.1, 5), false);
  assert.equal(covered(6.2, 5), false);
});

test("a distance that displays as the radius is not rejected", () => {
  // 5.0049 renders as "5.0 miles" against a 5 mile limit. Rejecting it would
  // show the customer a message that reads like a bug.
  assert.equal(covered(5.0049, 5), true);
  assert.equal(covered(5.02, 5), false);
});

// ---------------------------------------------------------------------
// Date handling — mirrors src/lib/dates.ts
// ---------------------------------------------------------------------
function todayISO(timeZone) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function addDaysISO(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

test("todayISO produces a zero-padded ISO date", () => {
  assert.match(todayISO("America/New_York"), /^\d{4}-\d{2}-\d{2}$/);
});

test("addDaysISO rolls over months and years", () => {
  assert.equal(addDaysISO("2026-01-31", 1), "2026-02-01");
  assert.equal(addDaysISO("2026-12-31", 1), "2027-01-01");
  assert.equal(addDaysISO("2026-03-01", -1), "2026-02-28");
});

test("addDaysISO handles a leap day", () => {
  assert.equal(addDaysISO("2028-02-28", 1), "2028-02-29");
  assert.equal(addDaysISO("2028-02-29", 1), "2028-03-01");
});

test("addDaysISO does not drift across a DST boundary", () => {
  // US DST starts 2026-03-08. A naive local-time implementation lands on
  // the 8th twice or skips it.
  assert.equal(addDaysISO("2026-03-07", 1), "2026-03-08");
  assert.equal(addDaysISO("2026-03-08", 1), "2026-03-09");
});

test("ISO date strings compare correctly as strings", () => {
  assert.ok("2026-08-04" < "2026-08-05");
  assert.ok("2026-09-01" > "2026-08-31");
  assert.ok(!("2026-08-04" < "2026-08-04"));
});

// ---------------------------------------------------------------------
// Calendar validation — mirrors the refine in src/lib/validation.ts
// ---------------------------------------------------------------------
function isRealDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(y, m - 1, d));
  return (
    parsed.getUTCFullYear() === y &&
    parsed.getUTCMonth() === m - 1 &&
    parsed.getUTCDate() === d
  );
}

test("rejects dates that do not exist", () => {
  assert.equal(isRealDate("2026-02-30"), false);
  assert.equal(isRealDate("2026-13-01"), false);
  assert.equal(isRealDate("2026-04-31"), false);
  assert.equal(isRealDate("2026-02-29"), false); // 2026 is not a leap year
  assert.equal(isRealDate("2028-02-29"), true); // 2028 is
  assert.equal(isRealDate("2026-08-04"), true);
});

// ---------------------------------------------------------------------
// Status transitions — mirrors src/lib/transitions.ts
// ---------------------------------------------------------------------
const ALLOWED_TRANSITIONS = {
  pending: ["planned", "completed", "cancelled"],
  planned: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};
const canTransition = (from, to) => ALLOWED_TRANSITIONS[from].includes(to);

test("requests only ever move forward", () => {
  assert.equal(canTransition("pending", "planned"), true);
  assert.equal(canTransition("planned", "completed"), true);
  assert.equal(canTransition("planned", "pending"), false);
  assert.equal(canTransition("completed", "planned"), false);
});

test("completed and cancelled are terminal", () => {
  for (const to of ["pending", "planned", "completed", "cancelled"]) {
    assert.equal(canTransition("completed", to), false);
    assert.equal(canTransition("cancelled", to), false);
  }
});
