import { cache } from "react";
import { endOfMonth, startOfDay } from "date-fns";
import { prisma } from "./prisma";
import { getCurrentUser, getCurrentUserId } from "./session";
import { toNumber } from "./money";
import { postDueAutoRules } from "./recurring-sync";
import {
  daysRemainingInMonth,
  monthRange,
  occurrencesBetween,
  periodKey,
} from "./dates";
import {
  isLiability,
  type AccountDTO,
  type AccountType,
  type BudgetDTO,
  type CategoryDTO,
  type Frequency,
  type MonthSummary,
  type PaymentMethod,
  type RecurringRuleDTO,
  type SafeToSpend,
  type TransactionDTO,
  type TransactionType,
  type UpcomingItem,
} from "./types";

/**
 * User id for ledger reads, after materialising any auto-post rules that have
 * fallen due. Runs once per request; a failure here must not break the page.
 */
const getLedgerUserId = cache(
  async function getLedgerUserId(): Promise<string> {
    const userId = await getCurrentUserId();
    try {
      await postDueAutoRules(userId);
    } catch (error) {
      console.error("Auto-posting recurring rules failed", error);
    }
    return userId;
  },
);

/* ------------------------------------------------------------------ */
/* Accounts                                                            */
/* ------------------------------------------------------------------ */

/**
 * Balances are always derived from the ledger, never stored, so a corrected
 * transaction can't leave a stale balance behind.
 *
 * balance = opening + income + transfers in − expenses − transfers out
 *
 * Credit cards start at 0 and go negative as spend accrues, so the magnitude
 * of a negative balance is the outstanding amount.
 */
export const getAccounts = cache(async function getAccounts(
  includeArchived = false,
): Promise<AccountDTO[]> {
  const userId = await getLedgerUserId();

  const [accounts, grouped, transfersIn] = await Promise.all([
    prisma.account.findMany({
      where: { userId, ...(includeArchived ? {} : { isArchived: false }) },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    prisma.transaction.groupBy({
      by: ["accountId", "type"],
      where: { userId },
      _sum: { amount: true },
    }),
    prisma.transaction.groupBy({
      by: ["toAccountId"],
      where: { userId, type: "TRANSFER", toAccountId: { not: null } },
      _sum: { amount: true },
    }),
  ]);

  const outflow = new Map<string, number>();
  const inflow = new Map<string, number>();

  for (const row of grouped) {
    const amount = toNumber(row._sum.amount ?? 0n);
    if (row.type === "INCOME") {
      inflow.set(row.accountId, (inflow.get(row.accountId) ?? 0) + amount);
    } else {
      // EXPENSE and TRANSFER both leave `accountId`.
      outflow.set(row.accountId, (outflow.get(row.accountId) ?? 0) + amount);
    }
  }

  for (const row of transfersIn) {
    if (!row.toAccountId) continue;
    const amount = toNumber(row._sum.amount ?? 0n);
    inflow.set(row.toAccountId, (inflow.get(row.toAccountId) ?? 0) + amount);
  }

  return accounts.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type as AccountType,
    openingBalance: toNumber(a.openingBalance),
    balance:
      toNumber(a.openingBalance) +
      (inflow.get(a.id) ?? 0) -
      (outflow.get(a.id) ?? 0),
    creditLimit: a.creditLimit == null ? null : toNumber(a.creditLimit),
    billingCycleDay: a.billingCycleDay,
    dueDay: a.dueDay,
    icon: a.icon,
    color: a.color,
    isLiquid: a.isLiquid,
    isArchived: a.isArchived,
    sortOrder: a.sortOrder,
  }));
});

export interface NetWorth {
  netWorth: number;
  liquid: number;
  investments: number;
  liabilities: number;
}

export function computeNetWorth(accounts: AccountDTO[]): NetWorth {
  let liquid = 0;
  let investments = 0;
  let liabilities = 0;

  for (const a of accounts) {
    if (isLiability(a.type)) {
      // Stored as a negative balance; report it as a positive amount owed.
      liabilities += Math.max(0, -a.balance);
    } else if (a.type === "INVESTMENT") {
      investments += a.balance;
    } else {
      liquid += a.balance;
    }
  }

  return {
    netWorth: liquid + investments - liabilities,
    liquid,
    investments,
    liabilities,
  };
}

/* ------------------------------------------------------------------ */
/* Categories                                                          */
/* ------------------------------------------------------------------ */

