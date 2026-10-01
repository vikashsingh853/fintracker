import {
  AddBudgetButton,
  CopyBudgetsButton,
  EditBudgetButton,
} from "@/components/budget-form";
import { MonthSwitcher } from "@/components/month-switcher";
import { QuickAdd } from "@/components/quick-add";
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  Progress,
  StatTile,
} from "@/components/ui";
import {
  daysElapsedInMonth,
  daysRemainingInMonth,
  periodKey,
} from "@/lib/dates";
import { formatINRAdaptive, formatINRCompact } from "@/lib/money";
import {
  getAccounts,
  getBudgets,
  getCategories,
  getSpendByCategory,
} from "@/lib/queries";

export default async function BudgetsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const period =
    typeof params.period === "string" && /^\d{4}-\d{2}$/.test(params.period)
      ? params.period
      : periodKey();

  const [budgets, allCategories, accounts, spend] = await Promise.all([
    getBudgets(period),
    getCategories(),
    getAccounts(),
    getSpendByCategory(period),
  ]);

  const categories = allCategories.filter((c) => c.kind === "EXPENSE");

  const totalBudget = budgets.reduce((sum, b) => sum + b.amount, 0);
  const totalSpent = budgets.reduce((sum, b) => sum + b.spent, 0);
  const totalRemaining = totalBudget - totalSpent;
  const overallProgress =
    totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

  const isCurrentMonth = period === periodKey();
  const elapsed = daysElapsedInMonth();
  const remainingDays = daysRemainingInMonth();
  const daysInMonth = elapsed + remainingDays - 1;
  // A month is "on pace" when spend tracks the fraction of days elapsed.
  const expectedPace = isCurrentMonth
    ? Math.round((elapsed / daysInMonth) * 100)
    : 100;

  const budgetedCategoryIds = new Set(budgets.map((b) => b.category.id));
  const unbudgeted = spend.filter(
    (s) => !budgetedCategoryIds.has(s.categoryId),
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Budgets"
        subtitle="Monthly limits per category. These sharpen your Safe to Spend number."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <MonthSwitcher basePath="/budgets" period={period} />
            <AddBudgetButton period={period} categories={categories} />
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Budgeted"
          value={formatINRAdaptive(totalBudget)}
          exact={formatINRCompact(totalBudget)}
        />
        <StatTile
          label="Spent"
          value={formatINRAdaptive(totalSpent)}
          exact={formatINRCompact(totalSpent)}
          tone="out"
        />
        <StatTile
          label="Remaining"
          value={formatINRAdaptive(totalRemaining)}
          exact={formatINRCompact(totalRemaining)}
          tone={totalRemaining >= 0 ? "in" : "out"}
        />
        <StatTile
          label="Used"
          value={`${overallProgress}%`}
          hint={
            isCurrentMonth ? `${expectedPace}% of the month gone` : undefined
          }
        />
      </div>

      {budgets.length === 0 ? (
        <Card>
          <EmptyState
            title={`No budgets for this month`}
            description="Set limits per category, or carry forward the ones you used last month."
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <AddBudgetButton period={period} categories={categories} />
                <CopyBudgetsButton period={period} />
              </div>
            }
          />
        </Card>
      ) : (
        <Card padded={false}>
          <div className="px-4 pt-4">
            <CardHeader
              title="Category budgets"
              subtitle={
                isCurrentMonth
                  ? `${remainingDays} day${remainingDays === 1 ? "" : "s"} left this month`
                  : "Closed month"
              }
              action={<CopyBudgetsButton period={period} />}
            />
          </div>

          <ul className="divide-y divide-ink-100 px-2 pb-2">
            {budgets.map((budget) => {
              const over = budget.remaining < 0;
              // Ahead of pace means spending faster than days elapsed.
              const aheadOfPace =
                isCurrentMonth && !over && budget.progress > expectedPace + 10;

              return (
                <li key={budget.id}>
                  <EditBudgetButton budget={budget} categories={categories}>
                    <div className="mb-2 flex items-baseline justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-ink-900">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: budget.category.color }}
                          aria-hidden
                        />
                        <span className="truncate">{budget.category.name}</span>
                        {over && <Badge tone="bad">Over</Badge>}
                        {aheadOfPace && <Badge tone="warn">Fast</Badge>}
                      </span>
                      <span
                        title={`${formatINRCompact(budget.spent)} of ${formatINRCompact(budget.amount)}`}
                        className="tabular shrink-0 text-xs text-ink-600"
                      >
                        {formatINRAdaptive(budget.spent)}
                        <span className="text-ink-400">
                          {" "}
                          / {formatINRAdaptive(budget.amount)}
                        </span>
                      </span>
                    </div>

                    <Progress
                      value={budget.progress}
                      tone={over ? "bad" : aheadOfPace ? "warn" : "good"}
                    />

                    <p className="mt-1.5 text-[11px] text-ink-500">
                      {over
                        ? `${formatINRAdaptive(Math.abs(budget.remaining))} over budget`
                        : `${formatINRAdaptive(budget.remaining)} left`}
                      {isCurrentMonth && !over && remainingDays > 0
                        ? ` · ${formatINRAdaptive(Math.floor(budget.remaining / remainingDays))}/day`
                        : ""}
                    </p>
                  </EditBudgetButton>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {unbudgeted.length > 0 && (
        <Card>
          <CardHeader
            title="Unbudgeted spending"
            subtitle="Categories you spent on without a limit set"
          />
          <ul className="divide-y divide-ink-100">
            {unbudgeted.map((s) => (
              <li
                key={s.categoryId}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <span className="flex min-w-0 items-center gap-2 text-sm text-ink-800">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: s.color }}
                    aria-hidden
                  />
                  <span className="truncate">{s.name}</span>
                </span>
                <span
                  title={formatINRCompact(s.amount)}
                  className="tabular shrink-0 text-sm font-medium text-ink-900"
                >
                  {formatINRAdaptive(s.amount)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <QuickAdd accounts={accounts} categories={allCategories} />
    </div>
  );
}
