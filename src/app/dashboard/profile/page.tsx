import { Navigation } from "lucide-react";

import { Container } from "@/components/layout/container";
import { PageHeader } from "@/components/layout/page-header";
import { SiteHeader } from "@/components/layout/site-header";
import { ProfileForm } from "@/components/profile-form";
import { Card } from "@/components/ui/card";
import { requireCustomer } from "@/lib/auth";
import { formatMiles } from "@/lib/geo";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Profile · Laundry Portal" };

export default async function ProfilePage() {
  const user = await requireCustomer();
  const settings = await getSettings();

  const distance = user.distance_miles;
  const radius = settings?.service_radius_miles;
  // A bar is easier to read than two numbers: it shows how much room is left
  // before an address change would push this customer out of range.
  const pct =
    distance !== null && radius ? Math.min(100, (distance / radius) * 100) : null;
  const outOfRange = pct !== null && pct >= 100;

  return (
    <>
      <SiteHeader />
      <main className="flex-1 py-8">
        <Container size="md">
          <PageHeader title="Your profile" description={`Signed in as ${user.email}.`} />

          {settings && distance !== null && pct !== null ? (
            <Card className="mb-6 p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="flex items-center gap-1.5 text-xs font-medium text-fg-muted">
                  <Navigation aria-hidden className="size-3.5" />
                  Distance to {settings.name}
                </p>
                <p className="text-xs text-fg-subtle">
                  Limit {formatMiles(radius!)} mi
                </p>
              </div>
              <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-fg">
                {formatMiles(distance)}
                <span className="ml-1 text-base font-normal text-fg-subtle">mi</span>
              </p>
              <div
                role="meter"
                aria-valuenow={Math.round(pct)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Distance used against the service radius"
                className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-sunken"
              >
                <div
                  className={`h-full rounded-full transition-[width] duration-500 ${
                    outOfRange ? "bg-danger" : "bg-brand"
                  }`}
                  style={{ width: `${Math.max(3, pct)}%` }}
                />
              </div>
            </Card>
          ) : null}

          <Card className="p-6">
            <ProfileForm
              defaults={{
                fullName: user.full_name,
                phone: user.phone ?? "",
                addressLine1: user.address_line1 ?? "",
                addressLine2: user.address_line2 ?? "",
                city: user.city ?? "",
                state: user.state ?? "",
                postalCode: user.postal_code ?? "",
              }}
            />
          </Card>
        </Container>
      </main>
    </>
  );
}
