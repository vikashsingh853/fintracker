import { beforeEach, describe, expect, it, vi } from "vitest";

const ME = { id: "u_me", name: "Vikash", phone: "9876500000", email: null };

const { prisma, getCurrentUser } = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  prisma: {
    user: { findUnique: vi.fn(), findMany: vi.fn() },
    party: { findMany: vi.fn() },
    group: { create: vi.fn(), update: vi.fn() },
    groupMember: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    groupExpense: { aggregate: vi.fn(), create: vi.fn() },
    groupExpenseShare: { aggregate: vi.fn() },
    groupSettlement: { aggregate: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("./prisma", () => ({ prisma }));
vi.mock("./session", () => ({ getCurrentUser }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  addGroupExpense,
  addGroupMembers,
  createGroup,
  leaveGroup,
  searchPeople,
} from "./group-actions";

function form(entries: Array<[string, string]>) {
  const fd = new FormData();
  for (const [k, v] of entries) fd.append(k, v);
  return fd;
}

function sums(paid: bigint, owed: bigint, sent: bigint, received: bigint) {
  prisma.groupExpense.aggregate.mockResolvedValue({ _sum: { amount: paid } });
  prisma.groupExpenseShare.aggregate.mockResolvedValue({
    _sum: { amount: owed },
  });
  prisma.groupSettlement.aggregate
    .mockResolvedValueOnce({ _sum: { amount: sent } })
    .mockResolvedValueOnce({ _sum: { amount: received } });
}

function history(n: number) {
  prisma.groupMember.findUniqueOrThrow.mockResolvedValue({
    _count: { paid: n, shares: 0, sent: 0, received: 0 },
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  getCurrentUser.mockResolvedValue(ME);
  prisma.$transaction.mockImplementation((ops: unknown[]) => Promise.all(ops));
});

describe("searchPeople", () => {
  it.each(["9876543210", "+91 98765 43210", "09876543210", "919876543210"])(
    "finds any account by full mobile number (%s)",
    async (input) => {
      const friend = { id: "u_1", name: "Rahul", phone: "9876543210" };
      prisma.user.findUnique.mockResolvedValue(friend);

      await expect(searchPeople(input)).resolves.toEqual([friend]);
      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { phone: "9876543210" } }),
      );
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    },
  );

  it("marks your own number as you", async () => {
    prisma.user.findUnique.mockResolvedValue(ME);
    await expect(searchPeople(ME.phone)).resolves.toEqual([
      { ...ME, isYou: true },
    ]);
  });

  it("returns nothing for unknown numbers", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(searchPeople("9123456789")).resolves.toEqual([]);
  });

  it("skips the DB for queries under 2 characters", async () => {
    await expect(searchPeople("a")).resolves.toEqual([]);
    await expect(searchPeople("   ")).resolves.toEqual([]);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("limits name search to group co-members and khata contacts", async () => {
    prisma.party.findMany.mockResolvedValue([{ phone: "9000000001" }]);
    prisma.user.findMany.mockResolvedValue([]);

    await searchPeople("rah");

    const { where, take } = prisma.user.findMany.mock.calls[0][0];
    expect(take).toBe(8);
    expect(where.id).toEqual({ not: ME.id });
    expect(where.AND[0].OR).toEqual([
      {
        groupMembers: {
          some: {
            leftAt: null,
            group: { members: { some: { userId: ME.id, leftAt: null } } },
          },
        },
      },
      { phone: { in: ["9000000001"] } },
    ]);
    expect(where.AND[1].OR).toEqual([
      { name: { contains: "rah", mode: "insensitive" } },
    ]);
  });

  it("adds partial-number matching for 3+ digits", async () => {
    prisma.party.findMany.mockResolvedValue([]);
    prisma.user.findMany.mockResolvedValue([]);

    await searchPeople("98765");

    const { where } = prisma.user.findMany.mock.calls[0][0];
    expect(where.AND[1].OR).toContainEqual({ phone: { contains: "98765" } });
  });
});

describe("createGroup", () => {
  it("requires a group name", async () => {
    const res = await createGroup(form([["memberUserId", "u_1"]]));
    expect(res.ok).toBe(false);
  });

  it("requires at least one other person", async () => {
    const res = await createGroup(
      form([
        ["name", "Goa trip"],
        ["memberUserId", ME.id],
      ]),
    );
    expect(res).toEqual({
      ok: false,
      error: "Add at least one person with a FinTrack account",
    });
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it("rejects ids that aren't real accounts", async () => {
    prisma.user.findMany.mockResolvedValue([]);
    const res = await createGroup(
      form([
        ["name", "Goa trip"],
        ["memberUserId", "u_fake"],
      ]),
    );
    expect(res.ok).toBe(false);
    expect(prisma.group.create).not.toHaveBeenCalled();
  });

  it("caps group size", async () => {
    const ids = Array.from({ length: 21 }, (_, i): [string, string] => [
      "memberUserId",
      `u_${i}`,
    ]);
    const res = await createGroup(form([["name", "Big"], ...ids]));
    expect(res).toEqual({
      ok: false,
      error: "A group can have at most 20 members",
    });
  });

  it("adds owner and picked people as joined members, de-duplicated", async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: "u_1", name: "Rahul" },
      { id: "u_2", name: "Priya" },
    ]);
    prisma.group.create.mockResolvedValue({ id: "g_1" });

    const res = await createGroup(
      form([
        ["name", "  Goa trip  "],
        ["memberUserId", "u_1"],
        ["memberUserId", "u_1"],
        ["memberUserId", "u_2"],
        ["memberUserId", ME.id],
      ]),
    );

    expect(res).toEqual({ ok: true, id: "g_1" });
    expect(prisma.user.findMany.mock.calls[0][0].where).toEqual({
      id: { in: ["u_1", "u_2"] },
    });
    const { data } = prisma.group.create.mock.calls[0][0];
    expect(data.name).toBe("Goa trip");
    expect(data.members.create).toEqual([
      expect.objectContaining({ userId: ME.id, role: "OWNER" }),
      expect.objectContaining({ userId: "u_1", name: "Rahul" }),
      expect.objectContaining({ userId: "u_2", name: "Priya" }),
    ]);
    for (const m of data.members.create) {
      expect(m.joinedAt).toBeInstanceOf(Date);
      expect(m).not.toHaveProperty("email");
      expect(m).not.toHaveProperty("inviteTokenHash");
    }
  });
});

