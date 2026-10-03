"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { normalisePhone } from "./phone";
import { prisma } from "./prisma";
import { getCurrentUser } from "./session";
import { computeShares } from "./split";
import { SPLIT_TYPES, type GroupPersonDTO } from "./types";

export interface GroupActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

function fail(error: string): GroupActionResult {
  return { ok: false, error };
}

function revalidateGroups() {
  revalidatePath("/", "layout");
}

const MAX_MEMBERS = 20;
/** ₹1,000 crore — matches the cap used for personal transactions. */
const MAX_AMOUNT_PAISE = 1_000_00_00_000_00n;

const amountSchema = z
  .string()
  .min(1, "Enter an amount")
  .transform((value, ctx) => {
    const parsed = Number(value.replace(/[₹,\s]/g, ""));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      ctx.addIssue({
        code: "custom",
        message: "Enter an amount greater than zero",
      });
      return z.NEVER;
    }
    const paise = BigInt(Math.round(parsed * 100));
    if (paise > MAX_AMOUNT_PAISE) {
      ctx.addIssue({
        code: "custom",
        message: "That amount looks too large — please check it",
      });
      return z.NEVER;
    }
    return paise;
  });

function parseDate(value: string): Date {
  // Anchor to midday so a timezone shift can't move it to an adjacent day.
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** Resolves picked `memberUserId` values to real FinTrack accounts. */
async function pickedUsers(formData: FormData, exclude: Set<string>) {
  const ids = [...new Set(formData.getAll("memberUserId").map(String))].filter(
    (id) => id && id.length <= 64 && !exclude.has(id),
  );
  if (ids.length === 0) return [];
  if (ids.length > MAX_MEMBERS) return null;
  return prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
  });
}

/**
 * A full mobile number finds any FinTrack account. Name or partial-number
 * search only covers people you already know — group co-members and khata
 * contacts — so the user directory can't be browsed.
 */
export async function searchPeople(query: string): Promise<GroupPersonDTO[]> {
  const user = await getCurrentUser();
  const q = String(query ?? "")
    .trim()
    .slice(0, 60);
  const select = { id: true, name: true, phone: true } as const;

  const phone = normalisePhone(q);
  if (phone) {
    const found = await prisma.user.findUnique({ where: { phone }, select });
    if (!found) return [];
    return [found.id === user.id ? { ...found, isYou: true } : found];
  }
  if (q.length < 2) return [];

  const contacts = await prisma.party.findMany({
    where: { userId: user.id, phone: { not: null } },
    select: { phone: true },
  });
  const digits = q.replace(/\D/g, "");

  return prisma.user.findMany({
    where: {
      id: { not: user.id },
      AND: [
        {
          OR: [
            {
              groupMembers: {
                some: {
                  leftAt: null,
                  group: {
                    members: { some: { userId: user.id, leftAt: null } },
                  },
                },
              },
            },
            { phone: { in: contacts.map((c) => c.phone!) } },
          ],
        },
        {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : []),
          ],
        },
      ],
    },
    select,
    orderBy: { name: "asc" },
    take: 8,
  });
}

async function requireMember(groupId: string) {
  const user = await getCurrentUser();
  const member = await prisma.groupMember.findFirst({
    where: { groupId, userId: user.id, leftAt: null },
  });
  return member ? { user, member } : null;
}

/* ------------------------------------------------------------------ */
/* Groups & members                                                    */
/* ------------------------------------------------------------------ */

export async function createGroup(
  formData: FormData,
): Promise<GroupActionResult> {
  const user = await getCurrentUser();

  const name = z
    .string()
    .trim()
    .min(1, "Enter a group name")
    .max(60)
    .safeParse(formData.get("name") ?? "");
  if (!name.success) return fail(name.error.issues[0].message);

  const people = await pickedUsers(formData, new Set([user.id]));
  if (!people) return fail(`A group can have at most ${MAX_MEMBERS} members`);
  if (people.length === 0)
    return fail("Add at least one person with a FinTrack account");
  if (people.length + 1 > MAX_MEMBERS)
    return fail(`A group can have at most ${MAX_MEMBERS} members`);

  const joinedAt = new Date();
  const group = await prisma.group.create({
    data: {
      name: name.data,
      createdById: user.id,
      members: {
        create: [
          { userId: user.id, name: user.name, role: "OWNER", joinedAt },
          ...people.map((p) => ({ userId: p.id, name: p.name, joinedAt })),
        ],
      },
    },
  });

  revalidateGroups();
  return { ok: true, id: group.id };
}

