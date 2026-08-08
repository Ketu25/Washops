import Link from "next/link";
import { redirect } from "next/navigation";

import { Container } from "@/components/layout/container";
import { SiteHeader } from "@/components/layout/site-header";
import { RegisterForm } from "@/components/register-form";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
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
      <main className="flex-1 py-12">
        <Container size="md">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-fg">Create your account</h1>
            <p className="mt-1.5 text-sm text-fg-muted">
              {settings
                ? `${settings.name} picks up and drops off within ${formatMiles(
                    settings.service_radius_miles,
                  )} miles.`
                : "Set up an account to schedule pickups and drop-offs."}
            </p>
          </div>

          {!settings ? (
            <div className="mb-5">
              <Alert tone="warning" title="Registration is temporarily unavailable">
                The laundromat has not published its service area yet. Please
                check back shortly.
              </Alert>
            </div>
          ) : null}

          <Card className="p-6 shadow-md">
            <RegisterForm
              radiusLabel={
                settings ? formatMiles(settings.service_radius_miles) : null
              }
            />
          </Card>

          <p className="mt-5 text-center text-sm text-fg-muted">
            Already registered?{" "}
            <Link
              href="/login"
              className="font-medium text-brand-fg underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </Container>
      </main>
    </>
  );
}