describe("addGroupMembers", () => {
  it("blocks non-members", async () => {
    prisma.groupMember.findFirst.mockResolvedValue(null);
    const res = await addGroupMembers("g_1", form([["memberUserId", "u_1"]]));
    expect(res).toEqual({ ok: false, error: "Group not found" });
  });

  it("ignores people already in the group", async () => {
    prisma.groupMember.findFirst.mockResolvedValue({ id: "m_me" });
    prisma.groupMember.findMany.mockResolvedValue([
      { userId: ME.id, leftAt: null },
      { userId: "u_1", leftAt: null },
    ]);

    const res = await addGroupMembers("g_1", form([["memberUserId", "u_1"]]));
    expect(res).toEqual({
      ok: false,
      error: "Pick someone who isn't already in the group",
    });
    expect(prisma.groupMember.createMany).not.toHaveBeenCalled();
  });

  it("adds new people directly as joined members", async () => {
    prisma.groupMember.findFirst.mockResolvedValue({ id: "m_me" });
    prisma.groupMember.findMany.mockResolvedValue([
      { userId: ME.id, leftAt: null },
    ]);
    prisma.user.findMany.mockResolvedValue([{ id: "u_3", name: "Amit" }]);

    const res = await addGroupMembers("g_1", form([["memberUserId", "u_3"]]));

    expect(res).toEqual({ ok: true });
    const arg = prisma.groupMember.createMany.mock.calls[0][0];
    expect(arg.skipDuplicates).toBe(true);
    expect(arg.data).toEqual([
      expect.objectContaining({ groupId: "g_1", userId: "u_3", name: "Amit" }),
    ]);
    expect(prisma.groupMember.update).not.toHaveBeenCalled();
  });

  it("restores the original row when someone who left is re-added", async () => {
    prisma.groupMember.findFirst.mockResolvedValue({ id: "m_me" });
    prisma.groupMember.findMany.mockResolvedValue([
      { userId: ME.id, leftAt: null },
      { userId: "u_2", leftAt: new Date() },
    ]);
    prisma.user.findMany.mockResolvedValue([{ id: "u_2", name: "Priya" }]);

    const res = await addGroupMembers("g_1", form([["memberUserId", "u_2"]]));

    expect(res).toEqual({ ok: true });
    expect(prisma.groupMember.update).toHaveBeenCalledWith({
      where: { groupId_userId: { groupId: "g_1", userId: "u_2" } },
      data: expect.objectContaining({ leftAt: null, name: "Priya" }),
    });
    expect(prisma.groupMember.createMany.mock.calls[0][0].data).toEqual([]);
  });
});