export async function addGroupMembers(
  groupId: string,
  formData: FormData,
): Promise<GroupActionResult> {
  const access = await requireMember(groupId);
  if (!access) return fail("Group not found");

  const existing = await prisma.groupMember.findMany({
    where: { groupId },
    select: { userId: true, leftAt: true },
  });
  const active = existing.filter((m) => !m.leftAt);
  const inGroup = new Set(active.flatMap((m) => (m.userId ? [m.userId] : [])));
  const leftBefore = new Set(
    existing.flatMap((m) => (m.leftAt && m.userId ? [m.userId] : [])),
  );

  const people = await pickedUsers(formData, inGroup);
  if (!people) return fail(`A group can have at most ${MAX_MEMBERS} members`);
  if (people.length === 0)
    return fail("Pick someone who isn't already in the group");
  if (active.length + people.length > MAX_MEMBERS) {
    return fail(`A group can have at most ${MAX_MEMBERS} members`);
  }

  const joinedAt = new Date();
  const returning = people.filter((p) => leftBefore.has(p.id));
  const fresh = people.filter((p) => !leftBefore.has(p.id));

  await prisma.$transaction([
    // Re-adding restores their original membership, history included.
    ...returning.map((p) =>
      prisma.groupMember.update({
        where: { groupId_userId: { groupId, userId: p.id } },
        data: { leftAt: null, joinedAt, name: p.name },
      }),
    ),
    prisma.groupMember.createMany({
      data: fresh.map((p) => ({
        groupId,
        userId: p.id,
        name: p.name,
        joinedAt,
      })),
      skipDuplicates: true,
    }),
    prisma.group.update({
      where: { id: groupId },
      data: { updatedAt: joinedAt },
    }),
  ]);

  revalidateGroups();
  return { ok: true };
}

/** Only pending invites with no expenses or payments attached can be removed. */
export async function removePendingMember(
  memberId: string,
): Promise<GroupActionResult> {
  const target = await prisma.groupMember.findUnique({
    where: { id: memberId },
    include: {
      _count: {
        select: { paid: true, shares: true, sent: true, received: true },
      },
    },
  });
  if (!target) return fail("Member not found");

  const access = await requireMember(target.groupId);
  if (!access) return fail("Member not found");
  if (target.userId) return fail("Only pending invites can be removed");

  const c = target._count;
  if (c.paid + c.shares + c.sent + c.received > 0) {
    return fail("They're part of existing expenses — delete those first");
  }

  await prisma.groupMember.delete({ where: { id: memberId } });
  revalidateGroups();
  return { ok: true };
}

export async function acceptGroupInvite(
  token: string,
): Promise<GroupActionResult> {
  const user = await getCurrentUser();
  if (!token || token.length > 100) return fail("This invite link is invalid");

  const member = await prisma.groupMember.findUnique({
    where: { inviteTokenHash: hashToken(token) },
  });
  if (!member || member.userId)
    return fail("This invite link is invalid or has already been used");

  const already = await prisma.groupMember.findFirst({
    where: { groupId: member.groupId, userId: user.id },
    select: { id: true },
  });
  if (already) return fail("You're already a member of this group");

  await prisma.groupMember.update({
    where: { id: member.id },
    data: {
      userId: user.id,
      joinedAt: new Date(),
      inviteTokenHash: null,
      name: user.name,
    },
  });

  revalidateGroups();
  return { ok: true, id: member.groupId };
}

export async function deleteGroup(groupId: string): Promise<GroupActionResult> {
  const access = await requireMember(groupId);
  if (!access) return fail("Group not found");
  if (access.member.role !== "OWNER")
    return fail("Only the group owner can delete it");

  await prisma.group.delete({ where: { id: groupId } });
  revalidateGroups();
  return { ok: true };
}

/** You can only leave once settled up, so nobody is left holding your debt. */
export async function leaveGroup(groupId: string): Promise<GroupActionResult> {
  const access = await requireMember(groupId);
  if (!access) return fail("Group not found");
  const me = access.member;

  const [paid, owed, sent, received, refs, nextOwner] = await Promise.all([
    prisma.groupExpense.aggregate({
      where: { paidById: me.id },
      _sum: { amount: true },
    }),
    prisma.groupExpenseShare.aggregate({
      where: { memberId: me.id },
      _sum: { amount: true },
    }),
    prisma.groupSettlement.aggregate({
      where: { fromMemberId: me.id },
      _sum: { amount: true },
    }),
    prisma.groupSettlement.aggregate({
      where: { toMemberId: me.id },
      _sum: { amount: true },
    }),
    prisma.groupMember.findUniqueOrThrow({
      where: { id: me.id },
      select: {
        _count: {
          select: { paid: true, shares: true, sent: true, received: true },
        },
      },
    }),
    prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: { not: null },
        leftAt: null,
        id: { not: me.id },
      },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    }),
  ]);

  const balance =
    (paid._sum.amount ?? 0n) -
    (owed._sum.amount ?? 0n) +
    (sent._sum.amount ?? 0n) -
    (received._sum.amount ?? 0n);
  if (balance !== 0n) return fail("Settle up before leaving the group");

  if (me.role === "OWNER" && !nextOwner)
    return fail("You're the only member — delete the group instead");

  const c = refs._count;
  const hasHistory = c.paid + c.shares + c.sent + c.received > 0;

  await prisma.$transaction([
    // Past expenses still point at this row; keeping it also lets a re-add restore it.
    hasHistory
      ? prisma.groupMember.update({
          where: { id: me.id },
          data: { leftAt: new Date(), role: "MEMBER" },
        })
      : prisma.groupMember.delete({ where: { id: me.id } }),
    ...(me.role === "OWNER" && nextOwner
      ? [
          prisma.groupMember.update({
            where: { id: nextOwner.id },
            data: { role: "OWNER" },
          }),
        ]
      : []),
    prisma.group.update({
      where: { id: groupId },
      data: { updatedAt: new Date() },
    }),
  ]);

  revalidateGroups();
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Expenses & settlements                                              */
/* ------------------------------------------------------------------ */

