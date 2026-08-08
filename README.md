# Laundry Pickup & Drop-off Portal

Replaces a laundromat's manual phone-and-paper pickup rounds with a self-serve
portal. Customers book their own pickups and drop-offs; the owner sees every
request in one queue and moves it through *pending → planned → completed*.
Every address is checked against a configurable service radius before anything
can be booked.

Next.js 16 (App Router) · React 19 · Tailwind v4 · Supabase Postgres.

---

## Setup

### 1. Create the database

In your Supabase project: **SQL Editor → New query**, paste all of
[`supabase/schema.sql`](supabase/schema.sql), and run it. It is idempotent, so
re-running it is safe.

### 2. Configure the app

```bash
cp .env.example .env.local
```

Fill in from **Project Settings → API** in Supabase:

| Variable | Where it comes from |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` secret — **server-only** |
| `SESSION_SECRET` | `openssl rand -base64 32` |
| `NEXT_PUBLIC_APP_TIMEZONE` | The laundromat's IANA timezone, e.g. `America/New_York` |
| `GOOGLE_MAPS_API_KEY` | Optional but recommended — see below |
| `ADDRESS_COUNTRY_CODES` | Countries addresses may come from. Defaults to `us` |
| `GEOCODER_USER_AGENT` | Your app name and a contact email (only used by the Nominatim fallback) |

**Google Maps key (recommended).** Without it the app falls back to
OpenStreetMap, which works but gives noticeably vaguer suggestions. To get one:
[console.cloud.google.com](https://console.cloud.google.com) → create a project
→ enable **Places API (New)** and **Geocoding API** → *Credentials* → *Create
API key*. Billing must be enabled; Google's recurring free monthly credit covers
a single laundromat's volume many times over. Restrict the key to those two APIs.

### 3. Create the owner's account

```bash
npm run create-admin -- owner@example.com "Owner Name" "a-strong-password"
```

There is no public route to an admin account — the owner is seeded from the
command line, so nobody can register their way into the admin portal. Re-running
with an existing email resets that password and promotes the account.

### 4. Run it

```bash
npm install
npm run dev
```

Sign in at `/login`, then set your address and radius at **/admin/settings**.
Until that row exists, registration, coverage checks, and scheduling are all
correctly refused with an explanatory message rather than a crash.

---

## Deploying to Cloudflare Workers

Config is committed (`wrangler.jsonc`, `open-next.config.ts`) rather than
auto-generated, because the generated version guesses the Worker name from
`package.json` and a mismatch fails the upload with *"Service binding
'WORKER_SELF_REFERENCE' references Worker '<name>' which was not found"*.

**`name` in `wrangler.jsonc` must match the Worker you deploy to.** It is
`washnexos`. Rename the Worker and you must rename it here too.

### Secrets

`.env.local` is never deployed. Set these on the Worker — Cloudflare dashboard
→ Settings → Variables, or:

```bash
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put SESSION_SECRET
npx wrangler secret put GOOGLE_MAPS_API_KEY
```

And these as plain variables:

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | your project URL |
| `APP_TIMEZONE` | e.g. `America/New_York` |
| `ADDRESS_COUNTRY_CODES` | `us` |
| `GEOCODER_USER_AGENT` | only used by the Nominatim fallback |

Without them the app throws on first request — `env.ts` fails loudly rather
than handing `undefined` to the Supabase client.

Note `APP_TIMEZONE` has **no** `NEXT_PUBLIC_` prefix. Next inlines prefixed
values at build time, so on a hosted build the timezone would freeze into the
bundle — and if unset during the build, silently fall back to the server's
zone, which is UTC on Workers. That would make same-day bookings vanish after
7pm Eastern.

### Variables are deleted on deploy unless you guard them

`wrangler deploy` treats `wrangler.jsonc` as the complete configuration and
removes any dashboard variable it does not declare. The deploy log shows this
as `- VAR_NAME` lines under `vars:` followed by *"Deploying the Worker will
override the remote configuration with your local one."* Left alone, every
deploy would wipe the Supabase and Google credentials and the app would throw
on the next request.

`"keep_vars": true` in `wrangler.jsonc` prevents that. Values still live in the
dashboard, so no project-specific data sits in this repo.

**Set the three credentials as type "Secret", not "Text".** Secrets are stored
separately, are never printed, and survive deploys on their own. Plain-text
vars are echoed into the build log in full — anyone who can read your build
history can read the key.

### bcrypt and the CPU limit

Password hashing is deliberately slow, and `bcryptjs` is pure JavaScript, so a
cost-12 hash burns a few hundred milliseconds of **CPU** — not wall time.

- **Paid plan:** works. `limits.cpu_ms` may be set in `wrangler.jsonc` to raise
  the ceiling further.
- **Free plan:** sign-in and registration exceed the CPU ceiling. Setting
  `limits.cpu_ms` does not help — it is rejected outright, failing the deploy
  with *"CPU limits are not supported for the Free plan"* [code: 100328].

Lowering `BCRYPT_ROUNDS` does not rescue the free plan either: each step down
roughly halves the work, and the gap is two orders of magnitude, so you would
reach an insecure cost factor long before you reached the limit. The real
options are Workers Paid, replacing bcrypt with a Web Crypto PBKDF2 hash
(native, far cheaper in CPU terms, and a schema migration for existing
passwords), or hosting where there is no hard per-request CPU cap.

### Cloudflare build settings

In the Worker's **Settings → Build**, the build command must be:

```
npm run cf:build          # NOT the default `npm run build`
```

Deploy command stays the default `npx wrangler deploy`.

This matters because the two steps are not interchangeable. `npm run build`
runs `next build`, which produces `.next/` — but the deploy step uploads
`.open-next/`, which only `opennextjs-cloudflare build` generates. Leave the
default in place and the deploy fails with *"Could not find compiled Open Next
config, did you run the build command?"*, referring to
`.open-next/.build/open-next.config.mjs`.

`opennextjs-cloudflare build` runs `next build` itself, so this is one build,
not two.

Before the Cloudflare config was committed, this worked by accident: with no
`wrangler.jsonc` present, Cloudflare ran an interactive migration that happened
to invoke the OpenNext build as a side effect. Committing the config — which is
what fixes the Worker-name mismatch — correctly skips that migration, so the
build command has to do the job explicitly.

### Commands

```bash
npm run cf:build  # build the Worker bundle into .open-next/
npm run preview   # build and run it locally in workerd
npm run deploy    # build and deploy from your machine
```

---

## What's in it

**Public** — `/` explains the service and hosts a coverage checker that needs no
account: type an address, find out immediately whether it is inside the radius
and by how much.

**Customer** — register with a home address, schedule a pickup or drop-off
(date + two-hour window + notes), watch the status change, cancel anything not
yet completed, and edit the profile address.

**Admin** — a filterable queue (status, type, date, free-text search over
customer name/email/street) with the stats bar on top: pending, planned, today's
count split by pickup and drop-off, and total upcoming. Requests advance with
one click. `/admin/settings` sets the name, address, and radius, and lists any
customers the current radius has locked out.

---

## The service-area rule

Every address goes through one function — `checkCoverage()` in
[`src/lib/service-area.ts`](src/lib/service-area.ts) — which geocodes it, takes
the Haversine great-circle distance to the laundromat, and compares that against
the configured radius. Three paths call it, and all three refuse:

1. **Registration** — the account is never created.
2. **Profile address change** — the update is rejected and the old address stands.
3. **New request** — re-checked against the *current* radius, since the owner may
   have shrunk it since the customer signed up.

The refusal always quotes the real numbers:

> Your address is 6.2 miles away; our service limit is 5 miles.

### Why it is checked at request time too

Coordinates are stored on the user at registration, so booking does not spend a
geocoder call. But the *distance* is recomputed on every booking against the
live radius. This is what makes a radius change take effect immediately without
touching a single existing row.

---

## Design notes

**Data access.** All three tables have RLS enabled with **no policies**, and the
default PostgREST grants are revoked. Anyone holding the publishable key can
read and write nothing. Every query runs server-side through the `service_role`
key after an explicit ownership or role check. `src/lib/supabase.ts` is marked
`server-only`, so importing it into a Client Component is a build error, not a
leak.

**Auth.** Email + bcrypt (cost 12), session in a signed `HS256` JWT in an
httpOnly, SameSite=Lax cookie. The role is re-read from the database on every
request rather than trusted from the token, so revoking an admin takes effect
immediately instead of whenever their week-old cookie expires. Failed logins
compare against a real decoy hash so a missing account and a wrong password cost
the same time.

**Address snapshots.** A request copies the customer's address and distance onto
its own row at creation. If the customer later moves — or the owner moves the
shop — a job already dispatched is not silently rewritten under the driver.

**Address lookup is pluggable.** [`src/lib/places/`](src/lib/places/) exposes
three functions — `suggestAddresses`, `resolveSuggestion`, `geocodeAddress` —
over two interchangeable providers:

| | Google Places | Nominatim (fallback) |
| --- | --- | --- |
| Needs | `GOOGLE_MAPS_API_KEY` + billing | nothing |
| Suggestion quality | street-level, clean one-line rows | coarser, POI-heavy |
| Rate limit | thousands/sec | **1/sec, hard** |
| Cost | free credit covers this easily | free |

Set the key and Google is used everywhere, including submit-time geocoding.
Leave it blank and everything still works on OpenStreetMap. If Google is
configured but failing, geocoding falls back to Nominatim rather than blocking
registrations — except on a genuine "no such address", which is an answer, not
an outage, and is surfaced as-is.

**Garbage input must not geocode.** Google answers almost anything: "asdkjhasd
nowhere at all 99999" comes back `status: OK`, formatted as *"United States"* —
the country centroid, typed `country`. Accepting that would place nonsense at a
real point and then measure a service-area distance from it. Results whose
types are *all* coarse regions (country, state, county) are rejected as
not-found. The check is a deny-list, not an allow-list: a laundromat's own
address is often a named business, which Google types `establishment`, and an
allow-list would have quietly rejected the owner's own shop.

**Rows are one line, full address** — "1520 Laurel Ave, Ambridge, PA, USA" —
which is how Google phrases its own predictions and what people recognise from
every maps search box. On the structured registration form, picking a row still
puts only the street on the street line and distributes city/state/ZIP to their
own fields.

**Autocomplete is two-phase.** Google's predictions carry no coordinates, so a
row costs a prediction call while typing and one Place Details call *only when
the user actually picks it*. Nominatim returns everything up front, so the
client skips the second call — the `resolved` field on a suggestion is what
signals which case applies.

**Session tokens are the cost story.** Google bills Places autocomplete per
*session* when a token is supplied and per *keystroke* when it is not. The
combobox mints a UUID when the user starts typing, passes it through every
prediction and the final details lookup, then discards it. Getting this wrong
is the classic way to turn a $0 bill into a $200 one.

Other things holding the request count down: a 350ms debounce, a 3-character
minimum, and an `AbortController` that cancels superseded keystrokes. On the
Nominatim path, requests that reach the front of the 1-req/sec queue already
aborted are dropped without calling upstream, and its own results are deduped —
one street address can otherwise come back six times, once per business
registered at it.

**Country is a hard restriction; distance is not.** Two different mechanisms,
often confused:

- `ADDRESS_COUNTRY_CODES` (default `us`) is a **filter**. A London address is
  not offered in the dropdown and will not geocode if typed by hand — a van
  cannot cross an ocean, so there is no reason to accept one.
- The location bias toward the shop is a **preference**. "120 Main" offers the
  Main Street a driver can reach, but an address 40 miles out still appears and
  still resolves — the service-area check then refuses it *with the distance
  spelled out*, which is far more useful than an empty dropdown.

The country filter is applied to the suggestion call **and** the submit-time
geocode. Restricting only the dropdown would leave the hand-typed path open.

On Google this is `includedRegionCodes` for predictions and
`components=country:US` for geocoding — note that Geocoding's `region`
parameter only *biases* and would not have held.

**The key never reaches the browser.** Both providers are called from server
routes (`/api/address/suggest`, `/api/address/details`) rather than Google's
client-side JS SDK. That keeps the credential server-side, avoids shipping
Google's bundle, and leaves one place to swap providers.

**It stays a plain text input, never a `<select>`.** No provider knows every
building, and a customer whose address is missing must still be able to type it
and submit. The dropdown is an accelerator, not a gate.

**Timezones.** "Today" is computed in `NEXT_PUBLIC_APP_TIMEZONE`, not the
server's. On a UTC host the naive version rejects same-day bookings after 7pm
Eastern.

---

## Edge cases handled

| Case | Behaviour |
| --- | --- |
| Address outside the radius | Blocked at registration, profile update, and booking, quoting distance vs. limit |
| Geocoder can't find the address | Distinct message from "out of range" — never conflated |
| Geocoder down or rate-limiting | Explicit "try again" rather than a silent pass |
| Owner shrinks the radius | Existing requests untouched; affected customers warned on their dashboard and listed for the admin |
| Owner has not configured settings yet | Every dependent page explains why it is unavailable |
| Booking a past date, or > 60 days out | Rejected server-side; the date input is also bounded |
| Impossible date (`2026-02-30`) | Rejected by calendar validation, not just a regex |
| Double-clicking Submit | Button disables in flight; a partial unique index in Postgres is the backstop |
| Two open requests, same day and type | Blocked by that index — cancel first, then rebook |
| Cancelling an already-completed request | Ownership and status are both in the `WHERE`; zero rows matched → explained |
| Two admins clicking at once | Status update re-asserts the status it read; the loser is told to refresh |
| Illegal status move (completed → planned) | Refused by a shared transition table; the UI only renders legal buttons |
| Customer cancelling someone else's request | Impossible — `user_id` is in the `WHERE` clause |
| Registering an email that already exists | Caught by pre-check *and* by the unique constraint, for the race between them |
| Password over 72 bytes | Rejected, rather than silently truncated by bcrypt |
| Admin visiting a customer page (or vice versa) | Redirected to their own portal |

---

## Commands

```bash
npm run dev            # development server
npm run build          # production build (runs TypeScript)
npm run lint
npm run typecheck
npm run create-admin   # seed or reset the owner account

