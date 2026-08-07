import Link from "next/link";

import { CancelRequestButton } from "@/components/cancel-request-button";
import { SiteHeader } from "@/components/site-header";
import {
  Alert,
  Card,
  EmptyState,
  PageHeading,
  StatusBadge,
  TypeBadge,
} from "@/components/ui";
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
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
        <PageHeading
          title={`Hello, ${user.full_name.split(" ")[0]}`}
          description="Track your pickups and drop-offs, and cancel anything that has not been completed yet."
          actions={
            <Link
              href="/dashboard/schedule"
              className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-strong"
            >
              Schedule a request
            </Link>
          }
        />

        {nowOutOfRange ? (
          <div className="mb-6">
            <Alert tone="warning" title="Your address is now outside our service area">
              Your address is {formatMiles(user.distance_miles!)} miles from{" "}
              {settings!.name}, and our current limit is{" "}
              {formatMiles(settings!.service_radius_miles)} miles. Existing
              requests are unaffected, but you will not be able to book new
              ones.{" "}
              <Link href="/dashboard/profile" className="font-medium underline underline-offset-4">
                Update your address
              </Link>
              .
            </Alert>
          </div>
        ) : null}

        <section className="mb-10">
          <h2 className="mb-3 text-lg font-semibold">Upcoming</h2>
          {upcoming.length === 0 ? (
            <EmptyState title="Nothing scheduled">
              <Link href="/dashboard/schedule" className="text-brand underline underline-offset-4">
                Schedule a pickup or drop-off
              </Link>
            </EmptyState>
          ) : (
            <ul className="flex flex-col gap-3">
              {upcoming.map((request) => (
                <li key={request.id}>
                  <Card className="flex flex-wrap items-start justify-between gap-4 p-5">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <TypeBadge type={request.type} />
                        <StatusBadge status={request.status} />
                      </div>
                      <p className="mt-2 font-medium">
                        {formatDate(request.scheduled_date)} · {request.time_window}
                      </p>
                      <p className="mt-0.5 text-sm text-muted">
                        {request.address_line1}
                        {request.address_line2 ? `, ${request.address_line2}` : ""}
                        {request.city ? `, ${request.city}` : ""}
                      </p>
                      {request.notes ? (
                        <p className="mt-2 text-sm text-muted">
                          <span className="font-medium text-foreground">Notes:</span>{" "}
                          {request.notes}
                        </p>
                      ) : null}
                      {request.status === "planned" ? (
                        <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-400">
                          Confirmed — we have you on the route.
                        </p>
                      ) : (
                        <p className="mt-2 text-sm text-muted">
                          Awaiting confirmation from the laundromat.
                        </p>
                      )}
                    </div>

                    <CancelRequestButton
                      requestId={request.id}
                      label={`${REQUEST_TYPE_LABEL[
                        request.type
                      ].toLowerCase()} on ${formatDate(request.scheduled_date)}`}
                    />
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">History</h2>
          {history.length === 0 ? (
            <EmptyState title="No past requests yet" />
          ) : (
            <Card className="overflow-x-auto p-0">
              <table className="w-full min-w-[36rem] text-sm">
                <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-5 py-3 font-medium">Date</th>
                    <th className="px-5 py-3 font-medium">Window</th>
                    <th className="px-5 py-3 font-medium">Type</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Requested</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((request) => (
                    <tr key={request.id} className="border-b border-line last:border-0">
                      <td className="px-5 py-3">{formatDate(request.scheduled_date)}</td>
                      <td className="px-5 py-3 text-muted">{request.time_window}</td>
                      <td className="px-5 py-3">
                        <TypeBadge type={request.type} />
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge status={request.status} />
                      </td>
                      <td className="px-5 py-3 text-muted">
                        {formatDateTime(request.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </section>
      </main>
    </>
  );
}