describe("leaveGroup", () => {
  const member = (role: "OWNER" | "MEMBER") => ({
    id: "m_me",
    groupId: "g_1",
    userId: ME.id,
    role,
  });

  it("refuses while you still owe or are owed", async () => {
    prisma.groupMember.findFirst
      .mockResolvedValueOnce(member("MEMBER"))
      .mockResolvedValueOnce({ id: "m_2" });
    sums(0n, 500n, 0n, 0n);
    history(1);

    const res = await leaveGroup("g_1");
    expect(res).toEqual({
      ok: false,
      error: "Settle up before leaving the group",
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("stops the only member from leaving", async () => {
    prisma.groupMember.findFirst
      .mockResolvedValueOnce(member("OWNER"))
      .mockResolvedValueOnce(null);
    sums(0n, 0n, 0n, 0n);
    history(0);

    const res = await leaveGroup("g_1");
    expect(res.error).toMatch(/delete the group/);
  });

  it("deletes the row when there's no history", async () => {
    prisma.groupMember.findFirst
      .mockResolvedValueOnce(member("MEMBER"))
      .mockResolvedValueOnce({ id: "m_2" });
    sums(0n, 0n, 0n, 0n);
    history(0);

    await expect(leaveGroup("g_1")).resolves.toEqual({ ok: true });
    expect(prisma.groupMember.delete).toHaveBeenCalledWith({
      where: { id: "m_me" },
    });
    expect(prisma.groupMember.update).not.toHaveBeenCalled();
  });

  it("marks as left and hands over ownership when settled with history", async () => {
    prisma.groupMember.findFirst
      .mockResolvedValueOnce(member("OWNER"))
      .mockResolvedValueOnce({ id: "m_2" });
    // Paid 1000, owed 500, got 500 back: settled.
    sums(1000n, 500n, 0n, 500n);
    history(2);

    await expect(leaveGroup("g_1")).resolves.toEqual({ ok: true });
    expect(prisma.groupMember.delete).not.toHaveBeenCalled();
    expect(prisma.groupMember.update).toHaveBeenCalledWith({
      where: { id: "m_me" },
      data: { leftAt: expect.any(Date), role: "MEMBER" },
    });
    expect(prisma.groupMember.update).toHaveBeenCalledWith({
      where: { id: "m_2" },
      data: { role: "OWNER" },
    });
  });
});

describe("addGroupExpense", () => {
  it("excludes members who left from payer and splits", async () => {
    prisma.groupMember.findFirst.mockResolvedValue({ id: "m_me" });
    prisma.groupMember.findMany.mockResolvedValue([{ id: "m_me" }]);

    const res = await addGroupExpense(
      "g_1",
      form([
        ["description", "Dinner"],
        ["amount", "600"],
        ["paidById", "m_left"],
        ["date", "2026-10-04"],
        ["splitType", "EQUAL"],
        ["participant", "m_me"],
      ]),
    );

    expect(res).toEqual({ ok: false, error: "Choose who paid" });
    expect(prisma.groupMember.findMany.mock.calls[0][0].where).toEqual({
      groupId: "g_1",
      leftAt: null,
      OR: [{ userId: { not: null } }, { inviteTokenHash: { not: null } }],
    });
  });
});
