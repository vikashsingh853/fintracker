import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignupForm } from "@/components/auth-forms";
import { AuthShell } from "@/components/auth-shell";
import { getOptionalUser } from "@/lib/session";

export const metadata: Metadata = { title: "Create account — FinTrack" };

export default async function SignupPage() {
  if (await getOptionalUser()) redirect("/");

  return (
    <AuthShell
      title="Create your account"
      subtitle="Track spending, plan bills and know what's safe to spend."
    >
      <SignupForm />
    </AuthShell>
  );
}
