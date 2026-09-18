"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "./prisma";
import { getCurrentUserId } from "./session";
import { nextOccurrence } from "./dates";
import {
  ACCOUNT_TYPES,
  FREQUENCIES,
  PAYMENT_METHODS,
  TRANSACTION_TYPES,
  type Frequency,
} from "./types";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

function fail(error: string): ActionResult {
  return { ok: false, error };
}

function revalidateAll() {
  revalidatePath("/", "layout");
}

/** ₹1,000 crore — high enough for any real personal balance, low enough to catch typos. */
const MAX_AMOUNT_PAISE = 1_000_00_00_000_00;

/** Amount fields arrive from the form as a rupee string; store integer paise. */
const paiseFromRupees = z
  .string()
  .min(1, "Enter an amount")
  .transform((value, ctx) => {
    const cleaned = value.replace(/[₹,\s]/g, "");
    const parsed = Number(cleaned);
    if (!Number.isFinite(parsed)) {
      ctx.addIssue({ code: "custom", message: "Enter a valid amount" });
      return z.NEVER;
    }
    if (parsed <= 0) {
      ctx.addIssue({ code: "custom", message: "Amount must be greater than zero" });
      return z.NEVER;
    }
    const paise = Math.round(parsed * 100);
    if (paise > MAX_AMOUNT_PAISE) {
      ctx.addIssue({ code: "custom", message: "That amount looks too large — please check it" });
      return z.NEVER;
    }
    return BigInt(paise);
  });

const optionalId = z
  .string()
  .transform((v) => (v === "" || v === "none" ? null : v))
  .nullable();

/* ------------------------------------------------------------------ */
/* Accounts                                                            */
/* ------------------------------------------------------------------ */

/** Parses an optional rupee string into clamped paise. */
function parsePaise(value: string | undefined): bigint | null {
  if (!value) return null;
  const parsed = Number(value.replace(/[₹,\s]/g, "") || "0");
  if (!Number.isFinite(parsed)) return null;
  const paise = Math.round(parsed * 100);
  return BigInt(Math.max(-MAX_AMOUNT_PAISE, Math.min(MAX_AMOUNT_PAISE, paise)));
}

const accountSchema = z.object({
  name: z.string().min(1, "Enter an account name").max(60),
  type: z.enum(ACCOUNT_TYPES),
  openingBalance: z.string().transform((value) => parsePaise(value) ?? 0n),
  creditLimit: z.string().optional(),
  billingCycleDay: z.string().optional(),
  dueDay: z.string().optional(),
  color: z.string().default("#2563eb"),
  icon: z.string().default("wallet"),
});

function optionalDay(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 31) return null;
  return parsed;
}

export async function createAccount(formData: FormData): Promise<ActionResult> {
  const parsed = accountSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const userId = await getCurrentUserId();
  const data = parsed.data;
  const isCredit = data.type === "CREDIT_CARD";
  const liquid = data.type === "BANK" || data.type === "CASH" || data.type === "WALLET";

  await prisma.account.create({
    data: {
      userId,
      name: data.name,
      type: data.type,
      openingBalance: data.openingBalance,
      creditLimit: isCredit ? parsePaise(data.creditLimit) : null,
      billingCycleDay: isCredit ? optionalDay(data.billingCycleDay) : null,
      dueDay: isCredit ? optionalDay(data.dueDay) : null,
      color: data.color,
      icon: data.icon,
      isLiquid: liquid,
    },
  });

  revalidateAll();
  return { ok: true };
}

export async function updateAccount(id: string, formData: FormData): Promise<ActionResult> {
  const parsed = accountSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const userId = await getCurrentUserId();
  const existing = await prisma.account.findFirst({ where: { id, userId } });
  if (!existing) return fail("Account not found");

  const data = parsed.data;
  const isCredit = data.type === "CREDIT_CARD";

  await prisma.account.update({
    where: { id },
    data: {
      name: data.name,
      type: data.type,
      openingBalance: data.openingBalance,
      creditLimit: isCredit ? parsePaise(data.creditLimit) : null,
      billingCycleDay: isCredit ? optionalDay(data.billingCycleDay) : null,
      dueDay: isCredit ? optionalDay(data.dueDay) : null,
      color: data.color,
      icon: data.icon,
      isLiquid: data.type === "BANK" || data.type === "CASH" || data.type === "WALLET",
    },
  });

  revalidateAll();
  return { ok: true };
}

