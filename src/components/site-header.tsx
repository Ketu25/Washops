import Link from "next/link";

import { logoutAction } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";

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
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
        <Link href={user?.role === "admin" ? "/admin" : "/"} className="font-semibold">
          {settings?.name ?? "Laundry Portal"}
        </Link>

        <nav className="flex flex-1 flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-muted transition hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {user ? (
          <div className="flex items-center gap-4 text-sm">
            <span className="hidden text-muted sm:inline">
              {user.full_name}
              {user.role === "admin" ? " · Admin" : ""}
            </span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-lg border border-line px-3 py-1.5 text-sm transition hover:bg-background"
              >
                Sign out
              </button>
            </form>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-sm">
            <Link href="/login" className="text-muted transition hover:text-foreground">
              Sign in
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-brand px-3 py-1.5 font-medium text-white transition hover:bg-brand-strong"
            >
              Create account
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
