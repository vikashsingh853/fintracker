import "server-only";
import { nextOccurrence } from "./dates";
import { prisma } from "./prisma";
import type { Frequency } from "./types";

/** Matches the cash-flow projection cap; anything left over posts on the next request. */
const MAX_CATCH_UP = 60;

/**
 * Turns every due auto-post rule (salary, EMIs, SIPs…) into real ledger
 * transactions, so account balances move on the due date without a manual
 * "Mark paid". Variable-amount rules are skipped — they need the real figure.
 */
export async function postDueAutoRules(userId: string): Promise<void> {
  const now = new Date();
  const due = await prisma.recurringRule.findMany({
    where: {
      userId,
      isActive: true,
      autoPost: true,
      isVariable: false,
      nextDueDate: { lte: now },
    },
  });

  for (const rule of due) {
    const spec = {
      frequency: rule.frequency as Frequency,
      interval: rule.interval,
      dayOfMonth: rule.dayOfMonth,
      weekday: rule.weekday,
      monthOfYear: rule.monthOfYear,
    };

    const dates: Date[] = [];
    let cursor = rule.nextDueDate;
    while (
      cursor <= now &&
      (!rule.endDate || cursor <= rule.endDate) &&
      dates.length < MAX_CATCH_UP
    ) {
      dates.push(cursor);
      cursor = nextOccurrence(spec, cursor);
    }
    if (dates.length === 0) continue;

    await prisma.$transaction(async (tx) => {
      // Claim the rule by its current due date so concurrent requests can't double-post.
      const claimed = await tx.recurringRule.updateMany({
        where: { id: rule.id, nextDueDate: rule.nextDueDate },
        data: { nextDueDate: cursor, lastPostedAt: now },
      });
      if (claimed.count === 0) return;

      await tx.transaction.createMany({
        data: dates.map((date) => ({
          userId,
          type: rule.type,
          amount: rule.amount,
          date,
          accountId: rule.accountId,
          toAccountId: rule.type === "TRANSFER" ? rule.toAccountId : null,
          categoryId: rule.type === "TRANSFER" ? null : rule.categoryId,
          note: rule.name,
          merchant: rule.merchant,
          paymentMethod: "AUTO_DEBIT" as const,
          excludeFromBudget: rule.type === "TRANSFER",
          recurringRuleId: rule.id,
        })),
      });
    });
  }
}
