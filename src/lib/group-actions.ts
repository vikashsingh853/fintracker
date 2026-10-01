"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { appUrl, sendEmails, type EmailMessage } from "./email";
import { formatINRCompact, toNumber } from "./money";
import { prisma } from "./prisma";
import { getCurrentUser } from "./session";
import { computeShares } from "./split";
import { SPLIT_TYPES, SPLIT_TYPE_LABELS } from "./types";

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

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address")
  .max(254);

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

function newInviteToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function inviteEmail(
  to: string,
  inviter: string,
  groupName: string,
  token: string,
): EmailMessage {
  return {
    to,
    subject: `${inviter} added you to "${groupName}" on FinTrack`,
    text: `${inviter} created a shared expense group "${groupName}" and added you.\n\nAccept the invite to see balances, add expenses and settle up. You'll need a FinTrack account — you can create one from the link.`,
    action: { label: "Join the group", url: appUrl(`/groups/join/${token}`) },
  };
}

/** Members are entered as parallel name/email lists. */
function parseMemberRows(formData: FormData) {
  const names = formData.getAll("memberName").map(String);
  const emails = formData.getAll("memberEmail").map(String);
  const rows: Array<{ name: string; email: string }> = [];

  for (let i = 0; i < emails.length; i++) {
    const rawEmail = emails[i]?.trim() ?? "";
    const rawName = names[i]?.trim() ?? "";
    if (!rawEmail && !rawName) continue;
    const email = emailSchema.safeParse(rawEmail);
    if (!email.success)
      return { error: `Member ${i + 1}: enter a valid email` } as const;
    const name = rawName || email.data.split("@")[0];
    if (name.length > 60)
      return { error: `Member ${i + 1}: name is too long` } as const;
    rows.push({ name, email: email.data });
  }
  return { rows } as const;
}

