import Link from "next/link";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/login-form";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = { title: "Sign in · Laundry Portal" };

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "admin" ? "/admin" : "/dashboard");

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-12 sm:px-6">
        <Card>
          <h1 className="text-xl font-semibold">Sign in</h1>
          <p className="mb-6 mt-1 text-sm text-muted">
            Access your pickups and drop-offs.
          </p>
          <LoginForm />
          <p className="mt-6 text-sm text-muted">
            No account yet?{" "}
            <Link href="/register" className="font-medium text-brand underline underline-offset-4">
              Create one
            </Link>
          </p>
        </Card>
      </main>
    </>
  );
}