npm test               # 15 logic tests — no database, no network
npm run verify         # 24 assertions against the live database
npm run e2e            # 28 browser assertions against a running dev server
npm run e2e:autocomplete   # 20 browser assertions for the address dropdowns
npm run check:places       # is the provider healthy, and is US-only holding?
npm run e2e:dropdown       # 10 render assertions, provider stubbed
```

`e2e:dropdown` intercepts the lookup and answers from a fixture, so the
dropdown's rendering is verified without depending on Google quota or
Nominatim's rate limit being healthy that day. `SHOT_PATH=… ` writes a
screenshot of the open list.

`check:places` probes five US and five non-US addresses through the live
endpoint. It deliberately reports **INCONCLUSIVE** (exit 2) when no US address
returns results either — a dead provider and a working country filter look
identical from the UI, and reporting "restriction verified" in that state would
be a lie that survives until a customer cannot register.

Set `DEBUG_PLACES=1` to log the exact upstream request each provider builds.

### Three layers of testing

**`npm test`** covers where a quiet bug would be most expensive: Haversine
maths (including antipodal and antimeridian cases), DST-safe date arithmetic,
calendar validation, the boundary condition at exactly the radius, and the
status transition table.

**`npm run verify`** asserts the database actually enforces what the schema
claims — the settings singleton rejecting a second row, case-insensitive
duplicate emails, the constraint requiring customers to carry geocoded
coordinates, the partial unique index blocking a second open pickup on one day
while still permitting a drop-off, compare-and-swap status updates not applying
twice, a customer being unable to cancel someone else's request, a cancelled
slot freeing up for rebooking, and `ON DELETE CASCADE`. It cleans up after
itself.

**`npm run e2e`** drives Chromium through the real forms: admin configures the
service area, the public checker accepts a nearby address and refuses a far one
with the distance quoted, out-of-range registration is blocked with no row
written, a customer registers and books, the duplicate guard fires, the admin
walks the request pending → planned → completed, cancellation works, and
shrinking the radius locks out an existing customer. It creates and destroys
its own throwaway admin, so it needs no credentials and never touches the real
owner account — just a dev server:

```bash
npm run dev
npm run e2e
npm run e2e:autocomplete
```

**`npm run e2e:autocomplete`** covers the dropdowns specifically: ARIA combobox
wiring, suggestions appearing while typing, no lookup under 3 characters,
picking an option filling the sibling city/state/ZIP fields *without* those
fields opening dropdowns of their own, arrow-key navigation, Enter selecting
rather than submitting, Escape closing, and an unknown address leaving the typed
text untouched.

> `npm run verify` and `npm run e2e` write to whatever database `.env.local`
> points at. Point them at a scratch project, not production.

### Node version

supabase-js constructs a realtime client eagerly, which needs a `WebSocket`
constructor that Node 20 does not expose globally. The `ws` package is wired in
as an explicit transport, so Node 20 and Node 22+ both work.
