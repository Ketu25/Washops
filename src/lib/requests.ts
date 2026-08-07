import "server-only";

import { haversineMiles } from "./geo";
import { getSettings } from "./settings";
import { db } from "./supabase";
import {
  isPastDate,
  isTooFarAhead,
  MAX_ADVANCE_DAYS,
  todayISO,
} from "./dates";
import { checkDistanceAgainstSettings, outOfRangeMessage } from "./service-area";
import { canTransition } from "./transitions";
import {
  CANCELLABLE_STATUSES,
  OPEN_STATUSES,
  REQUEST_TYPE_LABEL,
  type PublicUser,
  type RequestRow,
  type RequestStatus,
  type RequestType,
  type RequestWithCustomer,
  type TimeWindow,
} from "./types";

const REQUEST_COLUMNS =
  "id, user_id, type, status, scheduled_date, time_window, notes, admin_notes, " +
  "address_line1, address_line2, city, state, postal_code, formatted_address, " +
  "latitude, longitude, distance_miles, planned_at, completed_at, cancelled_at, " +
  "created_at, updated_at";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export interface CreateRequestInput {
  type: RequestType;
  scheduledDate: string;
  timeWindow: TimeWindow;
  notes?: string | null;
}

/**
 * Create a pickup or drop-off request.
 *
 * The customer's address was already geocoded when they registered or last
 * updated their profile, so we reuse those coordinates instead of burning a
 * geocoder call — but the distance is re-checked against the CURRENT radius,
 * because the owner may have shrunk the service area since the customer
 * signed up.
 */
export async function createRequest(
  user: PublicUser,
  input: CreateRequestInput,
): Promise<ActionResult<RequestRow>> {
  if (user.role !== "customer") {
    return { ok: false, error: "Only customer accounts can schedule requests." };
  }

  if (
    user.latitude === null ||
    user.longitude === null ||
    !user.address_line1
  ) {
    return {
      ok: false,
      error:
        "Your account is missing a verified home address. Please update your profile before scheduling.",
    };
  }

  const settings = await getSettings();
  if (!settings) {
    return {
      ok: false,
      error:
        "The laundromat has not published its service area yet. Scheduling is temporarily unavailable.",
    };
  }

  const today = todayISO();
  if (isPastDate(input.scheduledDate, today)) {
    return { ok: false, error: "Please choose today or a future date." };
  }
  if (isTooFarAhead(input.scheduledDate, today)) {
    return {
      ok: false,
      error: `Requests can be scheduled up to ${MAX_ADVANCE_DAYS} days in advance.`,
    };
  }

  const distanceMiles = haversineMiles(
    { latitude: settings.latitude, longitude: settings.longitude },
    { latitude: user.latitude, longitude: user.longitude },
  );

  if (!checkDistanceAgainstSettings(distanceMiles, settings)) {
    return {
      ok: false,
      error: outOfRangeMessage(distanceMiles, settings.service_radius_miles),
    };
  }

  const { data, error } = await db()
    .from("requests")
    .insert({
      user_id: user.id,
      type: input.type,
      status: "pending" satisfies RequestStatus,
      scheduled_date: input.scheduledDate,
      time_window: input.timeWindow,
      notes: input.notes?.trim() || null,
      address_line1: user.address_line1,
      address_line2: user.address_line2,
      city: user.city,
      state: user.state,
      postal_code: user.postal_code,
      formatted_address: user.formatted_address,
      latitude: user.latitude,
      longitude: user.longitude,
      distance_miles: distanceMiles,
    })
    .select(REQUEST_COLUMNS)
    .single();

  if (error) {
    // 23505 = the partial unique index guarding one open request per
    // customer, per type, per day. Reaching it means a double submit or a
    // second tab, not a bug.
    if (error.code === "23505") {
      return {
        ok: false,
        error: `You already have an open ${REQUEST_TYPE_LABEL[
          input.type
        ].toLowerCase()} request for that date. Cancel it first to book a different time.`,
      };
    }
    return { ok: false, error: `Could not create the request: ${error.message}` };
  }

  return { ok: true, data: data as unknown as RequestRow };
}

