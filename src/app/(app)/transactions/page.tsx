import { Suspense } from "react";
import { QuickAdd, EditTransaction } from "@/components/quick-add";
import { TransactionFilters } from "@/components/transaction-filters";
import { TransactionRow } from "@/components/transaction-row";
import { Card, EmptyState, PageHeader, StatTile } from "@/components/ui";
import { formatDay, periodKey, periodLabel, shiftPeriod } from "@/lib/dates";
import { formatINRAdaptive, formatINRCompact } from "@/lib/money";
import { getAccounts, getCategories, getMonthSummary, getTransactions } from "@/lib/queries";
import type { TransactionType } from "@/lib/types";

function buildPeriods(count = 12) {
  const current = periodKey();
  return Array.from({ length: count }, (_, i) => {
    const value = shiftPeriod(current, -i);
    return { value, label: periodLabel(value) };
  });
}

/** Groups a flat list into date-headed sections, newest first. */
function groupByDay<T extends { date: string }>(items: T[]) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = item.date.slice(0, 10);
    const bucket = groups.get(key);
    if (bucket) bucket.push(item);
    else groups.set(key, [item]);
  }
  return [...groups.entries()];
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const asString = (value: string | string[] | undefined) =>
    typeof value === "string" && value ? value : undefined;

  const period = asString(params.period) ?? periodKey();
  const type = asString(params.type) as TransactionType | undefined;
  const accountId = asString(params.accountId);
  const categoryId = asString(params.categoryId);

  const [accounts, categories, transactions, summary] = await Promise.all([
    getAccounts(),
    getCategories(),
    getTransactions({ period, type, accountId, categoryId, take: 300 }),
    getMonthSummary(period),
  ]);

  const grouped = groupByDay(transactions);
  const filtered = Boolean(type || accountId || categoryId);

  return (
    <div className="space-y-5">
      <PageHeader title="Activity" subtitle="Every rupee in and out, grouped by day." />

      <div className="grid grid-cols-3 gap-3">
        <StatTile
          label="Income"
          value={formatINRAdaptive(summary.income)}
          exact={formatINRCompact(summary.income)}
          tone="in"
        />
        <StatTile
          label="Spent"
          value={formatINRAdaptive(summary.expense)}
          exact={formatINRCompact(summary.expense)}
          tone="out"
        />
        <StatTile
          label="Saved"
          value={formatINRAdaptive(summary.saved)}
          exact={formatINRCompact(summary.saved)}
          tone={summary.saved >= 0 ? "in" : "out"}
        />
      </div>

      <Suspense fallback={<div className="h-24" />}>
        <TransactionFilters
          accounts={accounts}
          categories={categories}
          periods={buildPeriods()}
        />
      </Suspense>

      {transactions.length === 0 ? (
        <Card>
          <EmptyState
            title={filtered ? "No matching transactions" : "Nothing logged this month"}
            description={
              filtered
                ? "Try widening your filters or picking a different month."
                : "Tap the + button to record your first expense, income or transfer."
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {grouped.map(([day, items]) => {
            const dayTotal = items.reduce((sum, t) => {
              if (t.type === "EXPENSE") return sum - t.amount;
              if (t.type === "INCOME") return sum + t.amount;
              return sum;
            }, 0);

            return (
              <Card key={day} padded={false}>
                <header className="flex items-baseline justify-between gap-2 border-b border-ink-100 px-4 py-2.5">
                  <h2 className="truncate text-xs font-semibold text-ink-700">
                    {formatDay(new Date(`${day}T12:00:00`))}
                  </h2>
                  <span
                    title={formatINRCompact(Math.abs(dayTotal))}
                    className={
                      dayTotal >= 0
                        ? "tabular shrink-0 text-xs font-medium text-money-in"
                        : "tabular shrink-0 text-xs font-medium text-ink-500"
                    }
                  >
                    {dayTotal >= 0 ? "+" : "−"}
                    {formatINRAdaptive(Math.abs(dayTotal))}
                  </span>
                </header>

                <ul className="divide-y divide-ink-100 p-2">
                  {items.map((t) => (
                    <li key={t.id}>
                      <EditTransaction
                        transaction={t}
                        accounts={accounts}
                        categories={categories}
                      >
                        <TransactionRow transaction={t} />
                      </EditTransaction>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      )}

      <QuickAdd accounts={accounts} categories={categories} />
    </div>
  );
}
