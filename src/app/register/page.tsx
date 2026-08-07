import Link from "next/link";
import { redirect } from "next/navigation";

import { RegisterForm } from "@/components/register-form";
import { SiteHeader } from "@/components/site-header";
import { Alert, Card } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { formatMiles } from "@/lib/geo";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export const metadata = { title: "Create account · Laundry Portal" };

export default async function RegisterPage() {
  const [user, settings] = await Promise.all([getCurrentUser(), getSettings()]);
  if (user) redirect(user.role === "admin" ? "/admin" : "/dashboard");

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 sm:px-6">
        <Card>
          <h1 className="text-xl font-semibold">Create your account</h1>
          <p className="mb-6 mt-1 text-sm text-muted">
            {settings
              ? `${settings.name} picks up and drops off within ${formatMiles(
                  settings.service_radius_miles,
                )} miles.`
              : "Set up an account to schedule pickups and drop-offs."}
          </p>

          {!settings ? (
            <div className="mb-5">
              <Alert tone="warning">
                Registration is temporarily unavailable — the laundromat has not
                published its service area yet. Please check back shortly.
              </Alert>
            </div>
          ) : null}

          <RegisterForm
            radiusLabel={
              settings ? formatMiles(settings.service_radius_miles) : null
            }
          />

          <p className="mt-6 text-sm text-muted">
            Already registered?{" "}
            <Link href="/login" className="font-medium text-brand underline underline-offset-4">
              Sign in
            </Link>
          </p>
        </Card>
      </main>
    </>
  );
}
