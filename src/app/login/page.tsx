import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth-forms";
import { AuthShell } from "@/components/auth-shell";
import { getOptionalUser } from "@/lib/session";
import { safeNext } from "@/lib/redirect";

export const metadata: Metadata = { title: "Sign in — FinTrack" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const next = safeNext((await searchParams).next);
  // Already signed in? Skip the form.
  if (await getOptionalUser()) redirect(next);

  return (
    <AuthShell title="Welcome back" subtitle="Sign in with your mobile number.">
      <LoginForm next={next} />
    </AuthShell>
  );
}
