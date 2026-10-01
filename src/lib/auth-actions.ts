"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import {
  createSession,
  destroySession,
  hashPassword,
  normalisePhone,
  verifyPassword,
} from "./auth";
import { prisma } from "./prisma";
import { provisionNewUser } from "./provision";
import { safeNext } from "./redirect";

export interface AuthResult {
  ok: boolean;
  error?: string;
}

function fail(error: string): AuthResult {
  return { ok: false, error };
}

const passwordRule = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password is too long");

const signUpSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(60),
  phone: z.string().min(1, "Enter your mobile number"),
  password: passwordRule,
  confirmPassword: z.string().min(1, "Confirm your password"),
});

const signInSchema = z.object({
  phone: z.string().min(1, "Enter your mobile number"),
  password: z.string().min(1, "Enter your password"),
});

export async function signUp(formData: FormData): Promise<AuthResult> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const { name, password, confirmPassword } = parsed.data;
  if (password !== confirmPassword) return fail("Passwords don't match");

  const phone = normalisePhone(parsed.data.phone);
  if (!phone) return fail("Enter a valid 10-digit Indian mobile number");

  const existing = await prisma.user.findUnique({ where: { phone } });
  if (existing)
    return fail("An account with this mobile number already exists");

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: { name, phone, passwordHash },
  });

  // A brand-new account needs categories and accounts to be usable.
  await provisionNewUser(user.id);

  const userAgent = (await headers()).get("user-agent") ?? undefined;
  await createSession(user.id, userAgent);

  redirect(safeNext(formData.get("next")));
}

export async function signIn(formData: FormData): Promise<AuthResult> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const phone = normalisePhone(parsed.data.phone);
  if (!phone) return fail("Enter a valid 10-digit Indian mobile number");

  const user = await prisma.user.findUnique({ where: { phone } });

  // Same message either way so the form can't be used to discover which
  // numbers are registered.
  if (!user) return fail("Incorrect mobile number or password");

  const valid = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!valid) return fail("Incorrect mobile number or password");

  const userAgent = (await headers()).get("user-agent") ?? undefined;
  await createSession(user.id, userAgent);

  redirect(safeNext(formData.get("next")));
}

export async function signOut(): Promise<void> {
  await destroySession();
  redirect("/login");
}