const expenseSchema = z.object({
  description: z.string().trim().min(1, "What was it for?").max(80),
  amount: amountSchema,
  paidById: z.string().min(1, "Who paid?"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  splitType: z.enum(SPLIT_TYPES),
});

export async function addGroupExpense(
  groupId: string,
  formData: FormData,
): Promise<GroupActionResult> {
  const access = await requireMember(groupId);
  if (!access) return fail("Group not found");

  const parsed = expenseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const data = parsed.data;

  const members = await prisma.groupMember.findMany({
    where: {
      groupId,
      leftAt: null,
      OR: [{ userId: { not: null } }, { inviteTokenHash: { not: null } }],
    },
  });
  const memberIds = new Set(members.map((m) => m.id));
  if (!memberIds.has(data.paidById)) return fail("Choose who paid");

  const values = new Map<string, number>();
  if (data.splitType === "EQUAL") {
    for (const id of formData.getAll("participant").map(String)) {
      if (memberIds.has(id)) values.set(id, 1);
    }
  } else {
    for (const m of members) {
      const raw = String(formData.get(`share_${m.id}`) ?? "").replace(
        /[₹,%\s]/g,
        "",
      );
      if (raw) values.set(m.id, Number(raw));
    }
  }

  const split = computeShares(data.amount, data.splitType, values);
  if (!split.ok) return fail(split.error);

  await prisma.$transaction([
    prisma.groupExpense.create({
      data: {
        groupId,
        description: data.description,
        amount: data.amount,
        paidById: data.paidById,
        splitType: data.splitType,
        date: parseDate(data.date),
        createdById: access.user.id,
        shares: {
          create: [...split.shares].map(([memberId, amount]) => ({
            memberId,
            amount,
          })),
        },
      },
    }),
    prisma.group.update({
      where: { id: groupId },
      data: { updatedAt: new Date() },
    }),
  ]);

  revalidateGroups();
  return { ok: true };
}

export async function deleteGroupExpense(
  expenseId: string,
): Promise<GroupActionResult> {
  const expense = await prisma.groupExpense.findUnique({
    where: { id: expenseId },
    select: { groupId: true },
  });
  if (!expense) return fail("Expense not found");
  if (!(await requireMember(expense.groupId))) return fail("Expense not found");

  await prisma.groupExpense.delete({ where: { id: expenseId } });
  revalidateGroups();
  return { ok: true };
}

const settleSchema = z.object({
  fromMemberId: z.string().min(1, "Who paid?"),
  toMemberId: z.string().min(1, "Who received it?"),
  amount: amountSchema,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
});

export async function settleGroupDebt(
  groupId: string,
  formData: FormData,
): Promise<GroupActionResult> {
  const access = await requireMember(groupId);
  if (!access) return fail("Group not found");

  const parsed = settleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const data = parsed.data;
  if (data.fromMemberId === data.toMemberId)
    return fail("Payer and receiver must be different people");

  const members = await prisma.groupMember.findMany({
    where: { groupId, id: { in: [data.fromMemberId, data.toMemberId] } },
  });
  const from = members.find((m) => m.id === data.fromMemberId);
  const to = members.find((m) => m.id === data.toMemberId);
  if (!from || !to) return fail("Choose two people from this group");

  await prisma.$transaction([
    prisma.groupSettlement.create({
      data: {
        groupId,
        fromMemberId: from.id,
        toMemberId: to.id,
        amount: data.amount,
        date: parseDate(data.date),
        createdById: access.user.id,
      },
    }),
    prisma.group.update({
      where: { id: groupId },
      data: { updatedAt: new Date() },
    }),
  ]);

  revalidateGroups();
  return { ok: true };
}

export async function deleteGroupSettlement(
  settlementId: string,
): Promise<GroupActionResult> {
  const settlement = await prisma.groupSettlement.findUnique({
    where: { id: settlementId },
    select: { groupId: true },
  });
  if (!settlement) return fail("Payment not found");
  if (!(await requireMember(settlement.groupId)))
    return fail("Payment not found");

  await prisma.groupSettlement.delete({ where: { id: settlementId } });
  revalidateGroups();
  return { ok: true };
}