export const getCategories = cache(async function getCategories(
  kind?: "INCOME" | "EXPENSE",
): Promise<CategoryDTO[]> {
  const userId = await getCurrentUserId();
  const categories = await prisma.category.findMany({
    where: { userId, ...(kind ? { kind } : {}) },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return categories.map((c) => ({
    id: c.id,
    name: c.name,
    kind: c.kind as CategoryDTO["kind"],
    bucket: c.bucket as CategoryDTO["bucket"],
    icon: c.icon,
    color: c.color,
    sortOrder: c.sortOrder,
  }));
});

/* ------------------------------------------------------------------ */
/* Transactions                                                        */
/* ------------------------------------------------------------------ */

const accountSelect = {
  id: true,
  name: true,
  type: true,
  color: true,
} as const;
const categorySelect = {
  id: true,
  name: true,
  icon: true,
  color: true,
} as const;

export interface TransactionFilters {
  period?: string;
  type?: TransactionType;
  accountId?: string;
  categoryId?: string;
  search?: string;
  take?: number;
}

export const getTransactions = cache(async function getTransactions(
  filters: TransactionFilters = {},
): Promise<TransactionDTO[]> {
  const userId = await getLedgerUserId();
  const { period, type, accountId, categoryId, search, take = 100 } = filters;

  const dateFilter = period ? monthRange(period) : null;

  const rows = await prisma.transaction.findMany({
    where: {
      userId,
      ...(type ? { type } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(accountId ? { OR: [{ accountId }, { toAccountId: accountId }] } : {}),
      ...(dateFilter
        ? { date: { gte: dateFilter.start, lte: dateFilter.end } }
        : {}),
      ...(search
        ? {
            OR: [
              // Postgres LIKE is case-sensitive, so match insensitively.
              { note: { contains: search, mode: "insensitive" as const } },
              { merchant: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take,
    include: {
      account: { select: accountSelect },
      toAccount: { select: accountSelect },
      category: { select: categorySelect },
    },
  });

  return rows.map((t) => ({
    id: t.id,
    type: t.type as TransactionType,
    amount: toNumber(t.amount),
    date: t.date.toISOString(),
    note: t.note,
    merchant: t.merchant,
    paymentMethod: t.paymentMethod as PaymentMethod,
    excludeFromBudget: t.excludeFromBudget,
    account: { ...t.account, type: t.account.type as AccountType },
    toAccount: t.toAccount
      ? { ...t.toAccount, type: t.toAccount.type as AccountType }
      : null,
    category: t.category,
  }));
});

/* ------------------------------------------------------------------ */
/* Month summary                                                       */
/* ------------------------------------------------------------------ */

export const getMonthSummary = cache(async function getMonthSummary(
  period = periodKey(),
): Promise<MonthSummary> {
  const userId = await getLedgerUserId();
  const { start, end } = monthRange(period);

  const grouped = await prisma.transaction.groupBy({
    by: ["type"],
    where: { userId, date: { gte: start, lte: end } },
    _sum: { amount: true },
  });

  const sumOf = (type: TransactionType) =>
    toNumber(grouped.find((g) => g.type === type)?._sum.amount ?? 0n);

  // Transfers are internal movement, so they never count as income or spend.
  const income = sumOf("INCOME");
  const expense = sumOf("EXPENSE");
  const saved = income - expense;

  return {
    period,
    income,
    expense,
    saved,
    savingsRate: income > 0 ? Math.round((saved / income) * 100) : 0,
  };
});

export interface CategorySpend {
  categoryId: string;
  name: string;
  icon: string;
  color: string;
  amount: number;
}

export const getSpendByCategory = cache(async function getSpendByCategory(
  period = periodKey(),
): Promise<CategorySpend[]> {
  const userId = await getLedgerUserId();
  const { start, end } = monthRange(period);

  const grouped = await prisma.transaction.groupBy({
    by: ["categoryId"],
    where: {
      userId,
      type: "EXPENSE",
      excludeFromBudget: false,
      date: { gte: start, lte: end },
      categoryId: { not: null },
    },
    _sum: { amount: true },
  });

  const categories = await prisma.category.findMany({
    where: {
      userId,
      id: { in: grouped.map((g) => g.categoryId!).filter(Boolean) },
    },
    select: categorySelect,
  });
  const byId = new Map(categories.map((c) => [c.id, c]));

  return grouped
    .map((g) => {
      const category = byId.get(g.categoryId!);
      return {
        categoryId: g.categoryId!,
        name: category?.name ?? "Uncategorised",
        icon: category?.icon ?? "circle",
        color: category?.color ?? "#64748b",
        amount: toNumber(g._sum.amount ?? 0n),
      };
    })
    .sort((a, b) => b.amount - a.amount);
});

/* ------------------------------------------------------------------ */
/* Budgets                                                             */
/* ------------------------------------------------------------------ */

export const getBudgets = cache(async function getBudgets(
  period = periodKey(),
): Promise<BudgetDTO[]> {
  const userId = await getLedgerUserId();
  const { start, end } = monthRange(period);

  const [budgets, spendRows] = await Promise.all([
    prisma.budget.findMany({
      where: { userId, period },
      include: { category: true },
      orderBy: { category: { sortOrder: "asc" } },
    }),
    prisma.transaction.groupBy({
      by: ["categoryId"],
      where: {
        userId,
        type: "EXPENSE",
        excludeFromBudget: false,
        date: { gte: start, lte: end },
      },
      _sum: { amount: true },
    }),
  ]);

  const spentByCategory = new Map(
    spendRows
      .filter((r) => r.categoryId)
      .map((r) => [r.categoryId!, toNumber(r._sum.amount ?? 0n)]),
  );

  return budgets.map((b) => {
    const amount = toNumber(b.amount);
    const spent = spentByCategory.get(b.categoryId) ?? 0;
    return {
      id: b.id,
      period: b.period,
      amount,
      spent,
      remaining: amount - spent,
      progress:
        amount > 0 ? Math.min(999, Math.round((spent / amount) * 100)) : 0,
      rollover: b.rollover,
      category: {
        id: b.category.id,
        name: b.category.name,
        kind: b.category.kind as CategoryDTO["kind"],
        bucket: b.category.bucket as CategoryDTO["bucket"],
        icon: b.category.icon,
        color: b.category.color,
        sortOrder: b.category.sortOrder,
      },
    };
  });
});

/* ------------------------------------------------------------------ */
/* Recurring rules & upcoming outflows                                 */
/* ------------------------------------------------------------------ */

export const getRecurringRules = cache(
  async function getRecurringRules(): Promise<RecurringRuleDTO[]> {
    const userId = await getLedgerUserId();
    const rules = await prisma.recurringRule.findMany({
      where: { userId },
      orderBy: [{ isActive: "desc" }, { nextDueDate: "asc" }],
      include: {
        account: { select: { id: true, name: true, color: true } },
        toAccount: { select: { id: true, name: true, color: true } },
        category: { select: categorySelect },
        // Newest payment first so it can be undone.
        transactions: {
          orderBy: { date: "desc" },
          take: 1,
          select: { id: true, date: true, amount: true },
        },
      },
    });

    return rules.map((r) => {
      const posted = r.transactions[0];
      return {
        id: r.id,
        name: r.name,
        type: r.type as TransactionType,
        amount: toNumber(r.amount),
        isVariable: r.isVariable,
        frequency: r.frequency as Frequency,
        interval: r.interval,
        dayOfMonth: r.dayOfMonth,
        weekday: r.weekday,
        monthOfYear: r.monthOfYear,
        nextDueDate: r.nextDueDate.toISOString(),
        autoPost: r.autoPost,
        isBill: r.isBill,
        isActive: r.isActive,
        merchant: r.merchant,
        account: r.account,
        toAccount: r.toAccount,
        category: r.category,
        lastPosted: posted
          ? {
              id: posted.id,
              date: posted.date.toISOString(),
              amount: toNumber(posted.amount),
            }
          : null,
      };
    });
  },
);

/** Every scheduled occurrence between today and `until`, flattened and sorted. */
export const getUpcoming = cache(async function getUpcoming(
  until?: Date,
): Promise<UpcomingItem[]> {
  const userId = await getLedgerUserId();
  const today = startOfDay(new Date());
  const horizon = until ?? endOfMonth(today);

  const rules = await prisma.recurringRule.findMany({
    where: { userId, isActive: true },
    include: {
      account: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
    },
  });

  const items: UpcomingItem[] = [];

  for (const rule of rules) {
    if (rule.endDate && rule.endDate < today) continue;

    const dates = occurrencesBetween(
      {
        frequency: rule.frequency as Frequency,
        interval: rule.interval,
        dayOfMonth: rule.dayOfMonth,
        weekday: rule.weekday,
        monthOfYear: rule.monthOfYear,
      },
      rule.nextDueDate,
      today,
      horizon,
    );

    for (const date of dates) {
      items.push({
        ruleId: rule.id,
        name: rule.name,
        amount: toNumber(rule.amount),
        dueDate: date.toISOString(),
        type: rule.type as TransactionType,
        isVariable: rule.isVariable,
        accountId: rule.accountId,
        accountName: rule.account.name,
        categoryName: rule.category?.name ?? null,
        daysUntil: Math.round((date.getTime() - today.getTime()) / 86_400_000),
      });
    }
  }

  return items.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
});

/* ------------------------------------------------------------------ */
/* Safe to Spend                                                       */
/* ------------------------------------------------------------------ */

/**
 * Safe to Spend = what's left after everything already promised.
 *
 *   liquid balance
 *   − scheduled outflows still due this month
 *   − goal contributions not yet funded this month
 *   = safe total, divided across the days left in the month
 *
 * When budgets exist the result is capped by the remaining budget, so the
 * number never encourages spending past the user's own plan.
 */
export const getSafeToSpend = cache(
  async function getSafeToSpend(): Promise<SafeToSpend> {
    const userId = await getLedgerUserId();
    const today = startOfDay(new Date());
    const monthEnd = endOfMonth(today);
    const period = periodKey(today);

    const [accounts, upcoming, budgets, goals] = await Promise.all([
      getAccounts(),
      getUpcoming(monthEnd),
      getBudgets(period),
      prisma.goal.findMany({
        where: { userId, isArchived: false },
        select: { monthlyContribution: true, accountId: true },
      }),
    ]);

    const liquidAccountIds = new Set(
      accounts
        .filter((a) => a.isLiquid && !isLiability(a.type))
        .map((a) => a.id),
    );

    const liquidBalance = accounts
      .filter((a) => liquidAccountIds.has(a.id))
      .reduce((sum, a) => sum + a.balance, 0);

    // Only count money that actually leaves the liquid pool. A transfer between
    // two liquid accounts moves money without reducing what's spendable.
    const upcomingOutflows = upcoming.reduce((sum, item) => {
      if (item.type === "INCOME") return sum;
      if (!liquidAccountIds.has(item.accountId)) return sum;
      return sum + item.amount;
    }, 0);

    const goalAccountIds = goals
      .map((g) => g.accountId)
      .filter((id): id is string => !!id);
    const plannedTotal = goals.reduce(
      (sum, g) => sum + toNumber(g.monthlyContribution),
      0,
    );

    // Contributions already moved into goal-linked accounts this month.
    const { start } = monthRange(period);
    const fundedRows = goalAccountIds.length
      ? await prisma.transaction.aggregate({
          where: {
            userId,
            type: "TRANSFER",
            toAccountId: { in: goalAccountIds },
            date: { gte: start, lte: monthEnd },
          },
          _sum: { amount: true },
        })
      : null;
    const alreadyFunded = toNumber(fundedRows?._sum.amount ?? 0n);
    const plannedSavings = Math.max(0, plannedTotal - alreadyFunded);

    const remainingBudgeted = budgets.reduce(
      (sum, b) => sum + Math.max(0, b.remaining),
      0,
    );

    const liquidityBased = liquidBalance - upcomingOutflows - plannedSavings;
    const safeTotal =
      remainingBudgeted > 0
        ? Math.min(liquidityBased, remainingBudgeted)
        : liquidityBased;

    const daysRemaining = daysRemainingInMonth(today);

    return {
      liquidBalance,
      upcomingOutflows,
      plannedSavings,
      remainingBudgeted,
      safeTotal,
      perDay: Math.floor(Math.max(0, safeTotal) / daysRemaining),
      daysRemaining,
      isNegative: safeTotal < 0,
    };
  },
);

/* ------------------------------------------------------------------ */
/* Salary Intelligence                                                 */
/* ------------------------------------------------------------------ */

export interface SalaryAllocation {
  bucket: string;
  label: string;
  percent: number;
  amount: number;
  color: string;
}

/** Suggested split of the latest salary credit — the Salary Intelligence tile. */
export const getSalaryIntelligence = cache(
  async function getSalaryIntelligence() {
    const userId = await getLedgerUserId();
    const user = await getCurrentUser();
    const { start, end } = monthRange(periodKey());

    const latestSalary = await prisma.transaction.findFirst({
      where: {
        userId,
        type: "INCOME",
        date: { gte: start, lte: end },
        category: { bucket: "INCOME" },
      },
      orderBy: { amount: "desc" },
      include: { category: { select: { name: true } } },
    });

    const amount = latestSalary
      ? toNumber(latestSalary.amount)
      : toNumber(user.monthlyIncome);
    if (amount <= 0) return null;

    const split: Array<{
      bucket: string;
      label: string;
      percent: number;
      color: string;
    }> = [
      { bucket: "NEEDS", label: "Needs", percent: 45, color: "#2563eb" },
      {
        bucket: "LIFESTYLE",
        label: "Lifestyle",
        percent: 15,
        color: "#ea580c",
      },
      { bucket: "SAVINGS", label: "Savings", percent: 20, color: "#16a34a" },
      {
        bucket: "INVESTMENTS",
        label: "Investments",
        percent: 14,
        color: "#7c3aed",
      },
      { bucket: "EMERGENCY", label: "Emergency", percent: 6, color: "#dc2626" },
    ];

    const allocations: SalaryAllocation[] = split.map((s) => ({
      ...s,
      amount: Math.round((amount * s.percent) / 100),
    }));

    return {
      amount,
      receivedOn: latestSalary?.date.toISOString() ?? null,
      source: latestSalary?.merchant ?? "Expected salary",
      allocations,
    };
  },
);
