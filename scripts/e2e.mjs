#!/usr/bin/env node
/**
 * Browser end-to-end walkthrough against a running dev server.
 *
 * Drives the real forms — server actions, geocoding, the service-area gate,
 * the admin queue — the way a person would, then removes the accounts and
 * requests it created.
 *
 *   npm run dev          # in another terminal
 *   npm run e2e
 */

import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import ws from "ws";

const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";

// A throwaway admin created and destroyed by this script. The owner is
// expected to change their own password after seeding, so depending on a
// known one makes this test rot; creating our own also means the run never
// touches the real account.
const ADMIN_EMAIL = `e2e-admin-${Date.now()}@example.test`;
const ADMIN_PASSWORD = "e2e-admin-password-123";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: ws },
  },
);

let passed = 0;
let failed = 0;
const check = (label, ok, detail = "") => {
  if (ok) {
    passed += 1;
    console.log(`  ok   ${label}`);
  } else {
    failed += 1;
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
};
const section = (t) => console.log(`\n${t}`);

const stamp = Date.now();
// Two real addresses: one a few blocks from the shop, one clearly beyond it.
const SHOP_ADDRESS = "Times Square, New York, NY 10036";
const NEAR = {
  line1: "350 5th Ave",
  city: "New York",
  state: "NY",
  zip: "10118",
}; // Empire State Building, ~0.7 mi
const FAR = {
  line1: "1 Liberty Island",
  city: "New York",
  state: "NY",
  zip: "10004",
}; // ~5.7 mi
const NEAR_EMAIL = `e2e-near-${stamp}@example.test`;
const FAR_EMAIL = `e2e-far-${stamp}@example.test`;
const PASSWORD = "e2e-password-123";

const browser = await chromium.launch();

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

/** Pages registered here get dumped if the run aborts. */
const diagnosticPages = {};

async function cleanup() {
  await db
    .from("users")
    .delete()
    .in("email", [NEAR_EMAIL, FAR_EMAIL, ADMIN_EMAIL]);
}

/**
 * The run asserts on the "not configured yet" state, so it has to start from
 * one. Leaving this to whoever ran last makes the suite order-dependent.
 */
async function clearSettings() {
  await db.from("laundromat_settings").delete().eq("id", true);
}

async function createThrowawayAdmin() {
  const { error } = await db.from("users").insert({
    email: ADMIN_EMAIL,
    password_hash: await bcrypt.hash(ADMIN_PASSWORD, 12),
    full_name: "E2E Admin",
    role: "admin",
  });
  if (error) throw new Error(`Could not create test admin: ${error.message}`);
}

/**
 * Click a button by its exact accessible name. The site header has its own
 * "Sign out" submit button on every authenticated page, so a bare
 * button[type="submit"] selector is ambiguous and picks the wrong one.
 */
async function clickButton(page, name) {
  await page.getByRole("button", { name, exact: true }).first().click();
}

/** Fill the shared structured address block. */
async function fillAddress(page, address) {
  await page.fill("#addressLine1", address.line1);
  await page.fill("#city", address.city);
  await page.fill("#state", address.state);
  await page.fill("#postalCode", address.zip);
  // Typing into these fields arms the suggestion dropdown, which is
  // absolutely positioned and can end up covering the submit button.
  await page.keyboard.press("Escape");
  await page.waitForTimeout(700);
  await page.keyboard.press("Escape");
}

try {
  // -------------------------------------------------------------------
  section("Admin configures the service area");
  await snapshotSettings();
  await clearSettings();
  await createThrowawayAdmin();
  const admin = await browser.newContext();
  const adminPage = await admin.newPage();

  await adminPage.goto(`${BASE}/login`);
  await adminPage.fill("#email", ADMIN_EMAIL);
  await adminPage.fill("#password", ADMIN_PASSWORD);
  await adminPage.click('button[type="submit"]');
  await adminPage.waitForURL("**/admin", { timeout: 20000 });
  check("admin signs in and lands on /admin", adminPage.url().endsWith("/admin"));

  check(
    "unconfigured admin sees the setup warning",
    await adminPage.getByText("Service area not configured").isVisible(),
  );

  await adminPage.goto(`${BASE}/admin/settings`);
  await adminPage.fill("#name", "Bubbles Laundromat");
  await adminPage.fill("#address", SHOP_ADDRESS);
  await adminPage.keyboard.press("Escape");
  await adminPage.fill("#serviceRadiusMiles", "5");
  await clickButton(adminPage, "Save settings");
  await adminPage.waitForSelector("text=Settings saved", { timeout: 45000 });
  check("settings save and geocode", true);

  const anchor = await adminPage.textContent("body");
  check(
    "the geocoded anchor is shown back",
    anchor.includes("Coordinates") && /40\.7\d{4}/.test(anchor),
  );

  // -------------------------------------------------------------------
  section("Public coverage checker");
  const visitor = await browser.newContext();
  const visitorPage = await visitor.newPage();

  await visitorPage.goto(BASE);
  await visitorPage.fill(
    "#coverage-address",
    `${NEAR.line1}, ${NEAR.city}, ${NEAR.state} ${NEAR.zip}`,
  );
  await visitorPage.keyboard.press("Escape");
  await clickButton(visitorPage, "Check my address");
  await visitorPage.waitForSelector("text=You are in our service area", {
    timeout: 45000,
  });
  check("a nearby address is reported as covered", true);

  await visitorPage.fill(
    "#coverage-address",
    `${FAR.line1}, ${FAR.city}, ${FAR.state} ${FAR.zip}`,
  );
  await visitorPage.keyboard.press("Escape");
  await clickButton(visitorPage, "Check my address");
  await visitorPage.waitForSelector("text=Outside our service area", {
    timeout: 45000,
  });
  const outOfRangeText = await visitorPage.textContent("body");
  check(
    "the refusal quotes distance and limit",
    /\d+\.\d+ miles away; our service limit is 5\.0 miles/.test(outOfRangeText),
    outOfRangeText.match(/is [\d.]+ miles away[^.]*\./)?.[0],
  );

  await visitorPage.fill("#coverage-address", "asdkjhasd nowhere at all 99999");
  await visitorPage.keyboard.press("Escape");
  await clickButton(visitorPage, "Check my address");
  await visitorPage.waitForSelector("text=could not find that address", {
    timeout: 45000,
  });
  check("an unfindable address gets a different message than out-of-range", true);

  // -------------------------------------------------------------------
  section("Registration is gated by the service area");
  const farCtx = await browser.newContext();
  const farPage = await farCtx.newPage();
  diagnosticPages.farPage = farPage;

  await farPage.goto(`${BASE}/register`);
  await farPage.fill("#fullName", "Far Customer");
  await farPage.fill("#email", FAR_EMAIL);
  await farPage.fill("#password", PASSWORD);
  await fillAddress(farPage, FAR);
  await clickButton(farPage, "Create account");
  await farPage.waitForSelector("text=We cannot serve this address", {
    timeout: 45000,
  });
  check("out-of-range registration is blocked", true);

  const { count: farCount } = await db
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("email", FAR_EMAIL);
  check("no account row was created for the blocked address", farCount === 0);

  // -------------------------------------------------------------------
  section("Customer journey");
  const custCtx = await browser.newContext();
  const custPage = await custCtx.newPage();

  await custPage.goto(`${BASE}/register`);
  await custPage.fill("#fullName", "Near Customer");
  await custPage.fill("#email", NEAR_EMAIL);
  await custPage.fill("#phone", "555-0100");
  await custPage.fill("#password", PASSWORD);
  await fillAddress(custPage, NEAR);
  await clickButton(custPage, "Create account");
  await custPage.waitForURL("**/dashboard", { timeout: 45000 });
  check("in-range registration succeeds and signs the user in", true);

  check(
    "empty dashboard invites a first booking",
    await custPage.getByText("Nothing scheduled").isVisible(),
  );

  await custPage.goto(`${BASE}/dashboard/schedule`);
  await custPage.selectOption("#timeWindow", "10:00 - 12:00");
  await clickButton(custPage, "Request pickup");
  await custPage.waitForSelector("text=Pickup submitted", { timeout: 30000 });
  check("a pickup request is submitted", true);

  check(
    "the form offers no way to book a drop-off",
    (await custPage.locator("#type-dropoff").count()) === 0 &&
      (await custPage.textContent("body")).includes("we book the return"),
  );

  // Same day again — the partial unique index should stop it.
  await clickButton(custPage, "Request pickup");
  await custPage.waitForSelector("text=already have an open pickup", {
    timeout: 30000,
  });
  check("a duplicate same-day pickup is refused", true);

  await custPage.goto(`${BASE}/dashboard`);
  check(
    "the request appears as pending",
    (await custPage.textContent("body")).includes("Awaiting confirmation"),
  );

  // -------------------------------------------------------------------
  section("Admin moves the request through its lifecycle");
  // Scope the queue to this run's customer. Without it, clicking the first
  // "Mark planned" in the table acts on whatever row happens to be first —
  // which, on a database with real requests in it, is someone else's.
  const mine = `${BASE}/admin?q=${encodeURIComponent(NEAR_EMAIL)}`;
  await adminPage.goto(mine);
  const adminBody = await adminPage.textContent("body");
  check("the request shows in the admin queue", adminBody.includes("Near Customer"));
  check("the customer's distance is displayed", /0\.\d mi/.test(adminBody));

  await clickButton(adminPage, "Mark planned");
  await adminPage.waitForSelector('button:has-text("Mark completed")', {
    timeout: 30000,
  });
  check("pending -> planned via the admin UI", true);

  await custPage.reload();
  check(
    "the customer sees the confirmation",
    (await custPage.textContent("body")).includes("we have you on the route"),
  );

  await adminPage.goto(`${mine}&status=planned`);
  check(
    "the status filter narrows the queue",
    (await adminPage.textContent("body")).includes("Near Customer"),
  );

  // Filter on a search term nothing can match. Asserting on a *status*
  // assumed an empty database, which breaks the moment the owner has done
  // any real work — the suite must not depend on rows it did not create.
  await adminPage.goto(`${BASE}/admin?q=zzz-no-such-customer-${stamp}`);
  check(
    "a filter matching nothing shows the empty state",
    (await adminPage.textContent("body")).includes("No requests match these filters"),
  );

  await adminPage.goto(mine);
  await clickButton(adminPage, "Mark completed");
  // A completed request is terminal: the actions cell collapses to an em dash.
  await adminPage.waitForFunction(
    () => !document.body.innerText.includes("Mark completed"),
    { timeout: 30000 },
  );
  check("planned -> completed, and the row becomes terminal", true);

  // The page is already sitting on /dashboard, so navigating to the same URL
  // does not necessarily re-fetch. Force it — the status was changed by the
  // admin in another context, so nothing on this page triggered a refresh.
  await custPage.goto(`${BASE}/dashboard`);
  await custPage.reload({ waitUntil: "networkidle" });
  const custBody = await custPage.textContent("body");
  check(
    "a completed pickup shows as with the laundromat, awaiting its return",
    custBody.includes("With us now") && custBody.includes("Being washed"),
  );

  // -------------------------------------------------------------------
  section("Admin schedules the return");
  await adminPage.goto(`${mine}&status=awaiting_dropoff`);
  check(
    "the completed pickup appears under Awaiting drop-off",
    (await adminPage.textContent("body")).includes("Near Customer"),
  );

  await clickButton(adminPage, "Schedule drop-off");
  await adminPage.waitForSelector('[role="dialog"]', { timeout: 15000 });
  const dropoffDate = await adminPage
    .locator('[role="dialog"] input[type="date"]')
    .inputValue();
  await adminPage
    .locator('[role="dialog"] select')
    .selectOption("14:00 - 16:00");
  await adminPage
    .locator('[role="dialog"] textarea')
    .fill("Two bags, folded.");
  await adminPage
    .locator('[role="dialog"] button[type="submit"]')
    .click();
  // Booking it removes the pickup from THIS filtered view, which is what
  // closes the dialog. So assert on the unfiltered queue.
  await adminPage.waitForSelector('[role="dialog"]', {
    state: "detached",
    timeout: 30000,
  });
  check(
    "the pickup drops out of Awaiting drop-off once booked",
    (await adminPage.textContent("body")).includes(
      "No requests match these filters",
    ),
  );

  await adminPage.goto(mine);
  const queueAfter = await adminPage.textContent("body");
  check(
    "the pickup now reads as booked, and the return is in the queue",
    queueAfter.includes("Drop-off booked") && queueAfter.includes("Drop-off"),
  );

  await custPage.goto(`${BASE}/dashboard`);
  await custPage.reload({ waitUntil: "networkidle" });
  const afterDropoff = await custPage.textContent("body");
  check(
    "the customer sees the drop-off the laundromat scheduled",
    afterDropoff.includes("Drop-off") &&
      afterDropoff.includes("bringing your clean laundry back") &&
      afterDropoff.includes("14:00 - 16:00"),
  );
  check(
    "the customer cannot cancel a drop-off",
    afterDropoff.includes("Arranged by us") &&
      (await custPage.getByRole("button", { name: "Cancel", exact: true }).count()) === 0,
    `dropoffDate=${dropoffDate}`,
  );

  // -------------------------------------------------------------------
  section("Cancellation");
  // Today's pickup is already completed, so book a different day.
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  await custPage.goto(`${BASE}/dashboard/schedule`);
  await custPage.fill("#scheduledDate", tomorrow);
  await clickButton(custPage, "Request pickup");
  await custPage.waitForSelector("text=Pickup submitted", { timeout: 30000 });

  await custPage.goto(`${BASE}/dashboard`);
  // Cancelling opens an in-app confirmation dialog rather than
  // window.confirm, so the flow is: open it, then confirm.
  await clickButton(custPage, "Cancel");
  await custPage.waitForSelector('[role="dialog"]', { timeout: 15000 });
  await clickButton(custPage, "Cancel request");
  await custPage.waitForFunction(
    () => !document.body.innerText.includes("Awaiting confirmation"),
    { timeout: 30000 },
  );
  check("a customer can cancel their own pickup", true);

  // -------------------------------------------------------------------
  section("Shrinking the radius locks out an existing customer");
  await adminPage.goto(`${BASE}/admin/settings`);
  await adminPage.fill("#serviceRadiusMiles", "0.2");
  await clickButton(adminPage, "Save settings");
  await adminPage.waitForSelector("text=Settings saved", { timeout: 45000 });
  check(
    "the admin is warned about customers the change locks out",
    (await adminPage.textContent("body")).includes("now fall outside this radius"),
  );

  await custPage.goto(`${BASE}/dashboard`);
  check(
    "the customer is told their address is now out of range",
    (await custPage.textContent("body")).includes(
      "Your address is now outside our service area",
    ),
  );

  await custPage.goto(`${BASE}/dashboard/schedule`);
  const disabled = await custPage.isDisabled("#scheduledDate");
  check("the scheduling form is disabled for them", disabled);

  // -------------------------------------------------------------------
  section("Role separation");
  await adminPage.goto(`${BASE}/dashboard`);
  check(
    "an admin visiting a customer page is redirected",
    adminPage.url().includes("/admin"),
  );
  await custPage.goto(`${BASE}/admin`);
  check(
    "a customer visiting the admin portal is redirected",
    custPage.url().includes("/dashboard"),
  );
} catch (error) {
  failed += 1;
  console.error(`\nAborted: ${error.message}`);
  // Dump what was actually on screen — a bare timeout says nothing about why.
  for (const [name, ctx] of Object.entries(diagnosticPages)) {
    if (!ctx) continue;
    try {
      const text = (await ctx.textContent("body")).replace(/\s+/g, " ");
      console.error(`  [${name}] url=${ctx.url()}`);
      console.error(`  [${name}] ${text.slice(0, 400)}`);
    } catch {}
  }
} finally {
  await browser.close();
  await cleanup();
  await restoreSettings();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
