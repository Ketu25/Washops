import { MapPin, TriangleAlert } from "lucide-react";

import { Container } from "@/components/layout/container";
import { PageHeader } from "@/components/layout/page-header";
import { SiteHeader } from "@/components/layout/site-header";
import { SettingsForm } from "@/components/settings-form";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/dates";
import { formatMiles } from "@/lib/geo";
import { getSettings } from "@/lib/settings";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings · Laundry Portal" };

export default async function AdminSettingsPage() {
  await requireAdmin();
  const settings = await getSettings();

  // Surface anyone the current radius has locked out, so a radius change is
  // never a silent decision.
  let outOfRange: Array<{ full_name: string; email: string; distance: number }> = [];
  if (settings) {
    const { data } = await db()
      .from("users")
      .select("full_name, email, distance_miles")
      .eq("role", "customer")
      .gt("distance_miles", settings.service_radius_miles)
      .order("distance_miles", { ascending: true })
      .limit(50);

    outOfRange = (data ?? []).map((row) => ({
      full_name: row.full_name as string,
      email: row.email as string,
      distance: Number(row.distance_miles),
    }));
  }

  return (
    <>
      <SiteHeader />
      <main className="flex-1 py-8">
        <Container size="md">
          <PageHeader
            title="Laundromat settings"
            description="Your location and service radius drive every coverage check in the portal."
          />

          {!settings ? (
            <div className="mb-6">
              <Alert tone="warning" title="Not configured yet">
                Until you save these settings, customers cannot register, check
                coverage, or schedule anything.
              </Alert>
            </div>
          ) : null}

          <Card className="p-6">
            <SettingsForm
              defaults={{
                name: settings?.name ?? "",
                address: settings?.address ?? "",
                serviceRadiusMiles: settings
                  ? String(settings.service_radius_miles)
                  : "5",
              }}
            />
          </Card>

          {settings ? (
            <Card className="mt-5 p-5">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-fg">
                <MapPin aria-hidden className="size-3.5 text-brand" />
                Current coverage anchor
              </h2>
              <dl className="mt-3 grid gap-x-6 gap-y-2.5 text-sm sm:grid-cols-[9rem_1fr]">
                <dt className="text-fg-muted">Geocoded to</dt>
                <dd className="text-fg">
                  {settings.formatted_address ?? settings.address}
                </dd>
                <dt className="text-fg-muted">Coordinates</dt>
                <dd className="font-mono text-xs text-fg">
                  {settings.latitude.toFixed(6)}, {settings.longitude.toFixed(6)}
                </dd>
                <dt className="text-fg-muted">Radius</dt>
                <dd className="text-fg">
                  {formatMiles(settings.service_radius_miles)} miles
                </dd>
                <dt className="text-fg-muted">Last updated</dt>
                <dd className="text-fg">{formatDateTime(settings.updated_at)}</dd>
              </dl>
            </Card>
          ) : null}

          {outOfRange.length > 0 ? (
            <Card className="mt-5 p-5">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-fg">
                <TriangleAlert aria-hidden className="size-3.5 text-warning" />
                Customers outside the current radius ({outOfRange.length})
              </h2>
              <p className="mb-3 mt-1 text-xs text-fg-subtle">
                These accounts already exist but can no longer book. Their
                in-flight requests are untouched.
              </p>
              <ul className="divide-y divide-line text-sm">
                {outOfRange.map((customer) => (
                  <li
                    key={customer.email}
                    className="flex items-center justify-between gap-4 py-2"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-fg">
                        {customer.full_name}
                      </span>
                      <span className="block truncate text-xs text-fg-muted">
                        {customer.email}
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums text-fg-muted">
                      {formatMiles(customer.distance)} mi
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </Container>
      </main>
    </>
  );
}
