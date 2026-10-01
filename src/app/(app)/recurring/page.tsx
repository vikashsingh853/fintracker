import { QuickAdd } from "@/components/quick-add";
import {
  AddRecurringButton,
  EditRecurringButton,
  MarkPaidButton,
  MarkUnpaidButton,
  ToggleRecurringButton,
} from "@/components/recurring-form";
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  StatTile,
} from "@/components/ui";
import { formatDay, formatShortDay } from "@/lib/dates";
import { formatINRAdaptive, formatINRCompact } from "@/lib/money";
import {
  getAccounts,
  getCategories,
  getRecurringRules,
  getUpcoming,
} from "@/lib/queries";
import { FREQUENCY_LABELS } from "@/lib/types";

export default async function RecurringPage() {
  const [rules, accounts, categories, upcoming] = await Promise.all([
    getRecurringRules(),
    getAccounts(),
    getCategories(),
    getUpcoming(),
  ]);

  const active = rules.filter((r) => r.isActive);
  const paused = rules.filter((r) => !r.isActive);

  const monthlyOutflow = active
    .filter((r) => r.type !== "INCOME" && r.frequency === "MONTHLY")
    .reduce((sum, r) => sum + r.amount, 0);

  const subscriptions = active.filter((r) => r.isBill && r.type === "EXPENSE");
  const dueThisWeek = upcoming.filter(
    (u) => u.daysUntil <= 7 && u.type !== "INCOME",
  );
  const dueTotal = dueThisWeek.reduce((sum, u) => sum + u.amount, 0);

  // A rule is actionable once its due date has arrived.
  const dueNow = active.filter((r) => new Date(r.nextDueDate) <= new Date());
  // Bills already recorded, newest first — these can be undone.
  const recentlyPaid = rules
    .filter((r) => r.lastPosted)
    .sort((a, b) => b.lastPosted!.date.localeCompare(a.lastPosted!.date))
    .slice(0, 6);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Bills & Recurring"
        subtitle="Everything that repeats — this is what powers Safe to Spend."
        action={
          <AddRecurringButton accounts={accounts} categories={categories} />
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Monthly commitments"
          value={formatINRAdaptive(monthlyOutflow)}
          exact={formatINRCompact(monthlyOutflow)}
          tone="out"
        />
        <StatTile
          label="Due this week"
          value={formatINRAdaptive(dueTotal)}
          exact={formatINRCompact(dueTotal)}
        />
        <StatTile label="Active rules" value={String(active.length)} />
        <StatTile label="Subscriptions" value={String(subscriptions.length)} />
      </div>

      {dueNow.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/60">
          <CardHeader
            title="Ready to record"
            subtitle="These are due now — recording adds them to your ledger."
          />
          <ul className="space-y-2">
            {dueNow.map((rule) => (
              <li
                key={rule.id}
                className="flex flex-wrap items-center gap-2 rounded-xl bg-surface p-3"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink-900">
                    {rule.name}
                  </span>
                  <span className="block text-[11px] text-ink-500">
                    Due {formatShortDay(new Date(rule.nextDueDate))} ·{" "}
                    {rule.account.name}
                  </span>
                </span>
                <span
                  title={formatINRCompact(rule.amount)}
                  className="tabular max-w-[40%] shrink-0 truncate text-sm font-semibold text-ink-900"
                >
                  {formatINRAdaptive(rule.amount)}
                  {rule.isVariable && (
                    <span className="text-[11px] text-ink-400"> approx</span>
                  )}
                </span>
                <MarkPaidButton rule={rule} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      {recentlyPaid.length > 0 && (
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardHeader
            title="Recently paid"
            subtitle="Recorded a payment by mistake? Mark it unpaid to reverse it."
          />
          <ul className="space-y-2">
            {recentlyPaid.map((rule) => (
              <li
                key={rule.id}
                className="flex flex-wrap items-center gap-2 rounded-xl bg-surface p-3"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-ink-900">
                      {rule.name}
                    </span>
                    <Badge tone="good">Paid</Badge>
                  </span>
                  <span className="block truncate text-[11px] text-ink-500">
                    {formatINRAdaptive(rule.lastPosted!.amount)} on{" "}
                    {formatShortDay(new Date(rule.lastPosted!.date))} ·{" "}
                    {rule.account.name}
                  </span>
                </span>
                <MarkUnpaidButton rule={rule} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Upcoming this month"
          subtitle={
            upcoming.length > 0
              ? `${upcoming.length} scheduled movement${upcoming.length === 1 ? "" : "s"}`
              : "Nothing scheduled"
          }
        />
        {upcoming.length === 0 ? (
          <EmptyState
            title="No upcoming payments"
            description="Add your rent, subscriptions and SIPs so FinTrack can forecast your month."
          />
        ) : (
          <ul className="divide-y divide-ink-100">
            {upcoming.map((item) => (
              <li
                key={`${item.ruleId}-${item.dueDate}`}
                className="flex items-center gap-3 py-2.5"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink-100 text-[11px] font-semibold text-ink-600">
                  {new Date(item.dueDate).getDate()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink-900">
                    {item.name}
                  </span>
                  <span className="block truncate text-[11px] text-ink-500">
                    {formatDay(new Date(item.dueDate))} · {item.accountName}
                  </span>
                </span>
                <span
                  title={formatINRCompact(item.amount)}
                  className={
                    item.type === "INCOME"
                      ? "tabular max-w-[40%] shrink-0 truncate text-sm font-semibold text-money-in"
                      : "tabular max-w-[40%] shrink-0 truncate text-sm font-semibold text-ink-900"
                  }
                >
                  {item.type === "INCOME" ? "+" : "−"}
                  {formatINRAdaptive(item.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card padded={false}>
        <div className="px-4 pt-4">
          <CardHeader
            title="All recurring items"
            subtitle="Tap to edit any rule"
          />
        </div>

        {rules.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No recurring items yet"
              description="Add rent, Netflix, Jio, SIPs and EMIs to see what's coming."
              action={
                <AddRecurringButton
                  accounts={accounts}
                  categories={categories}
                />
              }
            />
          </div>
        ) : (
          <ul className="divide-y divide-ink-100 p-2">
            {[...active, ...paused].map((rule) => (
              <li
                key={rule.id}
                className="flex items-center gap-1 py-1 sm:gap-2"
              >
                <EditRecurringButton
                  rule={rule}
                  accounts={accounts}
                  categories={categories}
                >
                  <div className="flex items-center gap-2.5 p-2 sm:gap-3">
                    <span
                      className="h-9 w-1 shrink-0 rounded-full"
                      style={{
                        backgroundColor:
                          rule.category?.color ?? rule.account.color,
                      }}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="min-w-0 truncate text-sm font-medium text-ink-900">
                          {rule.name}
                        </span>
                        {rule.autoPost && <Badge tone="brand">Auto</Badge>}
                        {rule.isVariable && (
                          <Badge tone="neutral">Variable</Badge>
                        )}
                        {!rule.isActive && <Badge tone="neutral">Paused</Badge>}
                      </span>
                      <span className="block truncate text-[11px] text-ink-500">
                        {FREQUENCY_LABELS[rule.frequency]} · next{" "}
                        {formatShortDay(new Date(rule.nextDueDate))} ·{" "}
                        {rule.category?.name ?? "Transfer"}
                      </span>
                    </span>
                    <span
                      title={formatINRCompact(rule.amount)}
                      className="tabular max-w-[35%] shrink-0 truncate text-sm font-semibold text-ink-900"
                    >
                      {formatINRAdaptive(rule.amount)}
                    </span>
                  </div>
                </EditRecurringButton>
                <span className="flex shrink-0 items-center gap-1">
                  <MarkUnpaidButton rule={rule} compact />
                  <ToggleRecurringButton rule={rule} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <QuickAdd accounts={accounts} categories={categories} />
    </div>
  );
}
