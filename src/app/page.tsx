import { CalendarClock, MapPin, PackageCheck, Truck } from "lucide-react";
import Link from "next/link";

import { CoverageChecker } from "@/components/coverage-checker";
import { Container } from "@/components/layout/container";
import { SiteHeader } from "@/components/layout/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatMiles } from "@/lib/geo";
import { getSettings } from "@/lib/settings";

// The service radius can change at any time from the admin panel, and the
// coverage answer must never be a cached lie.
export const dynamic = "force-dynamic";

const STEPS = [
  {
    icon: MapPin,
    title: "Check your address",
    body: "Confirm you are inside the pickup radius. No account required.",
  },
  {
    icon: CalendarClock,
    title: "Book a window",
    body: "Pick a date and a two-hour slot. Cancel any time before it is completed.",
  },
  {
    icon: Truck,
    title: "We handle the rest",
    body: "We confirm the request, plan the route, and mark it complete on the way back.",
  },
];

export default async function HomePage() {
  const settings = await getSettings();

  return (
    <>
      <SiteHeader />

      <main className="flex-1">
        {/*
          The hero is a two-column grid where BOTH columns carry weight — the
          previous version put a short card beside a tall text block and left
          a third of the page empty below it.
        */}
        <section className="relative overflow-hidden border-b border-line">
          {/* A soft brand wash instead of a flat panel, so the fold has depth
              without needing photography we do not have. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_40rem_at_15%_-10%,var(--color-brand-soft),transparent_60%)]"
          />
          <Container size="full" className="relative py-14 sm:py-20">
            <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_minmax(0,26rem)] lg:gap-16">
              <div>
                <Badge tone="brand" className="mb-5">
                  <PackageCheck aria-hidden className="size-3" />
                  Pickup &amp; delivery
                </Badge>

                <h1 className="text-4xl font-semibold text-fg sm:text-5xl">
                  Laundry, collected
                  <br />
                  from your door.
                </h1>

                <p className="mt-5 max-w-lg text-lg text-fg-muted">
                  Book the day and the time that suits you, then follow the
                  request from confirmation through to completion.
                  {settings ? (
                    <>
                      {" "}
                      We serve addresses within{" "}
                      <strong className="font-semibold text-fg">
                        {formatMiles(settings.service_radius_miles)} miles
                      </strong>{" "}
                      of {settings.name}.
                    </>
                  ) : null}
                </p>

                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <Button asChild size="lg">
                    <Link href="/register">Create an account</Link>
                  </Button>
                  <Button asChild size="lg" variant="secondary">
                    <Link href="/login">Sign in</Link>
                  </Button>
                </div>
              </div>

              <Card className="p-6 shadow-lg lg:p-7">
                <h2 className="text-lg font-semibold text-fg">
                  Do we serve your address?
                </h2>
                <p className="mb-5 mt-1 text-sm text-fg-muted">
                  {settings
                    ? `We pick up and drop off within ${formatMiles(
                        settings.service_radius_miles,
                      )} miles of ${settings.address}.`
                    : "Enter your address to see whether you are inside our coverage zone."}
                </p>
                <CoverageChecker configured={Boolean(settings)} />
              </Card>
            </div>
          </Container>
        </section>

        {/* Steps get their own band at full width rather than being squeezed
            into the hero's left column. */}
        <section className="py-14 sm:py-16">
          <Container size="full">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-fg-subtle">
              How it works
            </h2>
            <ol className="mt-7 grid gap-6 sm:grid-cols-3 sm:gap-8">
              {STEPS.map((step, index) => (
                <li key={step.title} className="relative">
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-lg border border-line bg-surface text-brand shadow-xs">
                      <step.icon aria-hidden className="size-4" />
                    </span>
                    <span className="text-2xs font-semibold tabular-nums tracking-widest text-fg-subtle">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h3 className="mt-4 font-medium text-fg">{step.title}</h3>
                  <p className="mt-1.5 text-sm text-fg-muted">{step.body}</p>
                </li>
              ))}
            </ol>
          </Container>
        </section>
      </main>

      <footer className="border-t border-line py-8">
        <Container size="full" className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-fg-subtle">
            {settings ? `${settings.name} · ${settings.address}` : "Laundry Portal"}
          </p>
          <Link
            href="/login"
            className="text-xs font-medium text-fg-muted underline-offset-4 hover:text-fg hover:underline"
          >
            Staff sign in
          </Link>
        </Container>
      </footer>
    </>
  );
}