export async function archiveAccount(id: string): Promise<ActionResult> {
  const userId = await getCurrentUserId();
  const existing = await prisma.account.findFirst({ where: { id, userId } });
  if (!existing) return fail("Account not found");

  await prisma.account.update({
    where: { id },
    data: { isArchived: !existing.isArchived },
  });

  revalidateAll();
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Transactions                                                        */
/* ------------------------------------------------------------------ */

const transactionSchema = z
  .object({
    type: z.enum(TRANSACTION_TYPES),
    amount: paiseFromRupees,
    date: z.string().min(1, "Pick a date"),
    accountId: z.string().min(1, "Choose an account"),
    toAccountId: optionalId.optional(),
    categoryId: optionalId.optional(),
    note: z.string().max(200).optional(),
    merchant: z.string().max(80).optional(),
    paymentMethod: z.enum(PAYMENT_METHODS).default("UPI"),
    excludeFromBudget: z.union([z.literal("on"), z.literal("")]).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.type === "TRANSFER") {
      if (!value.toAccountId) {
        ctx.addIssue({ code: "custom", message: "Choose a destination account", path: ["toAccountId"] });
      } else if (value.toAccountId === value.accountId) {
        ctx.addIssue({
          code: "custom",
          message: "Source and destination must differ",
          path: ["toAccountId"],
        });
      }
    } else if (!value.categoryId) {
      ctx.addIssue({ code: "custom", message: "Choose a category", path: ["categoryId"] });
    }
  });

function parseDate(value: string): Date {
  // Anchor to midday so a timezone shift can't move it to an adjacent day.
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
}

export async function createTransaction(formData: FormData): Promise<ActionResult> {
  const parsed = transactionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const userId = await getCurrentUserId();
  const data = parsed.data;

  const accountIds = [data.accountId, ...(data.toAccountId ? [data.toAccountId] : [])];
  const owned = await prisma.account.count({ where: { userId, id: { in: accountIds } } });
  if (owned !== accountIds.length) return fail("Account not found");

  await prisma.transaction.create({
    data: {
      userId,
      type: data.type,
      amount: data.amount,
      date: parseDate(data.date),
      accountId: data.accountId,
      toAccountId: data.type === "TRANSFER" ? data.toAccountId : null,
      categoryId: data.type === "TRANSFER" ? null : data.categoryId,
      note: data.note || null,
      merchant: data.merchant || null,
      paymentMethod: data.paymentMethod,
      excludeFromBudget: data.type === "TRANSFER" ? true : data.excludeFromBudget === "on",
    },
  });

  revalidateAll();
  return { ok: true };
}

export async function updateTransaction(id: string, formData: FormData): Promise<ActionResult> {
  const parsed = transactionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const userId = await getCurrentUserId();
  const existing = await prisma.transaction.findFirst({ where: { id, userId } });
  if (!existing) return fail("Transaction not found");

  const data = parsed.data;

  await prisma.transaction.update({
    where: { id },
    data: {
      type: data.type,
      amount: data.amount,
      date: parseDate(data.date),
      accountId: data.accountId,
      toAccountId: data.type === "TRANSFER" ? data.toAccountId : null,
      categoryId: data.type === "TRANSFER" ? null : data.categoryId,
      note: data.note || null,
      merchant: data.merchant || null,
      paymentMethod: data.paymentMethod,
      excludeFromBudget: data.type === "TRANSFER" ? true : data.excludeFromBudget === "on",
    },
  });

  revalidateAll();
  return { ok: true };
}

