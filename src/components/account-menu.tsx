"use client";

import { LogOut } from "lucide-react";
import { useTransition } from "react";
import { signOut } from "@/lib/auth-actions";
import { formatPhoneClient } from "@/lib/phone";

export function AccountMenu({
  name,
  phone,
  compact = false,
}: {
  name: string;
  phone: string;
  compact?: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function handleSignOut() {
    startTransition(async () => {
      await signOut();
    });
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={handleSignOut}
        disabled={pending}
        aria-label="Sign out"
        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink-600 transition hover:bg-ink-100 disabled:opacity-60"
      >
        <LogOut size={14} />
        {pending ? "…" : "Sign out"}
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-ink-200 p-3">
      <p className="truncate text-sm font-medium text-ink-900">{name}</p>
      <p className="tabular mt-0.5 truncate text-[11px] text-ink-500">
        {formatPhoneClient(phone)}
      </p>
      <button
        type="button"
        onClick={handleSignOut}
        disabled={pending}
        className="mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-ink-200 px-2.5 py-1.5 text-xs font-medium text-ink-600 transition hover:bg-ink-50 disabled:opacity-60"
      >
        <LogOut size={14} />
        {pending ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}