async function requireMember(groupId: string) {
  const user = await getCurrentUser();
  const member = await prisma.groupMember.findFirst({
    where: { groupId, userId: user.id },
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

  const yourEmail = emailSchema.safeParse(formData.get("yourEmail") ?? "");
  if (!yourEmail.success)
    return fail("Enter your email — it's required for group updates");

  const parsed = parseMemberRows(formData);
  if ("error" in parsed) return fail(parsed.error!);

  const seen = new Set([yourEmail.data]);
  const members = parsed.rows.filter(
    (m) => !seen.has(m.email) && seen.add(m.email),
  );
  if (members.length === 0)
    return fail("Add at least one other member by email");
  if (members.length + 1 > MAX_MEMBERS)
    return fail(`A group can have at most ${MAX_MEMBERS} members`);

  if (user.email !== yourEmail.data) {
    const taken = await prisma.user.findFirst({
      where: { email: yourEmail.data, id: { not: user.id } },
      select: { id: true },
    });
    if (taken)
      return fail("That email is already linked to another FinTrack account");
  }

  const invites = members.map((m) => ({ ...m, ...newInviteToken() }));

  const group = await prisma.$transaction(async (tx) => {
    if (user.email !== yourEmail.data) {
      await tx.user.update({
        where: { id: user.id },
        data: { email: yourEmail.data },
      });
    }
    return tx.group.create({
      data: {
        name: name.data,
        createdById: user.id,
        members: {
          create: [
            {
              userId: user.id,
              name: user.name,
              email: yourEmail.data,
              role: "OWNER",
              joinedAt: new Date(),
            },
            ...invites.map((m) => ({
              name: m.name,
              email: m.email,
              inviteTokenHash: m.hash,
            })),
          ],
        },
      },
    });
  });

  await sendEmails(
    invites.map((m) => inviteEmail(m.email, user.name, name.data, m.token)),
  );

  revalidateGroups();
  return { ok: true, id: group.id };
}

export async function addGroupMembers(
  groupId: string,
  formData: FormData,
): Promise<GroupActionResult> {
  const access = await requireMember(groupId);
  if (!access) return fail("Group not found");

  const parsed = parseMemberRows(formData);
  if ("error" in parsed) return fail(parsed.error!);

  const [group, existing] = await Promise.all([
    prisma.group.findUniqueOrThrow({
      where: { id: groupId },
      select: { name: true },
    }),
    prisma.groupMember.findMany({
      where: { groupId },
      select: { email: true },
    }),
  ]);

  const seen = new Set(existing.map((m) => m.email));
  const members = parsed.rows.filter(
    (m) => !seen.has(m.email) && seen.add(m.email),
  );
  if (members.length === 0)
    return fail("Those people are already in the group");
  if (existing.length + members.length > MAX_MEMBERS) {
    return fail(`A group can have at most ${MAX_MEMBERS} members`);
  }

  const invites = members.map((m) => ({ ...m, ...newInviteToken() }));
  await prisma.$transaction([
    prisma.groupMember.createMany({
      data: invites.map((m) => ({
        groupId,
        name: m.name,
        email: m.email,
        inviteTokenHash: m.hash,
      })),
    }),
    prisma.group.update({
      where: { id: groupId },
      data: { updatedAt: new Date() },
    }),
  ]);

  await sendEmails(
    invites.map((m) =>
      inviteEmail(m.email, access.user.name, group.name, m.token),
    ),
  );

  revalidateGroups();
  return { ok: true };
}

/** Issues a fresh invite link; the previous one stops working. */
export async function resendGroupInvite(
  memberId: string,
): Promise<GroupActionResult> {
  const target = await prisma.groupMember.findUnique({
    where: { id: memberId },
    include: { group: { select: { name: true } } },
  });
  if (!target) return fail("Member not found");

  const access = await requireMember(target.groupId);
  if (!access) return fail("Member not found");
  if (target.userId) return fail("They've already joined");

  const invite = newInviteToken();
  await prisma.groupMember.update({
    where: { id: memberId },
    data: { inviteTokenHash: invite.hash },
  });
  await sendEmails([
    inviteEmail(
      target.email,
      access.user.name,
      target.group.name,
      invite.token,
    ),
  ]);

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

  // Opening the link proves they own this address, so it can become their account email.
  const emailFree =
    !user.email &&
    !(await prisma.user.findFirst({
      where: { email: member.email },
      select: { id: true },
    }));

  await prisma.$transaction([
    prisma.groupMember.update({
      where: { id: member.id },
      data: {
        userId: user.id,
        joinedAt: new Date(),
        inviteTokenHash: null,
        name: user.name,
      },
    }),
    ...(emailFree
      ? [
          prisma.user.update({
            where: { id: user.id },
            data: { email: member.email },
          }),
        ]
      : []),
  ]);

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

  const [group, members] = await Promise.all([
    prisma.group.findUniqueOrThrow({
      where: { id: groupId },
      select: { name: true },
    }),
    prisma.groupMember.findMany({ where: { groupId } }),
  ]);
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

  const payer = members.find((m) => m.id === data.paidById)!;
  const total = formatINRCompact(toNumber(data.amount));
  await sendEmails(
    members
      .filter((m) => m.id !== access.member.id)
      .map((m) => {
        const share = split.shares.get(m.id) ?? 0n;
        const yourLine =
          m.id === payer.id
            ? `You paid ${total}${share > 0n ? ` and your share is ${formatINRCompact(toNumber(share))}` : ""}.`
            : share > 0n
              ? `Your share: ${formatINRCompact(toNumber(share))} (you owe ${payer.name}).`
              : "You're not part of this split.";
        return {
          to: m.email,
          subject: `${access.user.name} added "${data.description}" (${total}) in ${group.name}`,
          text: `${access.user.name} added an expense in "${group.name}".\n\n${data.description}: ${total}, paid by ${payer.name}, split ${SPLIT_TYPE_LABELS[data.splitType].toLowerCase()}.\n\n${yourLine}${m.userId ? "" : "\n\nAccept the invite email you received to see the group."}`,
          action: m.userId
            ? { label: "View group", url: appUrl(`/groups/${groupId}`) }
            : undefined,
        };
      }),
  );

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

  const [group, members] = await Promise.all([
    prisma.group.findUniqueOrThrow({
      where: { id: groupId },
      select: { name: true },
    }),
    prisma.groupMember.findMany({
      where: { groupId, id: { in: [data.fromMemberId, data.toMemberId] } },
    }),
  ]);
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

  const amount = formatINRCompact(toNumber(data.amount));
  await sendEmails(
    [from, to]
      .filter((m) => m.id !== access.member.id)
      .map((m) => ({
        to: m.email,
        subject: `${from.name} paid ${to.name} ${amount} in ${group.name}`,
        text: `${access.user.name} recorded a payment in "${group.name}".\n\n${from.name} paid ${to.name} ${amount}.${m.userId ? "" : "\n\nAccept the invite email you received to see the group."}`,
        action: m.userId
          ? { label: "View group", url: appUrl(`/groups/${groupId}`) }
          : undefined,
      })),
  );

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
