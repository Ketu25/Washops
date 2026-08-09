import {
  CalendarDays,
  ClipboardList,
  Clock3,
  Inbox,
  PackageOpen,
  Settings2,
  Truck,
} from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { Container } from "@/components/layout/container";
import { PageHeader } from "@/components/layout/page-header";
import { SiteHeader } from "@/components/layout/site-header";
import { EmptyState } from "@/components/patterns/empty-state";
import { StatCard } from "@/components/patterns/stat-card";
import { StatusBadge, TypeBadge } from "@/components/patterns/request-badges";
import { RequestFilters } from "@/components/request-filters";
import { RequestStatusActions } from "@/components/request-status-actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requireAdmin } from "@/lib/auth";
import { addDaysISO, formatDate, formatDateTime, MAX_ADVANCE_DAYS, todayISO } from "@/lib/dates";
import { formatMiles } from "@/lib/geo";
import {
  getDashboardStats,
  listAdminRequests,
  listPickupsAwaitingDropoff,
  type AdminStatusFilter,
} from "@/lib/requests";
import { getSettings } from "@/lib/settings";
import type { RequestStatus, RequestType } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Laundry Portal" };

const STATUSES: RequestStatus[] = ["pending", "planned", "completed", "cancelled"];
const TYPES: RequestType[] = ["pickup", "dropoff"];

function parseStatus(value?: string): AdminStatusFilter {
  if (value === "awaiting_dropoff") return "awaiting_dropoff";
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

  const [stats, requests, settings, awaitingDropoff] = await Promise.all([
    getDashboardStats(),
    listAdminRequests(filters),
    getSettings(),
    listPickupsAwaitingDropoff(),
  ]);

  const today = todayISO();
  const maxDate = addDaysISO(today, MAX_ADVANCE_DAYS);

  return (
    <>
      <SiteHeader />
      <main className="flex-1 py-8">
        <Container size="full">
          <PageHeader
            title="Requests"
            description={
              settings
                ? `${settings.name} · serving ${formatMiles(
                    settings.service_radius_miles,
                  )} miles from ${settings.address}`
                : "Configure your laundromat location to start accepting requests."
            }
            actions={
              <Button asChild variant="secondary">
                <Link href="/admin/settings">
                  <Settings2 aria-hidden />
                  Settings
                </Link>
              </Button>
            }
          />

          {!settings ? (
            <div className="mb-6">
              <Alert tone="warning" title="Service area not configured">
                Customers cannot register or schedule until you set the
                laundromat address and service radius.{" "}
                <Link href="/admin/settings">Configure it now</Link>.
              </Alert>
            </div>
          ) : null}

          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard
              label="Pending"
              value={stats.pending}
              hint="Awaiting confirmation"
              icon={Clock3}
              tone="warning"
            />
            <StatCard
              label="Planned"
              value={stats.planned}
              hint="On the route"
              icon={Truck}
              tone="brand"
            />
            <StatCard
              label="Awaiting drop-off"
              value={stats.awaitingDropoff}
              hint="Collected, not yet booked back"
              icon={PackageOpen}
              tone={stats.awaitingDropoff > 0 ? "warning" : "neutral"}
            />
            <StatCard
              label="Today"
              value={stats.today}
              hint={`${stats.todayPickups} pickup${
                stats.todayPickups === 1 ? "" : "s"
              } · ${stats.todayDropoffs} drop-off${
                stats.todayDropoffs === 1 ? "" : "s"
              }`}
              icon={CalendarDays}
            />
            <StatCard
              label="Upcoming"
              value={stats.upcomingWeek}
              hint="Open requests today or later"
              icon={ClipboardList}
            />
          </div>

          <Card className="mb-4 p-4">
            <Suspense fallback={<div className="h-16" />}>
              <RequestFilters today={today} />
            </Suspense>
          </Card>

          {requests.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="No requests match these filters"
              description="Try clearing the date or status filter."
            />
          ) : (
            <TableWrap>
              <Table className="min-w-[60rem]">
                <THead>
                  <TR className="hover:bg-transparent">
                    <TH className="w-44">Scheduled</TH>
                    <TH className="w-28">Type</TH>
                    <TH className="w-56">Customer</TH>
                    <TH>Address</TH>
                    <TH className="w-20 text-right">Distance</TH>
                    <TH className="w-40">Status</TH>
                    <TH className="w-52">Actions</TH>
                  </TR>
                </THead>
                <TBody>
                  {requests.map((request) => (
                    <TR key={request.id}>
                      <TD>
                        <p className="font-medium whitespace-nowrap">
                          {formatDate(request.scheduled_date)}
                        </p>
                        <p className="mt-0.5 whitespace-nowrap text-xs text-fg-muted">
                          {request.time_window}
                        </p>
                        <p className="mt-1 whitespace-nowrap text-xs text-fg-subtle">
                          Requested {formatDateTime(request.created_at)}
                        </p>
                      </TD>

                      <TD>
                        <TypeBadge type={request.type} />
                      </TD>

                      <TD>
                        <p className="font-medium">
                          {request.users?.full_name ?? "Deleted customer"}
                        </p>
                        <p className="truncate text-xs text-fg-muted">
                          {request.users?.email}
                        </p>
                        {request.users?.phone ? (
                          <p className="text-xs text-fg-muted">{request.users.phone}</p>
                        ) : null}
                      </TD>

                      {/* The old table let a long street name wrap mid-address
                          into three ragged lines. A fixed minimum plus
                          balanced wrapping keeps it to two tidy ones. */}
                      <TD className="min-w-56">
                        <p className="text-pretty">{request.address_line1}</p>
                        {request.address_line2 ? (
                          <p className="text-xs text-fg-muted">{request.address_line2}</p>
                        ) : null}
                        <p className="text-xs text-fg-muted">
                          {[request.city, request.state, request.postal_code]
                            .filter(Boolean)
                            .join(", ")}
                        </p>
                        {request.notes ? (
                          <p className="mt-1.5 border-l-2 border-line pl-2 text-xs italic text-fg-subtle">
                            {request.notes}
                          </p>
                        ) : null}
                      </TD>

                      <TD className="text-right tabular-nums whitespace-nowrap text-fg-muted">
                        {formatMiles(request.distance_miles)} mi
                      </TD>

                      <TD>
                        <StatusBadge status={request.status} />
                        {request.completed_at ? (
                          <p className="mt-1.5 whitespace-nowrap text-xs text-fg-subtle">
                            {formatDateTime(request.completed_at)}
                          </p>
                        ) : request.planned_at ? (
                          <p className="mt-1.5 whitespace-nowrap text-xs text-fg-subtle">
                            {formatDateTime(request.planned_at)}
                          </p>
                        ) : null}
                      </TD>

                      <TD>
                        <RequestStatusActions
                          requestId={request.id}
                          status={request.status}
                          type={request.type}
                          dropoff={
                            request.type === "pickup" &&
                            request.status === "completed"
                              ? {
                                  scheduled: !awaitingDropoff.has(request.id),
                                  customerName:
                                    request.users?.full_name ?? "this customer",
                                  pickupDate: formatDate(request.scheduled_date),
                                  // Never offer a return before the collection.
                                  minDate:
                                    request.scheduled_date > today
                                      ? request.scheduled_date
                                      : today,
                                  maxDate,
                                }
                              : undefined
                          }
                        />
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableWrap>
          )}

          <p className="mt-3 text-xs text-fg-subtle">
            Showing {requests.length} request{requests.length === 1 ? "" : "s"}
            {requests.length === 500 ? " (capped at 500 — narrow the filters)" : ""}.
          </p>
        </Container>
      </main>
    </>
  );
}
