import { SettingsForm } from "@/components/settings-form";
import { SiteHeader } from "@/components/site-header";
import { Alert, Card, PageHeading } from "@/components/ui";
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
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
        <PageHeading
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

        <Card>
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
          <Card className="mt-6">
            <h2 className="text-sm font-semibold">Current coverage anchor</h2>
            <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[10rem_1fr]">
              <dt className="text-muted">Geocoded to</dt>
              <dd>{settings.formatted_address ?? settings.address}</dd>
              <dt className="text-muted">Coordinates</dt>
              <dd className="font-mono text-xs">
                {settings.latitude.toFixed(6)}, {settings.longitude.toFixed(6)}
              </dd>
              <dt className="text-muted">Radius</dt>
              <dd>{formatMiles(settings.service_radius_miles)} miles</dd>
              <dt className="text-muted">Last updated</dt>
              <dd>{formatDateTime(settings.updated_at)}</dd>
            </dl>
          </Card>
        ) : null}

        {outOfRange.length > 0 ? (
          <Card className="mt-6">
            <h2 className="text-sm font-semibold">
              Customers outside the current radius ({outOfRange.length})
            </h2>
            <p className="mb-3 mt-1 text-xs text-muted">
              These accounts already exist but can no longer book. Their
              in-flight requests are untouched.
            </p>
            <ul className="flex flex-col gap-1.5 text-sm">
              {outOfRange.map((customer) => (
                <li
                  key={customer.email}
                  className="flex items-center justify-between gap-4 border-b border-line pb-1.5 last:border-0"
                >
                  <span>
                    {customer.full_name}{" "}
                    <span className="text-muted">· {customer.email}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-muted">
                    {formatMiles(customer.distance)} mi
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </main>
    </>
  );
}
