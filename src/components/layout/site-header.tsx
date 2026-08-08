import Link from "next/link";
import { WashingMachine } from "lucide-react";

import { logoutAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { Container } from "./container";
import { NavLinks } from "./nav-links";

export async function SiteHeader() {
  const [user, settings] = await Promise.all([getCurrentUser(), getSettings()]);

  const links =
    user?.role === "admin"
      ? [
          { href: "/admin", label: "Requests" },
          { href: "/admin/settings", label: "Settings" },
        ]
      : user
        ? [
            { href: "/dashboard", label: "My requests" },
            { href: "/dashboard/schedule", label: "Schedule" },
            { href: "/dashboard/profile", label: "Profile" },
          ]
        : [];

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/85 backdrop-blur-md">
      <Container size="full" className="flex h-14 items-center gap-6">
        <Link
          href={user?.role === "admin" ? "/admin" : "/"}
          className="flex shrink-0 items-center gap-2 font-semibold text-fg"
        >
          <span className="flex size-7 items-center justify-center rounded-md bg-brand text-fg-on-brand">
            <WashingMachine aria-hidden className="size-4" />
          </span>
          <span className="hidden sm:inline">{settings?.name ?? "Laundry Portal"}</span>
        </Link>

        <NavLinks links={links} />

        <div className="ml-auto flex shrink-0 items-center gap-3">
          {user ? (
            <>
              <span className="hidden text-sm text-fg-muted md:inline">
                {user.full_name}
                {user.role === "admin" ? (
                  <span className="ml-1.5 rounded bg-surface-sunken px-1.5 py-0.5 text-2xs font-medium uppercase tracking-wide text-fg-subtle">
                    Admin
                  </span>
                ) : null}
              </span>
              <form action={logoutAction}>
                <Button type="submit" variant="secondary" size="sm">
                  Sign out
                </Button>
              </form>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/register">Create account</Link>
              </Button>
            </>
          )}
        </div>
      </Container>
    </header>
  );
}
