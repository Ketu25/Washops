import Link from "next/link";

import { CoverageChecker } from "@/components/coverage-checker";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui";
import { formatMiles } from "@/lib/geo";
import { getSettings } from "@/lib/settings";

// The service radius can change at any time from the admin panel, and the
// coverage answer must never be a cached lie.
export const dynamic = "force-dynamic";

const STEPS = [
  {
    title: "Check your address",
    body: "Enter your address to confirm you are inside our pickup radius. No account required.",
  },
  {
    title: "Book a window",
    body: "Pick a date and a two-hour window for a pickup or a drop-off. Change your mind and cancel any time before it is completed.",
  },
  {
    title: "We handle the rest",
    body: "Our team confirms your request, plans the route, and marks it complete once your laundry is on its way.",
  },
];

export default async function HomePage() {
  const settings = await getSettings();

  return (
    <>
      <SiteHeader />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-brand">
              {settings?.name ?? "Laundry pickup & drop-off"}
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
              Laundry pickup and drop-off, scheduled online.
            </h1>
            <p className="mt-4 max-w-xl text-base text-muted">
              No more phone calls to arrange a collection. Book the day and time
              that suits you, and follow your request from confirmation through
              to completion.
              {settings ? (
                <>
                  {" "}
                  We serve addresses within{" "}
                  <strong className="text-foreground">
                    {formatMiles(settings.service_radius_miles)} miles
                  </strong>{" "}
                  of {settings.name}.
                </>
              ) : null}
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/register"
                className="rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-strong"
              >
                Create an account
              </Link>
              <Link
                href="/login"
                className="rounded-lg border border-line bg-surface px-5 py-2.5 text-sm font-medium transition hover:bg-background"
              >
                Sign in
              </Link>
            </div>

            <ol className="mt-10 flex flex-col gap-5">
              {STEPS.map((step, index) => (
                <li key={step.title} className="flex gap-4">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand/10 text-sm font-semibold text-brand">
                    {index + 1}
                  </span>
                  <div>
                    <p className="font-medium">{step.title}</p>
                    <p className="mt-0.5 text-sm text-muted">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="lg:pt-2">
            <Card>
              <h2 className="text-lg font-semibold">Do we serve your address?</h2>
              <p className="mb-5 mt-1 text-sm text-muted">
                {settings
                  ? `We pick up and drop off within ${formatMiles(
                      settings.service_radius_miles,
                    )} miles of ${settings.address}.`
                  : "Enter your address to see whether you are inside our coverage zone."}
              </p>
              <CoverageChecker configured={Boolean(settings)} />
            </Card>
          </div>
        </div>
      </main>

      <footer className="border-t border-line px-4 py-6 text-center text-xs text-muted sm:px-6">
        {settings ? `${settings.name} · ${settings.address}` : "Laundry Portal"}
      </footer>
    </>
  );
}
