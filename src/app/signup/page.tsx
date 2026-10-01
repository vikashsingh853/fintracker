import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignupForm } from "@/components/auth-forms";
import { AuthShell } from "@/components/auth-shell";
import { getOptionalUser } from "@/lib/session";
import { safeNext } from "@/lib/redirect";

export const metadata: Metadata = { title: "Create account — FinTrack" };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const next = safeNext((await searchParams).next);
  if (await getOptionalUser()) redirect(next);

  return (
    <AuthShell
      title="Create your account"
      subtitle="Track spending, plan bills and know what's safe to spend."
    >
      <SignupForm next={next} />
    </AuthShell>
  );
}
