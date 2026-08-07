#!/usr/bin/env node
/**
 * Probe the live address endpoint: is the active provider healthy, and is the
 * country restriction actually holding?
 *
 *   npm run dev
 *   npm run check:places
 *
 * Distinguishes "correctly rejected a foreign address" from "the provider is
 * down and rejecting everything" — those look identical from the UI, and
 * conflating them is how a broken lookup gets shipped as working.
 */

const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";

const US = [
  { q: "350 5th Ave New York", scope: "address" },
  { q: "1600 Pennsylvania Ave Washington", scope: "address" },
  { q: "233 S Wacker Dr Chicago", scope: "address" },
  { q: "Chicago", scope: "city" },
  { q: "10118", scope: "postcode" },
];

// Deliberately unambiguous: "London" and "Toronto" are also towns in Ohio, so
// using those as the non-US probe would fail for the wrong reason.
const FOREIGN = [
  { q: "10 Downing Street, London, United Kingdom", scope: "address" },
  { q: "1 Rue de Rivoli, Paris, France", scope: "address" },
  { q: "100 Queen Street West, Toronto, Ontario", scope: "address" },
  { q: "Connaught Place, New Delhi, India", scope: "address" },
  { q: "Shibuya, Tokyo, Japan", scope: "address" },
];

async function probe({ q, scope }) {
  const url = `${BASE}/api/address/suggest?scope=${scope}&q=${encodeURIComponent(q)}`;
  const response = await fetch(url);
  if (!response.ok) return { q, scope, error: `HTTP ${response.status}` };
  const { suggestions } = await response.json();
  return { q, scope, suggestions };
}

console.log(`Probing ${BASE}\n`);

const usResults = [];
for (const item of US) {
  usResults.push(await probe(item));
  // Stay inside the Nominatim fallback's one-request-per-second budget.
  await new Promise((r) => setTimeout(r, 1300));
}

const foreignResults = [];
for (const item of FOREIGN) {
  foreignResults.push(await probe(item));
  await new Promise((r) => setTimeout(r, 1300));
}

const usHits = usResults.filter((r) => r.suggestions?.length > 0).length;

/**
 * The restriction guarantees no FOREIGN address comes back — not that a query
 * mentioning a foreign city returns nothing. "100 Queen Street West, Toronto"
 * legitimately fuzzy-matches a real street in Hampton, VA, and returning that
 * is the filter working, not leaking. So assert on where the results are,
 * never on how many there are.
 */
const isDomestic = (label) => /,\s*USA$/.test(label.trim());
const leaks = foreignResults.flatMap((r) =>
  (r.suggestions ?? [])
    .filter((s) => !isDomestic(s.label))
    .map((s) => ({ q: r.q, label: s.label })),
);
const foreignHits = leaks.length;

console.log("US addresses (expect results):");
for (const r of usResults) {
  const first = r.suggestions?.[0];
  console.log(
    `  ${r.suggestions?.length ? "ok  " : "MISS"} ${r.q.padEnd(38)} ` +
      (first ? first.label : (r.error ?? "no results")),
  );
}

console.log("\nNon-US queries (any result must still be a US address):");
for (const r of foreignResults) {
  const bad = (r.suggestions ?? []).find((s) => !isDomestic(s.label));
  const first = r.suggestions?.[0];
  console.log(
    `  ${bad ? "LEAK" : "ok  "} ${r.q.padEnd(41)} ` +
      (bad
        ? bad.label
        : first
          ? `no foreign result (matched ${first.label})`
          : "no results"),
  );
}

console.log();

if (usHits === 0) {
  // Every US address failing means the provider is refusing us, not that the
  // country filter is working. Saying "restriction verified" here would be a
  // lie that survives until a customer cannot register.
  console.log(
    "INCONCLUSIVE: no US address returned results either, so the provider is " +
      "unavailable (Nominatim rate limit, or a missing/invalid Google key).\n" +
      "The country restriction cannot be confirmed while the provider is down.",
  );
  process.exit(2);
}

if (foreignHits > 0) {
  console.log(`FAIL: ${foreignHits} foreign address(es) leaked through:`);
  for (const leak of leaks) console.log(`  ${leak.q} -> ${leak.label}`);
  process.exit(1);
}

console.log(
  `PASS: ${usHits}/${US.length} US lookups returned results, ` +
    `and no foreign address came back for any of the ${FOREIGN.length} ` +
    `non-US queries.`,
);