export async function listCustomerRequests(
  userId: string,
): Promise<RequestRow[]> {
  const { data, error } = await db()
    .from("requests")
    .select(REQUEST_COLUMNS)
    .eq("user_id", userId)
    .order("scheduled_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to load your requests: ${error.message}`);
  return (data ?? []) as unknown as RequestRow[];
}

/**
 * Cancel an open request.
 *
 * Ownership and the allowed statuses are both expressed in the WHERE clause,
 * so a customer cannot cancel someone else's request and a request the admin
 * just marked completed cannot be pulled back — the update simply matches
 * zero rows and we report why.
 */
export async function cancelRequest(
  userId: string,
  requestId: string,
): Promise<ActionResult> {
  const { data, error } = await db()
    .from("requests")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("user_id", userId)
    .in("status", CANCELLABLE_STATUSES)
    .select("id");

  if (error) {
    return { ok: false, error: `Could not cancel the request: ${error.message}` };
  }
  if (!data || data.length === 0) {
    return {
      ok: false,
      error:
        "That request can no longer be cancelled. It may already be completed or cancelled.",
    };
  }
  return { ok: true, data: undefined };
}

export interface AdminRequestFilters {
  status?: RequestStatus | "all";
  type?: RequestType | "all";
  date?: string;
  search?: string;
}

export async function listAdminRequests(
  filters: AdminRequestFilters = {},
): Promise<RequestWithCustomer[]> {
  let query = db()
    .from("requests")
    .select(
      `${REQUEST_COLUMNS}, users:user_id ( id, full_name, email, phone )`,
    )
    .order("scheduled_date", { ascending: true })
    .order("time_window", { ascending: true })
    .limit(500);

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }
  if (filters.type && filters.type !== "all") {
    query = query.eq("type", filters.type);
  }
  if (filters.date) {
    query = query.eq("scheduled_date", filters.date);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to load requests: ${error.message}`);

  let rows = (data ?? []) as unknown as RequestWithCustomer[];

  // Name/email search is applied in memory: it spans a joined table, which
  // PostgREST cannot filter on without an embedded-resource `!inner` join
  // that would also change the row shape. The 500-row cap keeps this cheap.
  const term = filters.search?.trim().toLowerCase();
  if (term) {
    rows = rows.filter((row) => {
      const haystack = [
        row.users?.full_name,
        row.users?.email,
        row.address_line1,
        row.city,
        row.postal_code,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }

  return rows;
}

export async function setRequestStatus(
  requestId: string,
  next: RequestStatus,
): Promise<ActionResult<RequestRow>> {
  const { data: current, error: readError } = await db()
    .from("requests")
    .select("id, status")
    .eq("id", requestId)
    .maybeSingle();

  if (readError) {
    return { ok: false, error: `Could not load the request: ${readError.message}` };
  }
  if (!current) {
    return { ok: false, error: "That request no longer exists." };
  }

  const from = current.status as RequestStatus;
  if (from === next) {
    return { ok: false, error: `This request is already ${next}.` };
  }
  if (!canTransition(from, next)) {
    return {
      ok: false,
      error: `A ${from} request cannot be moved to ${next}.`,
    };
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status: next };
  if (next === "planned") patch.planned_at = now;
  if (next === "completed") patch.completed_at = now;
  if (next === "cancelled") patch.cancelled_at = now;

  // Re-assert the status we read, so two admins clicking at once cannot both
  // "win" — the second update matches nothing and gets told to refresh.
  const { data, error } = await db()
    .from("requests")
    .update(patch)
    .eq("id", requestId)
    .eq("status", from)
    .select(REQUEST_COLUMNS)
    .maybeSingle();

  if (error) {
    return { ok: false, error: `Could not update the request: ${error.message}` };
  }
  if (!data) {
    return {
      ok: false,
      error: "Someone else just changed this request. Refresh and try again.",
    };
  }

  return { ok: true, data: data as unknown as RequestRow };
}

export interface DashboardStats {
  pending: number;
  planned: number;
  completed: number;
  cancelled: number;
  today: number;
  todayPickups: number;
  todayDropoffs: number;
  upcomingWeek: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const today = todayISO();

  const countWhere = async (
    apply: (q: ReturnType<typeof baseCount>) => ReturnType<typeof baseCount>,
  ) => {
    const { count, error } = await apply(baseCount());
    if (error) throw new Error(`Failed to load stats: ${error.message}`);
    return count ?? 0;
  };

  function baseCount() {
    return db().from("requests").select("id", { count: "exact", head: true });
  }

  const [
    pending,
    planned,
    completed,
    cancelled,
    todayCount,
    todayPickups,
    todayDropoffs,
    upcomingWeek,
  ] = await Promise.all([
    countWhere((q) => q.eq("status", "pending")),
    countWhere((q) => q.eq("status", "planned")),
    countWhere((q) => q.eq("status", "completed")),
    countWhere((q) => q.eq("status", "cancelled")),
    countWhere((q) => q.eq("scheduled_date", today).in("status", OPEN_STATUSES)),
    countWhere((q) =>
      q.eq("scheduled_date", today).eq("type", "pickup").in("status", OPEN_STATUSES),
    ),
    countWhere((q) =>
      q.eq("scheduled_date", today).eq("type", "dropoff").in("status", OPEN_STATUSES),
    ),
    countWhere((q) =>
      q.gte("scheduled_date", today).in("status", OPEN_STATUSES),
    ),
  ]);

  return {
    pending,
    planned,
    completed,
    cancelled,
    today: todayCount,
    todayPickups,
    todayDropoffs,
    upcomingWeek,
  };
}
