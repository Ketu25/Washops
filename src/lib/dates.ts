/**
 * Scheduling is date-only, so every comparison has to happen in the
 * laundromat's local calendar. Doing it with `new Date()` on the server
 * would let a UTC-hosted deployment reject "today" as being in the past for
 * anyone west of Greenwich after 7pm — so all of it routes through an
 * explicit IANA timezone.
 */
/**
 * Read without a NEXT_PUBLIC_ prefix so it resolves at RUNTIME. Next inlines
 * NEXT_PUBLIC_ values at build time, which on a hosted build means the value
 * is frozen into the bundle — and if it was not set during the build, this
 * silently falls back to the server's timezone, which is UTC on Cloudflare
 * Workers. That would make same-day bookings unbookable after 7pm Eastern.
 * Nothing client-side imports this module, so the prefix bought nothing.
 */
export const APP_TIMEZONE =
  process.env.APP_TIMEZONE?.trim() ||
  process.env.NEXT_PUBLIC_APP_TIMEZONE?.trim() ||
  Intl.DateTimeFormat().resolvedOptions().timeZone ||
  "UTC";

/** Today in the laundromat's timezone, as `YYYY-MM-DD`. */
export function todayISO(timeZone: string = APP_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** `YYYY-MM-DD` offset by whole days, with no DST drift. */
export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Lexicographic comparison is correct for zero-padded ISO dates. */
export function isPastDate(iso: string, today: string = todayISO()): boolean {
  return iso < today;
}

/** How far ahead a customer may book. */
export const MAX_ADVANCE_DAYS = 60;

export function isTooFarAhead(iso: string, today: string = todayISO()): boolean {
  return iso > addDaysISO(today, MAX_ADVANCE_DAYS);
}

const DATE_LABEL = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});

/** Render `YYYY-MM-DD` as e.g. "Mon, Aug 4, 2026" without timezone shifting. */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return DATE_LABEL.format(new Date(Date.UTC(y, m - 1, d)));
}

export function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}
