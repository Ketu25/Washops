#!/usr/bin/env node
/**
 * Browser checks for the address suggestion dropdowns.
 *
 *   npm run dev
 *   npm run e2e:autocomplete
 */

import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { SignJWT } from "jose";
import ws from "ws";

const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";

/**
 * Mint the admin's session cookie directly from SESSION_SECRET rather than
 * signing in through the form. The owner is expected to change their password
 * after seeding, so a hardcoded one goes stale — and this script is testing
 * the address dropdowns, not the login page, which e2e.mjs already covers.
 */
async function adminSessionCookie() {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { transport: ws },
    },
  );

  const { data } = await db
    .from("users")
    .select("id")
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();

  if (!data) throw new Error("No admin account exists. Run npm run create-admin.");

  const token = await new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(data.id)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(process.env.SESSION_SECRET));

  return {
    name: "laundromat_session",
    value: token,
    domain: "localhost",
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
  };
}

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

const browser = await chromium.launch();

/** Type like a person so the debounce behaves as it would in real use. */
async function typeInto(page, selector, text) {
  await page.click(selector);
  await page.fill(selector, "");
  await page.type(selector, text, { delay: 30 });
}

async function waitForOptions(page, selector) {
  const listId = await page.getAttribute(selector, "aria-controls");
  await page.waitForSelector(`#${listId} [role="option"]`, { timeout: 20000 });
  return listId;
}

try {
  const context = await browser.newContext();
  const page = await context.newPage();

  // -------------------------------------------------------------------
  section("Coverage checker (single-line, fills the full address)");
  await page.goto(BASE);

  check(
    "the input is exposed as a combobox",
    (await page.getAttribute("#coverage-address", "role")) === "combobox",
  );
  check(
    "it starts collapsed",
    (await page.getAttribute("#coverage-address", "aria-expanded")) === "false",
  );

  await typeInto(page, "#coverage-address", "350 5th Ave New York");
  const coverageList = await waitForOptions(page, "#coverage-address");
  check("suggestions appear as the user types", true);
  check(
    "aria-expanded flips once the list is open",
    (await page.getAttribute("#coverage-address", "aria-expanded")) === "true",
  );

  const optionCount = await page.locator(`#${coverageList} [role="option"]`).count();
  check(`the list is capped at 6 (${optionCount})`, optionCount <= 6);

  await page.locator(`#${coverageList} [role="option"]`).first().click();
  // Picking a Google prediction kicks off a details lookup; the field shows
  // the prediction text until that lands.
  await page.waitForFunction(
    () => /\d{5}, USA$/.test(document.querySelector("#coverage-address")?.value ?? ""),
    { timeout: 15000 },
  );
  const coverageValue = await page.inputValue("#coverage-address");
  check(
    "choosing an option fills the whole one-line address",
    // The resolved address carries a ZIP even though the prediction row does
    // not; which city ranks first is the provider's business, not the test's.
    /^350 5th Ave.*,.*[A-Z]{2} \d{5}, USA$/.test(coverageValue),
    coverageValue,
  );
  check(
    "the list closes after choosing",
    (await page.getAttribute("#coverage-address", "aria-expanded")) === "false",
  );

  // -------------------------------------------------------------------
  section("Typing fewer than 3 characters");
  await typeInto(page, "#coverage-address", "35");
  await page.waitForTimeout(1200);
  check(
    "no lookup fires for a very short query",
    (await page.getAttribute("#coverage-address", "aria-expanded")) === "false",
  );

  // -------------------------------------------------------------------
  section("Registration (structured, fills the sibling fields)");
  await page.goto(`${BASE}/register`);

  await typeInto(page, "#addressLine1", "350 5th Ave New York");
  const streetList = await waitForOptions(page, "#addressLine1");
  // Assert against the row that was actually chosen, not against a city the
  // provider happens to rank first today — that ordering shifts with the
  // location bias and with Google's own index.
  const chosenRow = await page
    .locator(`#${streetList} [role="option"]`)
    .first()
    .innerText();
  await page.locator(`#${streetList} [role="option"]`).first().click();
  await page.waitForFunction(
    () => document.querySelector("#city")?.value !== "",
    { timeout: 15000 },
  );

  const [line1, city, state, zip] = await Promise.all([
    page.inputValue("#addressLine1"),
    page.inputValue("#city"),
    page.inputValue("#state"),
    page.inputValue("#postalCode"),
  ]);

  check("the street line keeps only the street", line1.startsWith("350"), line1);
  check(
    "city is filled, and matches the row that was chosen",
    city.length > 0 && chosenRow.toLowerCase().includes(city.toLowerCase()),
    `row="${chosenRow}" city="${city}"`,
  );
  check(
    "state is filled as the two-letter code",
    /^[A-Z]{2}$/.test(state),
    state,
  );
  check("ZIP is filled as five digits", /^\d{5}$/.test(zip), zip);

  // The bug this guards: autofilling siblings must not make each of them run
  // its own lookup and pop its own dropdown open.
  await page.waitForTimeout(1500);
  const stray = await Promise.all(
    ["#city", "#state", "#postalCode"].map((sel) =>
      page.getAttribute(sel, "aria-expanded"),
    ),
  );
  check(
    "autofilled fields do not open dropdowns of their own",
    stray.every((value) => value === "false"),
    stray.join(", "),
  );

  // -------------------------------------------------------------------
  section("Keyboard navigation");
  await typeInto(page, "#addressLine1", "1600 Pennsylvania Ave");
  await waitForOptions(page, "#addressLine1");

  await page.keyboard.press("ArrowDown");
  const active = await page.getAttribute("#addressLine1", "aria-activedescendant");
  check("ArrowDown highlights an option", Boolean(active), String(active));

  await page.keyboard.press("Enter");
  check(
    "Enter picks the highlighted option instead of submitting",
    page.url().endsWith("/register"),
  );
  check(
    "the chosen street lands in the field",
    (await page.inputValue("#addressLine1")).includes("1600"),
    await page.inputValue("#addressLine1"),
  );

  await typeInto(page, "#addressLine1", "350 5th Ave New York");
  await waitForOptions(page, "#addressLine1");
  await page.keyboard.press("Escape");
  check(
    "Escape closes the list",
    (await page.getAttribute("#addressLine1", "aria-expanded")) === "false",
  );

  // -------------------------------------------------------------------
  section("An address OpenStreetMap does not know");
  await typeInto(page, "#addressLine1", "zzzz qqqq nonexistent street 99999");
  await page.waitForTimeout(2500);
  check(
    "no dropdown, and the typed text is left alone",
    (await page.getAttribute("#addressLine1", "aria-expanded")) === "false" &&
      (await page.inputValue("#addressLine1")) ===
        "zzzz qqqq nonexistent street 99999",
  );

  // -------------------------------------------------------------------
  section("Admin settings (single-line)");
  await context.addCookies([await adminSessionCookie()]);

  await page.goto(`${BASE}/admin/settings`);
  check("the minted admin session is accepted", page.url().includes("/admin/settings"));

  await typeInto(page, "#address", "Times Square New York");
  const settingsList = await waitForOptions(page, "#address");
  await page.locator(`#${settingsList} [role="option"]`).first().click();
  const settingsValue = await page.inputValue("#address");
  check(
    "the laundromat address field fills the full address",
    settingsValue.toLowerCase().includes("times square"),
    settingsValue,
  );
} catch (error) {
  failed += 1;
  console.error(`\nAborted: ${error.message}`);
} finally {
  await browser.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
