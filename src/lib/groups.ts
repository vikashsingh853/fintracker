import "server-only";
import { createHash } from "node:crypto";
import { cache } from "react";
import { prisma } from "./prisma";
import { getCurrentUserId } from "./session";
import { toNumber } from "./money";
import { simplifyDebts } from "./split";
import type {
  GroupActivity,
  GroupDetailDTO,
  GroupMemberDTO,
  GroupSummaryDTO,
  SplitType,
} from "./types";

/** balance = paid − owed + settlements sent − settlements received */
async function memberBalances(
  groupIds: string[],
): Promise<Map<string, number>> {
  const [paid, owed, sent, received] = await Promise.all([
    prisma.groupExpense.groupBy({
      by: ["paidById"],
      where: { groupId: { in: groupIds } },
      _sum: { amount: true },
    }),
    prisma.groupExpenseShare.groupBy({
      by: ["memberId"],
      where: { expense: { groupId: { in: groupIds } } },
      _sum: { amount: true },
    }),
    prisma.groupSettlement.groupBy({
      by: ["fromMemberId"],
      where: { groupId: { in: groupIds } },
      _sum: { amount: true },
    }),
    prisma.groupSettlement.groupBy({
      by: ["toMemberId"],
      where: { groupId: { in: groupIds } },
      _sum: { amount: true },
    }),
  ]);

  const balances = new Map<string, number>();
  const add = (id: string, value: bigint | null) =>
    balances.set(id, (balances.get(id) ?? 0) + toNumber(value ?? 0n));

  for (const row of paid) add(row.paidById, row._sum.amount);
  for (const row of owed) add(row.memberId, -(row._sum.amount ?? 0n));
  for (const row of sent) add(row.fromMemberId, row._sum.amount);
  for (const row of received) add(row.toMemberId, -(row._sum.amount ?? 0n));
  return balances;
}

export const getGroups = cache(async function getGroups(): Promise<
  GroupSummaryDTO[]
> {
  const userId = await getCurrentUserId();

  const groups = await prisma.group.findMany({
    where: { members: { some: { userId } } },
    include: { members: { select: { id: true, userId: true } } },
    orderBy: { updatedAt: "desc" },
  });
  if (groups.length === 0) return [];

  const balances = await memberBalances(groups.map((g) => g.id));

  return groups.map((g) => {
    const you = g.members.find((m) => m.userId === userId)!;
    return {
      id: g.id,
      name: g.name,
      memberCount: g.members.length,
      pendingCount: g.members.filter((m) => !m.userId).length,
      yourBalance: balances.get(you.id) ?? 0,
      lastActivity: g.updatedAt.toISOString(),
    };
  });
});

/** Read-only lookup for the join page; accepting happens in a server action. */
export async function getInviteByToken(token: string) {
  if (!token || token.length > 100) return null;
  const hash = createHash("sha256").update(token).digest("hex");

  const member = await prisma.groupMember.findUnique({
    where: { inviteTokenHash: hash },
    include: {
      group: {
        select: {
          name: true,
          createdBy: { select: { name: true } },
          _count: { select: { members: true } },
        },
      },
    },
  });
  if (!member) return null;

  return {
    groupName: member.group.name,
    inviterName: member.group.createdBy.name,
    memberCount: member.group._count.members,
    email: member.email,
  };
}

export const getGroupDetail = cache(async function getGroupDetail(
  groupId: string,
): Promise<GroupDetailDTO | null> {
  const userId = await getCurrentUserId();

  const group = await prisma.group.findFirst({
    where: { id: groupId, members: { some: { userId } } },
    include: {
      members: { orderBy: { createdAt: "asc" } },
      expenses: {
        include: { shares: true },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      },
      settlements: { orderBy: [{ date: "desc" }, { createdAt: "desc" }] },
    },
  });
  if (!group) return null;

  const you = group.members.find((m) => m.userId === userId)!;
  const names = new Map(group.members.map((m) => [m.id, m.name]));
  const nameOf = (id: string) => names.get(id) ?? "Former member";

  const balances = new Map<string, number>(group.members.map((m) => [m.id, 0]));
  const bump = (id: string, delta: number) =>
    balances.set(id, (balances.get(id) ?? 0) + delta);

  const activity: GroupActivity[] = [];
  // Same-day items fall back to creation time so the newest stays on top.
  const createdAt = new Map<string, string>();

  for (const e of group.expenses) {
    createdAt.set(`EXPENSE-${e.id}`, e.createdAt.toISOString());
    const amount = toNumber(e.amount);
    bump(e.paidById, amount);
    const shares = e.shares.map((s) => {
      const share = toNumber(s.amount);
      bump(s.memberId, -share);
      return { memberId: s.memberId, name: nameOf(s.memberId), amount: share };
    });
    const yourShare = shares.find((s) => s.memberId === you.id)?.amount ?? 0;
    activity.push({
      kind: "EXPENSE",
      id: e.id,
      date: e.date.toISOString(),
      description: e.description,
      amount,
      splitType: e.splitType as SplitType,
      paidBy: { id: e.paidById, name: nameOf(e.paidById) },
      shares,
      yourNet: (e.paidById === you.id ? amount : 0) - yourShare,
    });
  }

  for (const s of group.settlements) {
    createdAt.set(`SETTLEMENT-${s.id}`, s.createdAt.toISOString());
    const amount = toNumber(s.amount);
    bump(s.fromMemberId, amount);
    bump(s.toMemberId, -amount);
    activity.push({
      kind: "SETTLEMENT",
      id: s.id,
      date: s.date.toISOString(),
      amount,
      from: { id: s.fromMemberId, name: nameOf(s.fromMemberId) },
      to: { id: s.toMemberId, name: nameOf(s.toMemberId) },
    });
  }

  const key = (a: GroupActivity) =>
    `${a.date}|${createdAt.get(`${a.kind}-${a.id}`)}`;
  activity.sort((a, b) => key(b).localeCompare(key(a)));

  const members: GroupMemberDTO[] = group.members.map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email,
    role: m.role === "OWNER" ? "OWNER" : "MEMBER",
    isPending: !m.userId,
    isYou: m.id === you.id,
    balance: balances.get(m.id) ?? 0,
  }));

  return {
    id: group.id,
    name: group.name,
    isOwner: you.role === "OWNER",
    youMemberId: you.id,
    members,
    debts: simplifyDebts(balances).map((d) => ({
      fromId: d.from,
      fromName: nameOf(d.from),
      toId: d.to,
      toName: nameOf(d.to),
      amount: d.amount,
    })),
    activity,
    totalSpent: group.expenses.reduce((sum, e) => sum + toNumber(e.amount), 0),
  };
});
