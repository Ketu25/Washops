import { ProfileForm } from "@/components/profile-form";
import { SiteHeader } from "@/components/site-header";
import { Card, PageHeading } from "@/components/ui";
import { requireCustomer } from "@/lib/auth";
import { formatMiles } from "@/lib/geo";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export const metadata = { title: "Profile · Laundry Portal" };

export default async function ProfilePage() {
  const user = await requireCustomer();
  const settings = await getSettings();

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
        <PageHeading
          title="Your profile"
          description={`Signed in as ${user.email}.`}
        />

        {settings && user.distance_miles !== null ? (
          <Card className="mb-6 flex flex-wrap items-center justify-between gap-3 py-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">
                Distance to {settings.name}
              </p>
              <p className="mt-0.5 text-2xl font-semibold tabular-nums">
                {formatMiles(user.distance_miles)} mi
              </p>
            </div>
            <p className="text-sm text-muted">
              Service limit {formatMiles(settings.service_radius_miles)} mi
            </p>
          </Card>
        ) : null}

        <Card>
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
      </main>
    </>
  );
}
