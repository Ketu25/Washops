import Link from "next/link";
import { Suspense } from "react";

import { RequestFilters } from "@/components/request-filters";
import { RequestStatusActions } from "@/components/request-status-actions";
import { SiteHeader } from "@/components/site-header";
import {
  Alert,
  Card,
  EmptyState,
  PageHeading,
  Stat,
  StatusBadge,
  TypeBadge,
} from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { formatDate, formatDateTime, todayISO } from "@/lib/dates";
import { formatMiles } from "@/lib/geo";
import { getDashboardStats, listAdminRequests } from "@/lib/requests";
import { getSettings } from "@/lib/settings";
import type { RequestStatus, RequestType } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata = { title: "Admin · Laundry Portal" };

const STATUSES: RequestStatus[] = ["pending", "planned", "completed", "cancelled"];
const TYPES: RequestType[] = ["pickup", "dropoff"];

function parseStatus(value?: string): RequestStatus | "all" {
  return STATUSES.includes(value as RequestStatus)
    ? (value as RequestStatus)
    : "all";
}

function parseType(value?: string): RequestType | "all" {
  return TYPES.includes(value as RequestType) ? (value as RequestType) : "all";
}

function parseDate(value?: string): string | undefined {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  await requireAdmin();
  const params = await searchParams;

  const filters = {
    status: parseStatus(params.status as string | undefined),
    type: parseType(params.type as string | undefined),
    date: parseDate(params.date as string | undefined),
    search: typeof params.q === "string" ? params.q : undefined,
  };

  const [stats, requests, settings] = await Promise.all([
    getDashboardStats(),
    listAdminRequests(filters),
    getSettings(),
  ]);

  const today = todayISO();

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6">
        <PageHeading
          title="Requests"
          description={
            settings
              ? `${settings.name} · serving ${formatMiles(
                  settings.service_radius_miles,
                )} miles from ${settings.address}`
              : "Configure your laundromat location to start accepting requests."
          }
          actions={
            <Link
              href="/admin/settings"
              className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium transition hover:bg-background"
            >
              Settings
            </Link>
          }
        />

        {!settings ? (
          <div className="mb-6">
            <Alert tone="warning" title="Service area not configured">
              Customers cannot register or schedule until you set the
              laundromat address and service radius.{" "}
              <Link href="/admin/settings" className="font-medium underline underline-offset-4">
                Configure it now
              </Link>
              .
            </Alert>
          </div>
        ) : null}

        <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Pending" value={stats.pending} hint="Awaiting confirmation" />
          <Stat label="Planned" value={stats.planned} hint="On the route" />
          <Stat
            label="Today"
            value={stats.today}
            hint={`${stats.todayPickups} pickup${
              stats.todayPickups === 1 ? "" : "s"
            } · ${stats.todayDropoffs} drop-off${
              stats.todayDropoffs === 1 ? "" : "s"
            }`}
          />
          <Stat
            label="Upcoming"
            value={stats.upcomingWeek}
            hint="Open requests today or later"
          />
        </div>

        <Card className="mb-6">
          <Suspense fallback={<div className="h-20" />}>
            <RequestFilters today={today} />
          </Suspense>
        </Card>

        {requests.length === 0 ? (
          <EmptyState title="No requests match these filters">
            Try clearing the date or status filter.
          </EmptyState>
        ) : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[64rem] text-sm">
              <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Scheduled</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Address</th>
                  <th className="px-4 py-3 font-medium">Distance</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => (
                  <tr key={request.id} className="border-b border-line align-top last:border-0">
                    <td className="px-4 py-4">
                      <p className="font-medium">{formatDate(request.scheduled_date)}</p>
                      <p className="text-xs text-muted">{request.time_window}</p>
                      <p className="mt-1 text-xs text-muted">
                        Requested {formatDateTime(request.created_at)}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <TypeBadge type={request.type} />
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-medium">
                        {request.users?.full_name ?? "Deleted customer"}
                      </p>
                      <p className="text-xs text-muted">{request.users?.email}</p>
                      {request.users?.phone ? (
                        <p className="text-xs text-muted">{request.users.phone}</p>
                      ) : null}
                    </td>
                    <td className="max-w-xs px-4 py-4">
                      <p>{request.address_line1}</p>
                      {request.address_line2 ? (
                        <p className="text-xs text-muted">{request.address_line2}</p>
                      ) : null}
                      <p className="text-xs text-muted">
                        {[request.city, request.state, request.postal_code]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                      {request.notes ? (
                        <p className="mt-1.5 text-xs italic text-muted">
                          “{request.notes}”
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-4 tabular-nums text-muted">
                      {formatMiles(request.distance_miles)} mi
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status={request.status} />
                      {request.planned_at ? (
                        <p className="mt-1 text-xs text-muted">
                          Planned {formatDateTime(request.planned_at)}
                        </p>
                      ) : null}
                      {request.completed_at ? (
                        <p className="mt-1 text-xs text-muted">
                          Completed {formatDateTime(request.completed_at)}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-4">
                      <RequestStatusActions
                        requestId={request.id}
                        status={request.status}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        <p className="mt-4 text-xs text-muted">
          Showing {requests.length} request{requests.length === 1 ? "" : "s"}
          {requests.length === 500 ? " (capped at 500 — narrow the filters)" : ""}.
        </p>
      </main>
    </>
  );
}
