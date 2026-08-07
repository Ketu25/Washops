#!/usr/bin/env node
/**
 * Render checks for the suggestion dropdown, with the provider stubbed.
 *
 * The upstream lookup is intercepted and answered from a fixture, so this
 * verifies what the user actually sees — one row per address, full address on
 * a single line — without depending on Google quota or Nominatim's rate limit
 * being healthy today.
 *
 *   npm run dev
 *   npm run e2e:dropdown
 */

import { chromium } from "playwright";

const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";
const SHOT = process.env.SHOT_PATH || "/tmp/dropdown.png";

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

/** Shaped exactly like a Google Places prediction set. */
const FIXTURE = [
  "1520 Laurel Crossing Parkway Northeast, Buford, GA, USA",
  "1520 Laurelstone Pkwy, Columbus, OH, USA",
  "1520 Laurel Ave, Ambridge, PA, USA",
  "1520 Laurel Dr, Accokeek, MD, USA",
  "1520 Laurel Oaks Drive, Streamwood, IL, USA",
].map((label, index) => ({
  id: `stub-${index}`,
  label,
  primary: label.split(",")[0],
  placeId: `stub-place-${index}`,
}));

const browser = await chromium.launch();

try {
  const context = await browser.newContext({
    viewport: { width: 900, height: 800 },
  });
  const page = await context.newPage();

  await page.route("**/api/address/suggest*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ suggestions: FIXTURE }),
    }),
  );

  // Picking a row triggers a details lookup; answer that from the fixture too.
  await page.route("**/api/address/details*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        resolved: {
          formattedAddress: "1520 Laurel Ave, Ambridge, PA 15003, USA",
          addressLine1: "1520 Laurel Ave",
          city: "Ambridge",
          state: "PA",
          postalCode: "15003",
          latitude: 40.5895,
          longitude: -80.2256,
        },
      }),
    }),
  );

  await page.goto(BASE);
  // The dev-mode indicator floats over the page and lands in the shot.
  await page.addStyleTag({
    content: "nextjs-portal,[data-nextjs-toast]{display:none !important}",
  });
  // Bring the field near the top so the open list has room below it.
  await page.evaluate(() => {
    const el = document.querySelector("#coverage-address");
    window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 80);
  });
  await page.click("#coverage-address");
  await page.type("#coverage-address", "1520 laurel", { delay: 40 });

  const listId = await page.getAttribute("#coverage-address", "aria-controls");
  await page.waitForSelector(`#${listId} [role="option"]`, { timeout: 10000 });

  const rows = page.locator(`#${listId} [role="option"]`);
  check("one row per suggestion", (await rows.count()) === FIXTURE.length);

  const texts = await rows.allInnerTexts();
  check(
    "each row is the full address on a single line",
    texts.every((t) => !t.includes("\n")) &&
      texts[0] === "1520 Laurel Crossing Parkway Northeast, Buford, GA, USA",
    JSON.stringify(texts[0]),
  );
  check(
    "rows match the fixture in order",
    texts.join("|") === FIXTURE.map((f) => f.label).join("|"),
  );

  // Frame just the field and its list — a full-page shot buries them below
  // the fold and makes the comparison useless.
  const field = page.locator("#coverage-address");
  const box = await field.boundingBox();
  await page.screenshot({
    path: SHOT,
    clip: {
      x: Math.max(0, box.x - 24),
      y: Math.max(0, box.y - 44),
      width: box.width + 48,
      height: 44 + box.height + 8 + FIXTURE.length * 42 + 16,
    },
  });
  console.log(`\n  screenshot -> ${SHOT}`);

  // Highlighting must not change the text, only the background.
  await page.keyboard.press("ArrowDown");
  const afterHighlight = await rows.first().innerText();
  check(
    "highlighting does not alter the row text",
    afterHighlight === FIXTURE[0].label,
  );

  await rows.nth(2).click();
  await page.waitForFunction(
    () =>
      document.querySelector("#coverage-address")?.value ===
      "1520 Laurel Ave, Ambridge, PA 15003, USA",
    { timeout: 10000 },
  );
  check("picking a row fills the resolved one-line address", true);
  check(
    "the list closes after picking",
    (await page.getAttribute("#coverage-address", "aria-expanded")) === "false",
  );

  // Same fixture, structured form: the street line must take only the street.
  await page.goto(`${BASE}/register`);
  await page.click("#addressLine1");
  await page.type("#addressLine1", "1520 laurel", { delay: 40 });
  const streetList = await page.getAttribute("#addressLine1", "aria-controls");
  await page.waitForSelector(`#${streetList} [role="option"]`, { timeout: 10000 });
  await page.locator(`#${streetList} [role="option"]`).nth(2).click();

  await page.waitForFunction(
    () => document.querySelector("#city")?.value === "Ambridge",
    { timeout: 10000 },
  );
  check(
    "street line keeps only the street",
    (await page.inputValue("#addressLine1")) === "1520 Laurel Ave",
    await page.inputValue("#addressLine1"),
  );
  check("city filled", (await page.inputValue("#city")) === "Ambridge");
  check("state filled", (await page.inputValue("#state")) === "PA");
  check("ZIP filled", (await page.inputValue("#postalCode")) === "15003");
} catch (error) {
  failed += 1;
  console.error(`\nAborted: ${error.message}`);
} finally {
  await browser.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