export async function deleteTransaction(id: string): Promise<ActionResult> {
  const userId = await getCurrentUserId();
  const existing = await prisma.transaction.findFirst({ where: { id, userId } });
  if (!existing) return fail("Transaction not found");

  await prisma.transaction.delete({ where: { id } });
  revalidateAll();
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Categories                                                          */
/* ------------------------------------------------------------------ */


/* ------------------------------------------------------------------ */
/* Budgets                                                             */
/* ------------------------------------------------------------------ */

const budgetSchema = z.object({
  categoryId: z.string().min(1, "Choose a category"),
  period: z.string().regex(/^\d{4}-\d{2}$/, "Invalid month"),
  amount: paiseFromRupees,
});

export async function upsertBudget(formData: FormData): Promise<ActionResult> {
  const parsed = budgetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const userId = await getCurrentUserId();
  const { categoryId, period, amount } = parsed.data;

  const category = await prisma.category.findFirst({ where: { id: categoryId, userId } });
  if (!category) return fail("Category not found");

  await prisma.budget.upsert({
    where: { userId_categoryId_period: { userId, categoryId, period } },
    create: { userId, categoryId, period, amount },
    update: { amount },
  });

  revalidateAll();
  return { ok: true };
}

export async function deleteBudget(id: string): Promise<ActionResult> {
  const userId = await getCurrentUserId();
  const existing = await prisma.budget.findFirst({ where: { id, userId } });
  if (!existing) return fail("Budget not found");

  await prisma.budget.delete({ where: { id } });
  revalidateAll();
  return { ok: true };
}

/** Copies every budget from `fromPeriod` into `toPeriod`, skipping existing ones. */
export async function copyBudgets(fromPeriod: string, toPeriod: string): Promise<ActionResult> {
  const userId = await getCurrentUserId();

  const [source, existing] = await Promise.all([
    prisma.budget.findMany({ where: { userId, period: fromPeriod } }),
    prisma.budget.findMany({ where: { userId, period: toPeriod }, select: { categoryId: true } }),
  ]);

  if (source.length === 0) return fail("No budgets to copy from that month");

  const existingIds = new Set(existing.map((b) => b.categoryId));
  const toCreate = source.filter((b) => !existingIds.has(b.categoryId));

  if (toCreate.length === 0) return fail("Every budget already exists this month");

  await prisma.budget.createMany({
    data: toCreate.map((b) => ({
      userId,
      categoryId: b.categoryId,
      period: toPeriod,
      amount: b.amount,
    })),
  });

  revalidateAll();
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Recurring rules                                                     */
/* ------------------------------------------------------------------ */

const recurringSchema = z
  .object({
    name: z.string().min(1, "Enter a name").max(60),
    type: z.enum(TRANSACTION_TYPES),
    amount: paiseFromRupees,
    accountId: z.string().min(1, "Choose an account"),
    toAccountId: optionalId.optional(),
    categoryId: optionalId.optional(),
    frequency: z.enum(FREQUENCIES),
    dayOfMonth: z.string().optional(),
    nextDueDate: z.string().min(1, "Pick the next due date"),
    merchant: z.string().max(80).optional(),
    autoPost: z.union([z.literal("on"), z.literal("")]).optional(),
    isBill: z.union([z.literal("on"), z.literal("")]).optional(),
    isVariable: z.union([z.literal("on"), z.literal("")]).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.type === "TRANSFER") {
      if (!value.toAccountId) {
        ctx.addIssue({ code: "custom", message: "Choose a destination account", path: ["toAccountId"] });
      } else if (value.toAccountId === value.accountId) {
        ctx.addIssue({
          code: "custom",
          message: "Source and destination must differ",
          path: ["toAccountId"],
        });
      }
    } else if (!value.categoryId) {
      ctx.addIssue({ code: "custom", message: "Choose a category", path: ["categoryId"] });
    }
  });

export async function createRecurringRule(formData: FormData): Promise<ActionResult> {
  const parsed = recurringSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const userId = await getCurrentUserId();
  const data = parsed.data;
  const nextDue = parseDate(data.nextDueDate);

  await prisma.recurringRule.create({
    data: {
      userId,
      name: data.name,
      type: data.type,
      amount: data.amount,
      accountId: data.accountId,
      toAccountId: data.type === "TRANSFER" ? data.toAccountId : null,
      categoryId: data.type === "TRANSFER" ? null : data.categoryId,
      frequency: data.frequency,
      dayOfMonth: optionalDay(data.dayOfMonth) ?? nextDue.getDate(),
      startDate: nextDue,
      nextDueDate: nextDue,
      merchant: data.merchant || null,
      autoPost: data.autoPost === "on",
      isBill: data.isBill === "on",
      isVariable: data.isVariable === "on",
    },
  });

  revalidateAll();
  return { ok: true };
}

export async function updateRecurringRule(id: string, formData: FormData): Promise<ActionResult> {
  const parsed = recurringSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const userId = await getCurrentUserId();
  const existing = await prisma.recurringRule.findFirst({ where: { id, userId } });
  if (!existing) return fail("Recurring rule not found");

  const data = parsed.data;
  const nextDue = parseDate(data.nextDueDate);

  await prisma.recurringRule.update({
    where: { id },
    data: {
      name: data.name,
      type: data.type,
      amount: data.amount,
      accountId: data.accountId,
      toAccountId: data.type === "TRANSFER" ? data.toAccountId : null,
      categoryId: data.type === "TRANSFER" ? null : data.categoryId,
      frequency: data.frequency,
      dayOfMonth: optionalDay(data.dayOfMonth) ?? nextDue.getDate(),
      nextDueDate: nextDue,
      merchant: data.merchant || null,
      autoPost: data.autoPost === "on",
      isBill: data.isBill === "on",
      isVariable: data.isVariable === "on",
    },
  });

  revalidateAll();
  return { ok: true };
}

export async function toggleRecurringRule(id: string): Promise<ActionResult> {
  const userId = await getCurrentUserId();
  const existing = await prisma.recurringRule.findFirst({ where: { id, userId } });
  if (!existing) return fail("Recurring rule not found");

  await prisma.recurringRule.update({
    where: { id },
    data: { isActive: !existing.isActive },
  });

  revalidateAll();
  return { ok: true };
}

export async function deleteRecurringRule(id: string): Promise<ActionResult> {
  const userId = await getCurrentUserId();
  const existing = await prisma.recurringRule.findFirst({ where: { id, userId } });
  if (!existing) return fail("Recurring rule not found");

  await prisma.recurringRule.delete({ where: { id } });
  revalidateAll();
  return { ok: true };
}

/**
 * Posts a due rule as a real transaction and rolls the schedule forward.
 * `overrideAmount` covers variable bills like electricity.
 */
export async function postRecurringRule(
  id: string,
  overrideAmount?: string,
): Promise<ActionResult> {
  const userId = await getCurrentUserId();
  const rule = await prisma.recurringRule.findFirst({ where: { id, userId } });
  if (!rule) return fail("Recurring rule not found");

  let amount = rule.amount;
  if (overrideAmount) {
    const cleaned = Number(overrideAmount.replace(/[₹,\s]/g, ""));
    if (!Number.isFinite(cleaned) || cleaned <= 0) return fail("Enter a valid amount");
    amount = BigInt(Math.round(cleaned * 100));
  }

  const postedDate = rule.nextDueDate;
  const upcoming = nextOccurrence(
    {
      frequency: rule.frequency as Frequency,
      interval: rule.interval,
      dayOfMonth: rule.dayOfMonth,
      weekday: rule.weekday,
      monthOfYear: rule.monthOfYear,
    },
    postedDate,
  );

  await prisma.$transaction([
    prisma.transaction.create({
      data: {
        userId,
        type: rule.type,
        amount,
        date: postedDate,
        accountId: rule.accountId,
        toAccountId: rule.type === "TRANSFER" ? rule.toAccountId : null,
        categoryId: rule.type === "TRANSFER" ? null : rule.categoryId,
        note: rule.name,
        merchant: rule.merchant,
        paymentMethod: rule.autoPost ? "AUTO_DEBIT" : "UPI",
        excludeFromBudget: rule.type === "TRANSFER",
        recurringRuleId: rule.id,
      },
    }),
    prisma.recurringRule.update({
      where: { id: rule.id },
      data: { nextDueDate: upcoming, lastPostedAt: new Date() },
    }),
  ]);

  revalidateAll();
  return { ok: true };
}

/**
 * Reverses the most recent payment recorded from a rule: deletes the posted
 * transaction and rewinds the schedule to that date, so the bill shows as due
 * again. Used by "Mark unpaid" when a payment was logged by mistake.
 */
export async function unpostRecurringRule(id: string): Promise<ActionResult> {
  const userId = await getCurrentUserId();
  const rule = await prisma.recurringRule.findFirst({ where: { id, userId } });
  if (!rule) return fail("Recurring rule not found");

  const posted = await prisma.transaction.findFirst({
    where: { userId, recurringRuleId: id },
    orderBy: { date: "desc" },
  });
  if (!posted) return fail("No recorded payment to undo");

  // The next payment before this one becomes the new "last posted" marker.
  const previous = await prisma.transaction.findFirst({
    where: { userId, recurringRuleId: id, id: { not: posted.id } },
    orderBy: { date: "desc" },
    select: { date: true },
  });

  await prisma.$transaction([
    prisma.transaction.delete({ where: { id: posted.id } }),
    prisma.recurringRule.update({
      where: { id: rule.id },
      data: { nextDueDate: posted.date, lastPostedAt: previous?.date ?? null },
    }),
  ]);

  revalidateAll();
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

