import Link from "next/link";
import { redirect } from "next/navigation";

import { Container } from "@/components/layout/container";
import { SiteHeader } from "@/components/layout/site-header";
import { LoginForm } from "@/components/login-form";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in · Laundry Portal" };

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "admin" ? "/admin" : "/dashboard");

  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 items-center py-12">
        <Container size="sm">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-semibold text-fg">Welcome back</h1>
            <p className="mt-1.5 text-sm text-fg-muted">
              Access your pickups and drop-offs.
            </p>
          </div>
          <Card className="p-6 shadow-md">
            <LoginForm />
          </Card>
          <p className="mt-5 text-center text-sm text-fg-muted">
            No account yet?{" "}
            <Link
              href="/register"
              className="font-medium text-brand-fg underline-offset-4 hover:underline"
            >
              Create one
            </Link>
          </p>
        </Container>
      </main>
    </>
  );
}
