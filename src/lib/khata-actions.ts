"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "./prisma";
import { getCurrentUserId } from "./session";
import { normalisePhone } from "./phone";
import { KHATA_ENTRY_TYPES, PARTY_TYPES } from "./types";

export interface ActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

function fail(error: string): ActionResult {
  return { ok: false, error };
}

function revalidateKhata() {
  revalidatePath("/", "layout");
}

/** ₹1,000 crore — high enough for any real khata, low enough to catch typos. */
const MAX_AMOUNT_PAISE = 1_000_00_00_000_00;

const paiseFromRupees = z
  .string()
  .min(1, "Enter an amount")
  .transform((value, ctx) => {
    const parsed = Number(value.replace(/[₹,\s]/g, ""));
    if (!Number.isFinite(parsed)) {
      ctx.addIssue({ code: "custom", message: "Enter a valid amount" });
      return z.NEVER;
    }
    if (parsed <= 0) {
      ctx.addIssue({
        code: "custom",
        message: "Amount must be greater than zero",
      });
      return z.NEVER;
    }
    const paise = Math.round(parsed * 100);
    if (paise > MAX_AMOUNT_PAISE) {
      ctx.addIssue({
        code: "custom",
        message: "That amount looks too large — please check it",
      });
      return z.NEVER;
    }
    return BigInt(paise);
  });

function parseDate(value: string): Date {
  // Anchor to midday so a timezone shift can't move it to an adjacent day.
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
}

/* ------------------------------------------------------------------ */
/* Parties                                                             */
/* ------------------------------------------------------------------ */

const partySchema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(60),
  phone: z.string().optional(),
  type: z.enum(PARTY_TYPES).default("CUSTOMER"),
  note: z.string().max(200).optional(),
});

export async function createParty(formData: FormData): Promise<ActionResult> {
  const parsed = partySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const userId = await getCurrentUserId();
  const { name, type, note } = parsed.data;

  // A phone number is optional, but if given it must be a real mobile number.
  let phone: string | null = null;
  if (parsed.data.phone?.trim()) {
    phone = normalisePhone(parsed.data.phone);
    if (!phone)
      return fail("Enter a valid 10-digit mobile number, or leave it blank");
  }

  const duplicate = await prisma.party.findFirst({
    where: { userId, name, isArchived: false },
  });
  if (duplicate) return fail(`You already have an entry for ${name}`);

  const party = await prisma.party.create({
    data: { userId, name, phone, type, note: note || null },
  });

  revalidateKhata();
  return { ok: true, id: party.id };
}

export async function updateParty(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = partySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const userId = await getCurrentUserId();
  const existing = await prisma.party.findFirst({ where: { id, userId } });
  if (!existing) return fail("Contact not found");

  let phone: string | null = null;
  if (parsed.data.phone?.trim()) {
    phone = normalisePhone(parsed.data.phone);
    if (!phone)
      return fail("Enter a valid 10-digit mobile number, or leave it blank");
  }

  await prisma.party.update({
    where: { id },
    data: {
      name: parsed.data.name,
      phone,
      type: parsed.data.type,
      note: parsed.data.note || null,
    },
  });

  revalidateKhata();
  return { ok: true };
}

/** Deletes the contact and its whole statement. */
export async function deleteParty(id: string): Promise<ActionResult> {
  const userId = await getCurrentUserId();
  const existing = await prisma.party.findFirst({ where: { id, userId } });
  if (!existing) return fail("Contact not found");

  await prisma.party.delete({ where: { id } });

  revalidateKhata();
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Entries                                                             */
/* ------------------------------------------------------------------ */

const entrySchema = z.object({
  partyId: z.string().min(1, "Missing contact"),
  type: z.enum(KHATA_ENTRY_TYPES),
  amount: paiseFromRupees,
  date: z.string().min(1, "Pick a date"),
  dueDate: z.string().optional(),
  note: z.string().max(200).optional(),
});

export async function createKhataEntry(
  formData: FormData,
): Promise<ActionResult> {
  const parsed = entrySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const userId = await getCurrentUserId();
  const { partyId, type, amount, date, dueDate, note } = parsed.data;

  const party = await prisma.party.findFirst({
    where: { id: partyId, userId },
  });
  if (!party) return fail("Contact not found");

  await prisma.khataEntry.create({
    data: {
      userId,
      partyId,
      type,
      amount,
      date: parseDate(date),
      dueDate: dueDate ? parseDate(dueDate) : null,
      note: note || null,
    },
  });

  revalidateKhata();
  return { ok: true };
}

export async function updateKhataEntry(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = entrySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const userId = await getCurrentUserId();
  const existing = await prisma.khataEntry.findFirst({ where: { id, userId } });
  if (!existing) return fail("Entry not found");

  await prisma.khataEntry.update({
    where: { id },
    data: {
      type: parsed.data.type,
      amount: parsed.data.amount,
      date: parseDate(parsed.data.date),
      dueDate: parsed.data.dueDate ? parseDate(parsed.data.dueDate) : null,
      note: parsed.data.note || null,
    },
  });

  revalidateKhata();
  return { ok: true };
}

export async function deleteKhataEntry(id: string): Promise<ActionResult> {
  const userId = await getCurrentUserId();
  const existing = await prisma.khataEntry.findFirst({ where: { id, userId } });
  if (!existing) return fail("Entry not found");

  await prisma.khataEntry.delete({ where: { id } });

  revalidateKhata();
  return { ok: true };
}

/** Records a payment that clears the whole outstanding balance. */
export async function settleParty(partyId: string): Promise<ActionResult> {
  const userId = await getCurrentUserId();
  const party = await prisma.party.findFirst({
    where: { id: partyId, userId },
  });
  if (!party) return fail("Contact not found");

  const totals = await prisma.khataEntry.groupBy({
    by: ["type"],
    where: { userId, partyId },
    _sum: { amount: true },
  });

  const sumOf = (type: string) =>
    totals.find((t) => t.type === type)?._sum.amount ?? 0n;
  const balance = sumOf("GAVE") - sumOf("GOT");

  if (balance === 0n) return fail("This account is already settled");

  // Clearing a positive balance means they paid you; a negative one means
  // you paid them, which is the opposite entry type.
  await prisma.khataEntry.create({
    data: {
      userId,
      partyId,
      type: balance > 0n ? "GOT" : "GAVE",
      amount: balance > 0n ? balance : -balance,
      date: new Date(),
      note: "Settled up",
    },
  });

  revalidateKhata();
  return { ok: true };
}
