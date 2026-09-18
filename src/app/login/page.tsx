import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth-forms";
import { AuthShell } from "@/components/auth-shell";
import { getOptionalUser } from "@/lib/session";

export const metadata: Metadata = { title: "Sign in — FinTrack" };

export default async function LoginPage() {
  // Already signed in? Skip the form.
  if (await getOptionalUser()) redirect("/");

  return (
    <AuthShell title="Welcome back" subtitle="Sign in with your mobile number.">
      <LoginForm />
    </AuthShell>
  );
}
