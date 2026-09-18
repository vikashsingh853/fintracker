"use client";

import Link from "next/link";
import { useState, useTransition, type FormEvent } from "react";
import { signIn, signUp } from "@/lib/auth-actions";
import { Button, ErrorNote, Field, Input } from "./form";

function PhoneInput({ defaultValue }: { defaultValue?: string }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 flex -translate-y-1/2 items-center gap-1.5 text-sm font-medium text-ink-500">
        🇮🇳 +91
      </span>
      <input
        name="phone"
        type="tel"
        inputMode="numeric"
        autoComplete="tel"
        required
        maxLength={15}
        defaultValue={defaultValue}
        placeholder="98765 43210"
        className="tabular w-full rounded-xl border border-ink-300 bg-surface py-2.5 pl-[4.75rem] pr-3 text-sm text-ink-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
      />
    </div>
  );
}

export function LoginForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      // A successful sign-in redirects, so control only returns on failure.
      const result = await signIn(formData);
      if (result && !result.ok) setError(result.error ?? "Could not sign in");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Mobile number">
        <PhoneInput />
      </Field>

      <Field label="Password">
        <Input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="Your password"
        />
      </Field>

      <ErrorNote message={error} />

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Signing in…" : "Sign in"}
      </Button>

      <p className="text-center text-xs text-ink-500">
        New to FinTrack?{" "}
        <Link href="/signup" className="font-medium text-brand-600 hover:text-brand-700">
          Create an account
        </Link>
      </p>
    </form>
  );
}

export function SignupForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await signUp(formData);
      if (result && !result.ok) setError(result.error ?? "Could not create account");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Your name">
        <Input
          name="name"
          autoComplete="name"
          required
          maxLength={60}
          placeholder="Vikash Kumar"
        />
      </Field>

      <Field label="Mobile number" hint="We use this as your login ID.">
        <PhoneInput />
      </Field>

      <Field label="Password" hint="At least 8 characters.">
        <Input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="Create a password"
        />
      </Field>

      <Field label="Confirm password">
        <Input
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="Re-enter your password"
        />
      </Field>

      <ErrorNote message={error} />

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Creating account…" : "Create account"}
      </Button>

      <p className="text-center text-xs text-ink-500">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-brand-600 hover:text-brand-700">
          Sign in
        </Link>
      </p>
    </form>
  );
}
