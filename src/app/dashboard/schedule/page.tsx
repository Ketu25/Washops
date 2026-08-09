import Link from "next/link";

import { Container } from "@/components/layout/container";
import { PageHeader } from "@/components/layout/page-header";
import { SiteHeader } from "@/components/layout/site-header";
import { ScheduleForm } from "@/components/schedule-form";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { requireCustomer } from "@/lib/auth";
import { addDaysISO, MAX_ADVANCE_DAYS, todayISO } from "@/lib/dates";
import { formatMiles } from "@/lib/geo";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Schedule · Laundry Portal" };

export default async function SchedulePage() {
  const user = await requireCustomer();
  const settings = await getSettings();

  const today = todayISO();
  const outOfRange =
    settings !== null &&
    user.distance_miles !== null &&
    user.distance_miles > settings.service_radius_miles;
  const blocked = !settings || outOfRange;

  return (
    <>
      <SiteHeader />
      <main className="flex-1 py-8">
        <Container size="md">
          <PageHeader
            title="Request a pickup"
            description={
              settings
                ? `We will collect from or deliver to ${user.address_line1}${
                    user.city ? `, ${user.city}` : ""
                  }.`
                : undefined
            }
          />

          {!settings ? (
            <div className="mb-6">
              <Alert tone="warning" title="Scheduling is unavailable">
                The laundromat has not published its service area yet. Please
                check back shortly.
              </Alert>
            </div>
          ) : null}

          {outOfRange ? (
            <div className="mb-6">
              <Alert tone="error" title="Your address is outside our service area">
                Your address is {formatMiles(user.distance_miles!)} miles from{" "}
                {settings!.name}; our limit is{" "}
                {formatMiles(settings!.service_radius_miles)} miles.{" "}
                <Link href="/dashboard/profile">Update your address</Link> to book
                again.
              </Alert>
            </div>
          ) : null}

          <Card className="p-6">
            <ScheduleForm
              minDate={today}
              maxDate={addDaysISO(today, MAX_ADVANCE_DAYS)}
              disabled={blocked}
            />
          </Card>

          <p className="mt-4 text-xs text-fg-subtle">
            One open pickup per day, booked up to {MAX_ADVANCE_DAYS} days ahead.
            Your return is scheduled by us once the laundry is with us — it
            will appear on your dashboard.
          </p>
        </Container>
      </main>
    </>
  );
}
