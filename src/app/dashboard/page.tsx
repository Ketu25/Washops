import {
  CalendarPlus,
  Clock,
  Inbox,
  MapPin,
  PackageOpen,
  StickyNote,
} from "lucide-react";
import Link from "next/link";

import { CancelRequestButton } from "@/components/cancel-request-button";
import { Container } from "@/components/layout/container";
import { PageHeader } from "@/components/layout/page-header";
import { SiteHeader } from "@/components/layout/site-header";
import { EmptyState } from "@/components/patterns/empty-state";
import { StatusBadge, TypeBadge } from "@/components/patterns/request-badges";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requireCustomer } from "@/lib/auth";
import { formatDate, formatDateTime, todayISO } from "@/lib/dates";
import { formatMiles } from "@/lib/geo";
import { listCustomerRequests } from "@/lib/requests";
import { getSettings } from "@/lib/settings";
import { CANCELLABLE_STATUSES, REQUEST_TYPE_LABEL } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "My requests · Laundry Portal" };

export default async function CustomerDashboard() {
  const user = await requireCustomer();
  const [requests, settings] = await Promise.all([
    listCustomerRequests(user.id),
    getSettings(),
  ]);

  const today = todayISO();
  const upcoming = requests.filter(
    (request) =>
      CANCELLABLE_STATUSES.includes(request.status) &&
      request.scheduled_date >= today,
  );
  // Pickups the customer booked and we have already collected, with the
  // return not yet scheduled. Saying so beats an unexplained gap between
  // "completed" and a drop-off appearing days later.
  const awaitingReturn = requests.filter(
    (request) =>
      request.type === "pickup" &&
      request.status === "completed" &&
      !requests.some(
        (other) =>
          other.parent_pickup_id === request.id && other.status !== "cancelled",
      ),
  );
  const history = requests.filter((request) => !upcoming.includes(request));

  // The owner may have shrunk the radius since this customer registered.
  // Say so here rather than letting them discover it at submit time.
  const nowOutOfRange =
    settings !== null &&
    user.distance_miles !== null &&
    user.distance_miles > settings.service_radius_miles;

  return (
    <>
      <SiteHeader />
      <main className="flex-1 py-8">
        <Container size="lg">
          <PageHeader
            title={`Hello, ${user.full_name.split(" ")[0]}`}
            description="Request a pickup, track it, and see when we are bringing your laundry back."
            actions={
              <Button asChild>
                <Link href="/dashboard/schedule">
                  <CalendarPlus aria-hidden />
                  Request a pickup
                </Link>
              </Button>
            }
          />

          {nowOutOfRange ? (
            <div className="mb-6">
              <Alert tone="warning" title="Your address is now outside our service area">
                Your address is {formatMiles(user.distance_miles!)} miles from{" "}
                {settings!.name}, and our current limit is{" "}
                {formatMiles(settings!.service_radius_miles)} miles. Existing
                requests are unaffected, but you will not be able to book new
                ones. <Link href="/dashboard/profile">Update your address</Link>.
              </Alert>
            </div>
          ) : null}

          <section className="mb-10">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-fg-subtle">
              Upcoming
            </h2>
            {upcoming.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title="Nothing scheduled"
                description="Request a pickup and it will appear here. We book the return ourselves once your laundry is with us."
                action={
                  <Button asChild>
                    <Link href="/dashboard/schedule">Request a pickup</Link>
                  </Button>
                }
              />
            ) : (
              <ul className="flex flex-col gap-3">
                {upcoming.map((request) => (
                  <li key={request.id}>
                    {/* A left status rail gives the card an at-a-glance state
                        without another badge competing for attention. */}
                    <Card className="relative overflow-hidden p-5 pl-6">
                      <span
                        aria-hidden
                        className={`absolute inset-y-0 left-0 w-1 ${
                          request.status === "planned" ? "bg-brand" : "bg-warning"
                        }`}
                      />
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <TypeBadge type={request.type} />
                            <StatusBadge status={request.status} />
                          </div>

                          <p className="mt-3 text-lg font-semibold text-fg">
                            {formatDate(request.scheduled_date)}
                          </p>
                          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-fg-muted">
                            <Clock aria-hidden className="size-3.5" />
                            {request.time_window}
                          </p>
                          <p className="mt-2 flex items-start gap-1.5 text-sm text-fg-muted">
                            <MapPin aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                            <span>
                              {request.address_line1}
                              {request.address_line2 ? `, ${request.address_line2}` : ""}
                              {request.city ? `, ${request.city}` : ""}
                            </span>
                          </p>
                          {request.notes ? (
                            <p className="mt-2 flex items-start gap-1.5 text-sm text-fg-muted">
                              <StickyNote aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                              <span className="italic">{request.notes}</span>
                            </p>
                          ) : null}

                          <p
                            className={`mt-3 text-sm ${
                              request.status === "planned"
                                ? "text-success-fg"
                                : "text-fg-subtle"
                            }`}
                          >
                            {request.type === "dropoff"
                              ? "We are bringing your clean laundry back."
                              : request.status === "planned"
                                ? "Confirmed — we have you on the route."
                                : "Awaiting confirmation from the laundromat."}
                          </p>
                        </div>

                        {/*
                          Only pickups can be cancelled here. A drop-off is
                          the laundromat returning the customer's property —
                          withdrawing it is not theirs to do, and the server
                          rejects it regardless of what the UI shows.
                        */}
                        {request.type === "pickup" ? (
                          <CancelRequestButton
                            requestId={request.id}
                            label={`${REQUEST_TYPE_LABEL[
                              request.type
                            ].toLowerCase()} on ${formatDate(request.scheduled_date)}`}
                          />
                        ) : (
                          <Badge tone="brand">Arranged by us</Badge>
                        )}
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {awaitingReturn.length > 0 ? (
            <section className="mb-10">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-fg-subtle">
                With us now
              </h2>
              <ul className="flex flex-col gap-3">
                {awaitingReturn.map((request) => (
                  <li key={request.id}>
                    <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
                      <div className="min-w-0">
                        <p className="font-medium text-fg">
                          Collected {formatDate(request.scheduled_date)}
                        </p>
                        <p className="mt-0.5 text-sm text-fg-muted">
                          We will schedule the return and it will appear under
                          Upcoming.
                        </p>
                      </div>
                      <Badge tone="warning">
                        <PackageOpen aria-hidden className="size-3" />
                        Being washed
                      </Badge>
                    </Card>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-fg-subtle">
              History
            </h2>
            {history.length === 0 ? (
              <EmptyState icon={Inbox} title="No past requests yet" />
            ) : (
              <TableWrap>
                <Table className="min-w-[38rem]">
                  <THead>
                    <TR className="hover:bg-transparent">
                      <TH>Date</TH>
                      <TH>Window</TH>
                      <TH>Type</TH>
                      <TH>Status</TH>
                      <TH>Requested</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {history.map((request) => (
                      <TR key={request.id}>
                        <TD className="font-medium whitespace-nowrap">
                          {formatDate(request.scheduled_date)}
                        </TD>
                        <TD className="whitespace-nowrap text-fg-muted">
                          {request.time_window}
                        </TD>
                        <TD>
                          <TypeBadge type={request.type} />
                        </TD>
                        <TD>
                          <StatusBadge status={request.status} />
                        </TD>
                        <TD className="whitespace-nowrap text-fg-subtle">
                          {formatDateTime(request.created_at)}
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </TableWrap>
            )}
          </section>
        </Container>
      </main>
    </>
  );
}
