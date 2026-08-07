#!/usr/bin/env node
/**
 * Create a test customer account.
 *
 *   npm run create-customer -- <email> "<full name>" "<password>" "<street>" "<city>" "<state>" "<zip>"
 *
 * Runs the same service-area gate the registration form does: the address is
 * geocoded, the distance measured against the configured radius, and the
 * account refused if it falls outside. Seeding a customer the app itself would
 * have rejected would produce an account that can never book anything.
 */

import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import ws from "ws";

const [email, fullName, password, line1, city, state, zip] = process.argv.slice(2);

if (!email || !fullName || !password || !line1 || !city || !state || !zip) {
  console.error(
    'Usage: npm run create-customer -- <email> "<name>" "<password>" ' +
      '"<street>" "<city>" "<state>" "<zip>"',
  );
  process.exit(1);
}

if (password.length < 8 || password.length > 72) {
  console.error("Password must be between 8 and 72 characters.");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const mapsKey = process.env.GOOGLE_MAPS_API_KEY;

if (!url || !key) {
  console.error("Missing Supabase env vars. Check .env.local.");
  process.exit(1);
}

const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: ws },
});

const R_MILES = 3958.7613;
const rad = (d) => (d * Math.PI) / 180;
function haversineMiles(a, b) {
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return R_MILES * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

const { data: settings } = await db
  .from("laundromat_settings")
  .select("*")
  .eq("id", true)
  .maybeSingle();

if (!settings) {
  console.error("No laundromat settings configured yet. Set them at /admin/settings first.");
  process.exit(1);
}

const address = [line1, city, state, zip].join(", ");

async function geocode(query) {
  if (mapsKey) {
    const u = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    u.searchParams.set("address", query);
    u.searchParams.set("key", mapsKey);
    u.searchParams.set("components", "country:US");
    const d = await (await fetch(u)).json();
    if (d.status === "OK" && d.results?.length) {
      const r = d.results[0];
      return {
        latitude: r.geometry.location.lat,
        longitude: r.geometry.location.lng,
        formattedAddress: r.formatted_address,
      };
    }
    console.error(`Google geocoding failed: ${d.status} ${d.error_message ?? ""}`);
    process.exit(1);
  }
  const u = new URL("https://nominatim.openstreetmap.org/search");
  u.searchParams.set("q", query);
  u.searchParams.set("format", "jsonv2");
  u.searchParams.set("limit", "1");
  u.searchParams.set("countrycodes", "us");
  const d = await (
    await fetch(u, { headers: { "User-Agent": "LaundromatPortal/1.0 (seed script)" } })
  ).json();
  if (!d?.[0]) {
    console.error("Could not geocode that address.");
    process.exit(1);
  }
  return {
    latitude: Number.parseFloat(d[0].lat),
    longitude: Number.parseFloat(d[0].lon),
    formattedAddress: d[0].display_name,
  };
}

const geo = await geocode(address);
const distance = haversineMiles(
  { latitude: settings.latitude, longitude: settings.longitude },
  geo,
);
const radius = Number(settings.service_radius_miles);

console.log(`  address  : ${geo.formattedAddress}`);
console.log(`  distance : ${distance.toFixed(2)} mi from ${settings.name}`);
console.log(`  radius   : ${radius.toFixed(1)} mi`);

if (distance > radius + 0.005) {
  console.error(
    `\nRefused: that address is ${distance.toFixed(1)} miles away; the limit is ` +
      `${radius.toFixed(1)}. The app would reject this registration too, so the ` +
      `account would be unable to book anything.`,
  );
  process.exit(1);
}

const normalisedEmail = email.trim().toLowerCase();
const passwordHash = await bcrypt.hash(password, 12);

const row = {
  email: normalisedEmail,
  password_hash: passwordHash,
  full_name: fullName.trim(),
  role: "customer",
  address_line1: line1,
  city,
  state,
  postal_code: zip,
  formatted_address: geo.formattedAddress,
  latitude: geo.latitude,
  longitude: geo.longitude,
  distance_miles: distance,
};

const { data: existing } = await db
  .from("users")
  .select("id")
  .eq("email", normalisedEmail)
  .maybeSingle();

if (existing) {
  const { error } = await db.from("users").update(row).eq("id", existing.id);
  if (error) {
    console.error(`Update failed: ${error.message}`);
    process.exit(1);
  }
  console.log(`\nUpdated existing customer ${normalisedEmail}.`);
} else {
  const { error } = await db.from("users").insert(row);
  if (error) {
    console.error(`Insert failed: ${error.message}`);
    process.exit(1);
  }
  console.log(`\nCreated customer ${normalisedEmail}.`);
}

console.log("Sign in at /login.");
