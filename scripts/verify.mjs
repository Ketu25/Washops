#!/usr/bin/env node
/**
 * End-to-end verification against the live database.
 *
 * Exercises the real rules — service-area enforcement, the duplicate guard,
 * status transitions, ownership on cancel — through the same libraries the
 * app uses, then cleans up after itself.
 *
 *   npm run verify
 */

import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import ws from "ws";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing Supabase env vars. Check .env.local.");
  process.exit(1);
}

const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
  // Node 20 has no global WebSocket; supabase-js builds a realtime client
  // regardless, so give it a transport.
  realtime: { transport: ws },
});

let passed = 0;
let failed = 0;

function check(label, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${label}`);
  } else {
    failed += 1;
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function section(title) {
  console.log(`\n${title}`);
}

// Haversine, mirroring src/lib/geo.ts
const EARTH_RADIUS_MILES = 3958.7613;
const rad = (d) => (d * Math.PI) / 180;
function haversineMiles(a, b) {
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  const c = Math.min(1, Math.max(0, h));
  return EARTH_RADIUS_MILES * 2 * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c));
}

const stamp = Date.now();
const NEAR_EMAIL = `verify-near-${stamp}@example.test`;
const FAR_EMAIL = `verify-far-${stamp}@example.test`;
const OTHER_EMAIL = `verify-other-${stamp}@example.test`;

// Times Square as the shop; a nearby block and a far-away point as customers.
const SHOP = { latitude: 40.758, longitude: -73.9855 };
const NEAR = { latitude: 40.7484, longitude: -73.9857 }; // Empire State, ~0.66 mi
const FAR = { latitude: 40.6892, longitude: -74.0445 }; // Liberty Island, ~5.9 mi
const RADIUS = 5;


/**
 * The settings row is a singleton the owner actually relies on. These scripts
 * point it at a test location, so snapshot it first and put it back in the
 * finally block — otherwise running the suite silently reconfigures a live
 * laundromat's service area.
 */
let settingsSnapshot = null;
async function snapshotSettings() {
  const { data } = await db
    .from("laundromat_settings")
    .select("*")
    .eq("id", true)
    .maybeSingle();
  settingsSnapshot = data ?? null;
}
async function restoreSettings() {
  if (settingsSnapshot) {
    await db.from("laundromat_settings").upsert(settingsSnapshot, { onConflict: "id" });
  } else {
    await db.from("laundromat_settings").delete().eq("id", true);
  }

  // Putting the row back is not enough. Moving the shop recomputes every
  // customer's distance_miles (updateSettingsAction does this deliberately),
  // so restoring the address without recomputing leaves every customer
  // measured against the TEST location — which then shows up as a nonsense
  // distance in the admin queue and can wrongly mark people out of range.
  if (!settingsSnapshot) return;
  const { data: customers } = await db
    .from("users")
    .select("id, latitude, longitude")
    .eq("role", "customer")
    .not("latitude", "is", null);

  const R = 3958.7613;
  const rad = (d) => (d * Math.PI) / 180;
  for (const c of customers ?? []) {
    const dLat = rad(c.latitude - settingsSnapshot.latitude);
    const dLon = rad(c.longitude - settingsSnapshot.longitude);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(rad(settingsSnapshot.latitude)) *
        Math.cos(rad(c.latitude)) *
        Math.sin(dLon / 2) ** 2;
    const miles = R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
    await db.from("users").update({ distance_miles: miles }).eq("id", c.id);
  }
}

const createdUsers = [];
const createdRequests = [];

async function cleanup() {
  if (createdRequests.length) {
    await db.from("requests").delete().in("id", createdRequests);
  }
  if (createdUsers.length) {
    await db.from("users").delete().in("id", createdUsers);
  }
}

try {
  await snapshotSettings();

  section("Schema");
  for (const table of ["users", "laundromat_settings", "requests"]) {
    const { error } = await db.from(table).select("*", { head: true, count: "exact" });
    check(`table ${table} exists`, !error, error?.message);
  }
  if (failed) throw new Error("Schema missing — run supabase/schema.sql first.");

  section("Settings singleton");
  const { error: settingsError } = await db.from("laundromat_settings").upsert(
    {
      id: true,
      name: "Verify Laundromat",
      address: "Times Square, New York, NY",
      formatted_address: "Times Square, Manhattan, New York, NY, USA",
      latitude: SHOP.latitude,
      longitude: SHOP.longitude,
      service_radius_miles: RADIUS,
    },
    { onConflict: "id" },
  );
  check("settings row upserts", !settingsError, settingsError?.message);

  const { error: secondRowError } = await db
    .from("laundromat_settings")
    .insert({
      id: false,
      name: "Impostor",
      address: "x",
      latitude: 0,
      longitude: 0,
      service_radius_miles: 1,
    });
  check("a second settings row is rejected", Boolean(secondRowError));

  section("Service area (Haversine)");
  const nearDistance = haversineMiles(SHOP, NEAR);
  const farDistance = haversineMiles(SHOP, FAR);
  check(
    `nearby address is inside ${RADIUS} mi (${nearDistance.toFixed(2)})`,
    nearDistance <= RADIUS,
  );
  check(
    `far address is outside ${RADIUS} mi (${farDistance.toFixed(2)})`,
    farDistance > RADIUS,
  );

  section("Users");
  const hash = await bcrypt.hash("verify-password-123", 12);
  const baseUser = {
    password_hash: hash,
    role: "customer",
    address_line1: "20 W 34th St",
    city: "New York",
    state: "NY",
    postal_code: "10001",
  };

  const { data: nearUser, error: nearUserError } = await db
    .from("users")
    .insert({
      ...baseUser,
      email: NEAR_EMAIL,
      full_name: "Near Customer",
      latitude: NEAR.latitude,
      longitude: NEAR.longitude,
      distance_miles: nearDistance,
    })
    .select("id")
    .single();
  check("in-range customer created", !nearUserError, nearUserError?.message);
  if (nearUser) createdUsers.push(nearUser.id);

  const { data: otherUser } = await db
    .from("users")
    .insert({
      ...baseUser,
      email: OTHER_EMAIL,
      full_name: "Other Customer",
      latitude: NEAR.latitude,
      longitude: NEAR.longitude,
      distance_miles: nearDistance,
    })
    .select("id")
    .single();
  if (otherUser) createdUsers.push(otherUser.id);

  const { error: dupeEmailError } = await db.from("users").insert({
    ...baseUser,
    email: NEAR_EMAIL.toUpperCase(),
    full_name: "Duplicate",
    latitude: NEAR.latitude,
    longitude: NEAR.longitude,
    distance_miles: nearDistance,
  });
  check(
    "duplicate email is rejected case-insensitively",
    dupeEmailError?.code === "23505",
    dupeEmailError?.message,
  );

  const { error: noAddressError } = await db.from("users").insert({
    ...baseUser,
    email: FAR_EMAIL,
    full_name: "No Address",
    address_line1: null,
    latitude: null,
    longitude: null,
  });
  check(
    "customer without a geocoded address is rejected",
    Boolean(noAddressError),
    noAddressError?.message,
  );

  section("Requests");
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: process.env.NEXT_PUBLIC_APP_TIMEZONE || "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const requestBase = {
    user_id: nearUser.id,
    scheduled_date: today,
    time_window: "10:00 - 12:00",
    address_line1: "20 W 34th St",
    city: "New York",
    state: "NY",
    postal_code: "10001",
    latitude: NEAR.latitude,
    longitude: NEAR.longitude,
    distance_miles: nearDistance,
  };

  const { data: pickup, error: pickupError } = await db
    .from("requests")
    .insert({ ...requestBase, type: "pickup" })
    .select("id, status")
    .single();
  check("pickup request created", !pickupError, pickupError?.message);
  if (pickup) createdRequests.push(pickup.id);
  check("new request defaults to pending", pickup?.status === "pending");

  const { error: dupeError } = await db
    .from("requests")
    .insert({ ...requestBase, type: "pickup" });
  check(
    "second open pickup same day is rejected",
    dupeError?.code === "23505",
    dupeError?.message,
  );

  section("Drop-offs belong to a pickup");
  const { data: dropoff, error: dropoffError } = await db
    .from("requests")
    .insert({
      ...requestBase,
      type: "dropoff",
      parent_pickup_id: pickup.id,
      status: "planned",
    })
    .select("id")
    .single();
  check(
    "a drop-off linked to the pickup is allowed on the same day",
    !dropoffError,
    dropoffError?.message,
  );
  if (dropoff) createdRequests.push(dropoff.id);

  const { error: secondDropoff } = await db.from("requests").insert({
    ...requestBase,
    type: "dropoff",
    parent_pickup_id: pickup.id,
    status: "planned",
    scheduled_date: "2030-06-01",
  });
  check(
    "a second live drop-off for the same pickup is rejected",
    secondDropoff?.code === "23505",
    secondDropoff?.message,
  );

  const { error: pickupWithParent } = await db.from("requests").insert({
    ...requestBase,
    type: "pickup",
    parent_pickup_id: pickup.id,
    scheduled_date: "2030-06-02",
  });
  check(
    "a pickup cannot be given a parent",
    Boolean(pickupWithParent),
    pickupWithParent?.message,
  );

  const { error: badStatusError } = await db
    .from("requests")
    .insert({ ...requestBase, type: "pickup", scheduled_date: "2030-01-01", status: "shipped" });
  check("an unknown status is rejected", Boolean(badStatusError));

  // Two pickups completed in the same week may legitimately be returned on
  // one day; the per-day guard must not block that.
  const { data: otherPickup } = await db
    .from("requests")
    .insert({ ...requestBase, type: "pickup", scheduled_date: "2030-03-01", status: "completed" })
    .select("id")
    .single();
  if (otherPickup) createdRequests.push(otherPickup.id);
  const { data: sameDayReturn, error: sameDayError } = await db
    .from("requests")
    .insert({
      ...requestBase,
      type: "dropoff",
      parent_pickup_id: otherPickup.id,
      status: "planned",
    })
    .select("id")
    .single();
  check(
    "two drop-offs on one day for different pickups are allowed",
    !sameDayError,
    sameDayError?.message,
  );
  if (sameDayReturn) createdRequests.push(sameDayReturn.id);

  section("Status transitions");
  const { data: planned } = await db
    .from("requests")
    .update({ status: "planned", planned_at: new Date().toISOString() })
    .eq("id", pickup.id)
    .eq("status", "pending")
    .select("id, status")
    .maybeSingle();
  check("pending -> planned succeeds", planned?.status === "planned");

  const { data: replay } = await db
    .from("requests")
    .update({ status: "planned" })
    .eq("id", pickup.id)
    .eq("status", "pending")
    .select("id");
  check(
    "the same compare-and-swap does not apply twice",
    !replay || replay.length === 0,
  );

  const { data: completed } = await db
    .from("requests")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", pickup.id)
    .eq("status", "planned")
    .select("id, status")
    .maybeSingle();
  check("planned -> completed succeeds", completed?.status === "completed");

  section("Cancel guards");
  const { data: wrongOwner } = await db
    .from("requests")
    .update({ status: "cancelled" })
    .eq("id", dropoff.id)
    .eq("user_id", otherUser.id)
    .in("status", ["pending", "planned"])
    .select("id");
  check(
    "another customer cannot cancel this request",
    !wrongOwner || wrongOwner.length === 0,
  );

  const { data: terminal } = await db
    .from("requests")
    .update({ status: "cancelled" })
    .eq("id", pickup.id)
    .eq("user_id", nearUser.id)
    .in("status", ["pending", "planned"])
    .select("id");
  check(
    "a completed request cannot be cancelled",
    !terminal || terminal.length === 0,
  );

  const { data: cancelled } = await db
    .from("requests")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", dropoff.id)
    .eq("user_id", nearUser.id)
    .in("status", ["pending", "planned"])
    .select("id, status")
    .maybeSingle();
  check("the owner can cancel an open request", cancelled?.status === "cancelled");

  const { error: rebookError } = await db
    .from("requests")
    .insert({ ...requestBase, type: "dropoff" })
    .select("id")
    .single()
    .then(async (r) => {
      if (r.data) createdRequests.push(r.data.id);
      return r;
    });
  check(
    "cancelling frees the slot to rebook the same day",
    !rebookError,
    rebookError?.message,
  );

  section("Triggers");
  const { data: beforeUpdate } = await db
    .from("users")
    .select("updated_at")
    .eq("id", nearUser.id)
    .single();
  await new Promise((r) => setTimeout(r, 1100));
  await db.from("users").update({ full_name: "Renamed" }).eq("id", nearUser.id);
  const { data: afterUpdate } = await db
    .from("users")
    .select("updated_at")
    .eq("id", nearUser.id)
    .single();
  check(
    "updated_at advances on update",
    new Date(afterUpdate.updated_at) > new Date(beforeUpdate.updated_at),
  );

  section("Cascade");
  // Deleting the pickup must take its return with it — a return with nothing
  // to return is meaningless.
  const { data: orphanCheck } = await db
    .from("requests")
    .select("id")
    .eq("parent_pickup_id", otherPickup.id);
  await db.from("requests").delete().eq("id", otherPickup.id);
  const { data: afterParentDelete } = await db
    .from("requests")
    .select("id")
    .eq("parent_pickup_id", otherPickup.id);
  check(
    "deleting a pickup cascades to its drop-off",
    (orphanCheck?.length ?? 0) === 1 && (afterParentDelete?.length ?? 0) === 0,
  );

  await db.from("users").delete().eq("id", nearUser.id);
  createdUsers.splice(createdUsers.indexOf(nearUser.id), 1);
  const { count } = await db
    .from("requests")
    .select("id", { count: "exact", head: true })
    .eq("user_id", nearUser.id);
  check("deleting a customer removes their requests", count === 0);
  createdRequests.length = 0;
} catch (error) {
  failed += 1;
  console.error(`\nAborted: ${error.message}`);
} finally {
  await cleanup();
  await restoreSettings();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
