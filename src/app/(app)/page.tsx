import Link from "next/link";
import { differenceInCalendarDays } from "date-fns";
import { ArrowRight, BookUser, CalendarClock } from "lucide-react";
import {
  InsightList,
  SafeToSpendHero,
  SalaryCard,
} from "@/components/dashboard";
import { QuickAdd } from "@/components/quick-add";
import { TransactionRow } from "@/components/transaction-row";
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  Progress,
  StatTile,
} from "@/components/ui";
import { formatShortDay, periodKey, periodLabel } from "@/lib/dates";
import { getInsights } from "@/lib/insights";
import { getDueKhataEntries, getKhataSummary } from "@/lib/khata";
import { formatINRAdaptive, formatINRCompact } from "@/lib/money";
import {
  computeNetWorth,
  getAccounts,
  getBudgets,
  getCategories,
  getMonthSummary,
  getSafeToSpend,
  getSalaryIntelligence,
  getTransactions,
  getUpcoming,
} from "@/lib/queries";
import { getCurrentUser } from "@/lib/session";

export default async function DashboardPage() {
  const period = periodKey();

  const [
    user,
    accounts,
    categories,
    summary,
    safe,
    insights,
    salary,
    upcoming,
    transactions,
    budgets,
    khataDue,
    khata,
  ] = await Promise.all([
    getCurrentUser(),
    getAccounts(),
    getCategories(),
    getMonthSummary(period),
    getSafeToSpend(),
    getInsights(),
    getSalaryIntelligence(),
    getUpcoming(),
    getTransactions({ take: 6 }),
    getBudgets(period),
    getDueKhataEntries(5),
    getKhataSummary(),
  ]);

  const netWorth = computeNetWorth(accounts);
  const billsThisWeek = upcoming.filter(
    (u) => u.daysUntil <= 7 && u.type !== "INCOME",
  );
  const topBudgets = [...budgets]
    .sort((a, b) => b.progress - a.progress)
    .slice(0, 4);
  const today = new Date();

  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs font-medium uppercase tracking-wide text-ink-500">
          {periodLabel(period)}
        </p>
        <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-ink-900 sm:text-2xl">
          Dashboard
        </h1>
      </header>

      <SafeToSpendHero safe={safe} name={user.name} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Total balance"
          value={formatINRAdaptive(netWorth.liquid)}
          exact={formatINRCompact(netWorth.liquid)}
          hint="Across bank, cash & wallets"
        />
        <StatTile
          label="Income"
          value={formatINRAdaptive(summary.income)}
          exact={formatINRCompact(summary.income)}
          hint="This month"
          tone="in"
        />
        <StatTile
          label="Spent"
          value={formatINRAdaptive(summary.expense)}
          exact={formatINRCompact(summary.expense)}
          hint="This month"
          tone="out"
        />
        <StatTile
          label="Saved"
          value={formatINRAdaptive(summary.saved)}
          exact={formatINRCompact(summary.saved)}
          hint={`${summary.savingsRate}% of income`}
          tone={summary.saved >= 0 ? "in" : "out"}
        />
      </div>

      <InsightList insights={insights} />

      <Card>
        <CardHeader
          title="Khata"
          subtitle={
            khataDue.length > 0
              ? `${khataDue.length} due payment${khataDue.length === 1 ? "" : "s"}`
              : khata.partyCount > 0
                ? "Nothing due"
                : "Track udhaar you give and take"
          }
          action={
            <Link
              href="/khata"
              className="shrink-0 text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              View all
            </Link>
          }
        />

        {khata.partyCount === 0 ? (
          <EmptyState
            title="No khata yet"
            description="Add the people and shops you lend to or borrow from."
            action={
              <Link
                href="/khata"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700"
              >
                <BookUser size={14} /> Open khata
              </Link>
            }
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="min-w-0 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                <p className="truncate text-[11px] font-medium uppercase tracking-wide text-emerald-700">
                  You will get
                </p>
                <p
                  title={formatINRCompact(khata.toGet)}
                  className="tabular mt-0.5 truncate text-base font-semibold text-emerald-700 sm:text-lg"
                >
                  {formatINRAdaptive(khata.toGet)}
                </p>
              </div>
              <div className="min-w-0 rounded-xl border border-rose-200 bg-rose-50 p-3">
                <p className="truncate text-[11px] font-medium uppercase tracking-wide text-rose-700">
                  You will give
                </p>
                <p
                  title={formatINRCompact(khata.toGive)}
                  className="tabular mt-0.5 truncate text-base font-semibold text-rose-700 sm:text-lg"
                >
                  {formatINRAdaptive(khata.toGive)}
                </p>
              </div>
            </div>

            {khataDue.length > 0 && (
              <ul className="mt-3 divide-y divide-ink-100">
                {khataDue.map((item) => {
                  const youGet = item.type === "GAVE";
                  const days = differenceInCalendarDays(
                    new Date(item.dueDate),
                    today,
                  );
                  const dueLabel =
                    days < 0
                      ? `Overdue ${-days} day${days === -1 ? "" : "s"}`
                      : days === 0
                        ? "Due today"
                        : days === 1
                          ? "Due tomorrow"
                          : `Due ${formatShortDay(new Date(item.dueDate))}`;
                  return (
                    <li key={item.entryId}>
                      <Link
                        href={`/khata/${item.partyId}`}
                        className="flex items-center gap-3 py-2.5 transition hover:opacity-80"
                      >
                        <span
                          aria-hidden
                          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700"
                        >
                          {item.partyName.charAt(0).toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-ink-900">
                            {item.partyName}
                          </span>
                          <span
                            className={
                              days < 0
                                ? "block truncate text-[11px] font-medium text-rose-600"
                                : "block truncate text-[11px] text-ink-500"
                            }
                          >
                            {dueLabel}
                          </span>
                        </span>
                        <span className="max-w-[45%] shrink-0 text-right">
                          <span
                            title={formatINRCompact(item.amount)}
                            className={
                              youGet
                                ? "tabular block truncate text-sm font-semibold text-emerald-700"
                                : "tabular block truncate text-sm font-semibold text-rose-700"
                            }
                          >
                            {formatINRAdaptive(item.amount)}
                          </span>
                          <span className="block text-[11px] text-ink-400">
                            {youGet ? "to get" : "to give"}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {salary && <SalaryCard salary={salary} />}

        <Card>
          <CardHeader
            title="Upcoming payments"
            subtitle={
              billsThisWeek.length > 0
                ? `${billsThisWeek.length} due in the next 7 days`
                : "Nothing due in the next 7 days"
            }
            action={<CalendarClock size={16} className="text-ink-400" />}
          />

          {upcoming.length === 0 ? (
            <EmptyState
              title="No scheduled payments"
              description="Add recurring bills and subscriptions to see what's coming and keep Safe to Spend accurate."
            />
          ) : (
            <ul className="divide-y divide-ink-100">
              {upcoming.slice(0, 6).map((item) => (
                <li
                  key={`${item.ruleId}-${item.dueDate}`}
                  className="flex items-center gap-3 py-2.5"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink-100 text-[11px] font-semibold text-ink-600">
                    {formatShortDay(new Date(item.dueDate)).split(" ")[0]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink-900">
                      {item.name}
                    </span>
                    <span className="block truncate text-[11px] text-ink-500">
                      {item.categoryName ?? "Transfer"} · {item.accountName}
                    </span>
                  </span>
                  <span className="max-w-[40%] shrink-0 text-right">
                    <span
                      title={formatINRCompact(item.amount)}
                      className="tabular block truncate text-sm font-semibold text-ink-900"
                    >
                      {item.type === "INCOME" ? "+" : "−"}
                      {formatINRAdaptive(item.amount)}
                    </span>
                    <span className="block text-[11px] text-ink-400">
                      {item.daysUntil === 0
                        ? "Today"
                        : item.daysUntil === 1
                          ? "Tomorrow"
                          : `in ${item.daysUntil} days`}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}

          <Link
            href="/recurring"
            className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
          >
            Manage bills <ArrowRight size={13} />
          </Link>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Budget pace"
            subtitle="Where you stand this month"
            action={
              <Link
                href="/budgets"
                className="text-xs font-medium text-brand-600 hover:text-brand-700"
              >
                View all
              </Link>
            }
          />

          {topBudgets.length === 0 ? (
            <EmptyState
              title="No budgets yet"
              description="Set monthly limits per category to sharpen your Safe to Spend number."
            />
          ) : (
            <ul className="space-y-3.5">
              {topBudgets.map((b) => {
                const over = b.remaining < 0;
                return (
                  <li key={b.id}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2 text-sm text-ink-800">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: b.category.color }}
                          aria-hidden
                        />
                        <span className="truncate">{b.category.name}</span>
                      </span>
                      <span className="tabular shrink-0 text-xs text-ink-600">
                        {formatINRAdaptive(b.spent)}{" "}
                        <span className="text-ink-400">
                          / {formatINRAdaptive(b.amount)}
                        </span>
                      </span>
                    </div>
                    <Progress
                      value={b.progress}
                      tone={over ? "bad" : b.progress > 80 ? "warn" : "good"}
                    />
                    {over && (
                      <p className="mt-1 text-[11px] text-rose-600">
                        {formatINRAdaptive(Math.abs(b.remaining))} over budget
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Recent activity"
            action={
              <Link
                href="/transactions"
                className="text-xs font-medium text-brand-600 hover:text-brand-700"
              >
                View all
              </Link>
            }
          />

          {transactions.length === 0 ? (
            <EmptyState
              title="No transactions yet"
              description="Tap the + button to log your first expense, income or transfer."
            />
          ) : (
            <ul className="divide-y divide-ink-100">
              {transactions.map((t) => (
                <li key={t.id}>
                  <TransactionRow transaction={t} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader title="Net worth" subtitle="Assets minus what you owe" />
        <p
          title={formatINRCompact(netWorth.netWorth)}
          className="tabular truncate text-xl font-bold text-ink-900 sm:text-2xl"
        >
          {formatINRAdaptive(netWorth.netWorth)}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge tone="neutral">
            Liquid {formatINRAdaptive(netWorth.liquid)}
          </Badge>
          <Badge tone="brand">
            Investments {formatINRAdaptive(netWorth.investments)}
          </Badge>
          {netWorth.liabilities > 0 && (
            <Badge tone="bad">
              Owed {formatINRAdaptive(netWorth.liabilities)}
            </Badge>
          )}
        </div>
      </Card>

      <QuickAdd accounts={accounts} categories={categories} />
    </div>
  );
}
