import "server-only";
import { cache } from "react";
import { prisma } from "./prisma";
import { getCurrentUserId } from "./session";
import { toNumber } from "./money";
import type {
  KhataEntryDTO,
  KhataEntryType,
  KhataSummary,
  PartyDTO,
  PartyType,
} from "./types";

/**
 * Khata balance convention, matching how udhaar books are kept:
 *
 *   balance = sum(GAVE) − sum(GOT)
 *
 * GAVE means you handed over money or goods on credit, so they owe you more.
 * GOT means they paid you back, so the outstanding amount falls.
 *
 * A positive balance is "you will get", negative is "you will give".
 */
function netBalance(gave: number, got: number) {
  return gave - got;
}

export const getParties = cache(async function getParties(search?: string): Promise<PartyDTO[]> {
  const userId = await getCurrentUserId();

  const parties = await prisma.party.findMany({
    where: {
      userId,
      isArchived: false,
      ...(search
        ? {
            OR: [
              // Postgres LIKE is case-sensitive, so match insensitively.
              { name: { contains: search, mode: "insensitive" as const } },
              { phone: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
  });

  if (parties.length === 0) return [];

  const partyIds = parties.map((p) => p.id);

  const [totals, latest] = await Promise.all([
    prisma.khataEntry.groupBy({
      by: ["partyId", "type"],
      where: { userId, partyId: { in: partyIds } },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.khataEntry.groupBy({
      by: ["partyId"],
      where: { userId, partyId: { in: partyIds } },
      _max: { date: true },
    }),
  ]);

  const gave = new Map<string, number>();
  const got = new Map<string, number>();
  const counts = new Map<string, number>();

  for (const row of totals) {
    const amount = toNumber(row._sum.amount ?? 0n);
    const target = row.type === "GAVE" ? gave : got;
    target.set(row.partyId, (target.get(row.partyId) ?? 0) + amount);
    counts.set(row.partyId, (counts.get(row.partyId) ?? 0) + row._count._all);
  }

  const lastActivity = new Map(
    latest.map((row) => [row.partyId, row._max.date?.toISOString() ?? null]),
  );

  return parties.map((p) => ({
    id: p.id,
    name: p.name,
    phone: p.phone,
    note: p.note,
    type: p.type as PartyType,
    isArchived: p.isArchived,
    balance: netBalance(gave.get(p.id) ?? 0, got.get(p.id) ?? 0),
    lastActivity: lastActivity.get(p.id) ?? null,
    entryCount: counts.get(p.id) ?? 0,
  }));
});

export const getKhataSummary = cache(async function getKhataSummary(): Promise<KhataSummary> {
  const parties = await getParties();

  let toGet = 0;
  let toGive = 0;

  for (const party of parties) {
    if (party.balance > 0) toGet += party.balance;
    else if (party.balance < 0) toGive += -party.balance;
  }

  return { toGet, toGive, net: toGet - toGive, partyCount: parties.length };
});

export interface PartyDetail {
  party: PartyDTO;
  entries: KhataEntryDTO[];
}

export const getPartyDetail = cache(async function getPartyDetail(partyId: string): Promise<PartyDetail | null> {
  const userId = await getCurrentUserId();

  const party = await prisma.party.findFirst({ where: { id: partyId, userId } });
  if (!party) return null;

  const rows = await prisma.khataEntry.findMany({
    where: { userId, partyId },
    // Oldest first so the running balance accumulates correctly.
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });

  let running = 0;
  const entries: KhataEntryDTO[] = rows.map((e) => {
    const amount = toNumber(e.amount);
    running += e.type === "GAVE" ? amount : -amount;
    return {
      id: e.id,
      type: e.type as KhataEntryType,
      amount,
      date: e.date.toISOString(),
      note: e.note,
      runningBalance: running,
    };
  });

  const gave = rows
    .filter((e) => e.type === "GAVE")
    .reduce((sum, e) => sum + toNumber(e.amount), 0);
  const got = rows
    .filter((e) => e.type === "GOT")
    .reduce((sum, e) => sum + toNumber(e.amount), 0);

  return {
    party: {
      id: party.id,
      name: party.name,
      phone: party.phone,
      note: party.note,
      type: party.type as PartyType,
      isArchived: party.isArchived,
      balance: netBalance(gave, got),
      lastActivity: rows.at(-1)?.date.toISOString() ?? null,
      entryCount: rows.length,
    },
    // Newest first for display.
    entries: entries.reverse(),
  };
});
