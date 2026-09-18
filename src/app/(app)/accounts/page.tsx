import {
  Banknote,
  CreditCard,
  Landmark,
  PiggyBank,
  Smartphone,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { AddAccountButton, EditAccountButton } from "@/components/account-form";
import { QuickAdd } from "@/components/quick-add";
import { Badge, Card, EmptyState, PageHeader, Progress, StatTile } from "@/components/ui";
import { formatINRAdaptive, formatINRCompact } from "@/lib/money";
import { computeNetWorth, getAccounts, getCategories } from "@/lib/queries";
import { ACCOUNT_TYPE_LABELS, isLiability, type AccountType } from "@/lib/types";

const ICONS: Record<AccountType, typeof Wallet> = {
  BANK: Landmark,
  CASH: Banknote,
  CREDIT_CARD: CreditCard,
  WALLET: Smartphone,
  INVESTMENT: TrendingUp,
  LOAN: PiggyBank,
};

export default async function AccountsPage() {
  const [accounts, categories] = await Promise.all([getAccounts(true), getCategories()]);

  const active = accounts.filter((a) => !a.isArchived);
  const archived = accounts.filter((a) => a.isArchived);
  const netWorth = computeNetWorth(active);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Accounts"
        subtitle="Every place your money sits — balances are derived from your ledger."
        action={<AddAccountButton />}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Net worth"
          value={formatINRAdaptive(netWorth.netWorth)}
          exact={formatINRCompact(netWorth.netWorth)}
        />
        <StatTile
          label="Liquid"
          value={formatINRAdaptive(netWorth.liquid)}
          exact={formatINRCompact(netWorth.liquid)}
          tone="in"
        />
        <StatTile
          label="Investments"
          value={formatINRAdaptive(netWorth.investments)}
          exact={formatINRCompact(netWorth.investments)}
        />
        <StatTile
          label="Owed"
          value={formatINRAdaptive(netWorth.liabilities)}
          exact={formatINRCompact(netWorth.liabilities)}
          tone={netWorth.liabilities > 0 ? "out" : "neutral"}
        />
      </div>

      {active.length === 0 ? (
        <Card>
          <EmptyState
            title="No accounts yet"
            description="Add your bank account, cash and UPI wallet to start tracking."
            action={<AddAccountButton />}
          />
        </Card>
      ) : (
        <Card padded={false}>
          <ul className="divide-y divide-ink-100 p-2">
            {active.map((account) => {
              const Icon = ICONS[account.type] ?? Wallet;
              const liability = isLiability(account.type);
              // Credit cards carry a negative balance; show the amount owed.
              const outstanding = liability ? Math.max(0, -account.balance) : 0;
              const utilisation =
                account.creditLimit && account.creditLimit > 0
                  ? Math.round((outstanding / account.creditLimit) * 100)
                  : null;

              return (
                <li key={account.id}>
                  <EditAccountButton account={account}>
                    <div className="flex items-center gap-3 p-3">
                      <span
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white"
                        style={{ backgroundColor: account.color }}
                      >
                        <Icon size={18} strokeWidth={2} />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink-900">
                          {account.name}
                        </span>
                        <span className="block text-[11px] text-ink-500">
                          {ACCOUNT_TYPE_LABELS[account.type]}
                          {account.dueDay ? ` · due on ${account.dueDay}` : ""}
                        </span>
                        {utilisation !== null && account.creditLimit && (
                          <span className="mt-1.5 block max-w-[220px]">
                            <Progress
                              value={utilisation}
                              tone={utilisation > 70 ? "bad" : utilisation > 40 ? "warn" : "good"}
                              className="h-1.5"
                            />
                            <span className="mt-1 block text-[10px] text-ink-500">
                              {utilisation}% of {formatINRAdaptive(account.creditLimit)} limit
                            </span>
                          </span>
                        )}
                      </span>

                      <span className="max-w-[42%] shrink-0 text-right">
                        <span
                          title={formatINRCompact(liability ? outstanding : account.balance)}
                          className="tabular block truncate text-sm font-semibold text-ink-900"
                        >
                          {liability
                            ? formatINRAdaptive(outstanding)
                            : formatINRAdaptive(account.balance)}
                        </span>
                        <span className="block truncate text-[11px] text-ink-400">
                          {liability ? "outstanding" : account.isLiquid ? "available" : "value"}
                        </span>
                      </span>
                    </div>
                  </EditAccountButton>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {archived.length > 0 && (
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-ink-900">Archived</h2>
          <ul className="space-y-2">
            {archived.map((account) => (
              <li key={account.id}>
                <EditAccountButton account={account}>
                  <div className="flex items-center justify-between gap-3 p-2.5">
                    <span className="text-sm text-ink-600">{account.name}</span>
                    <Badge tone="neutral">{formatINRAdaptive(account.balance)}</Badge>
                  </div>
                </EditAccountButton>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <QuickAdd accounts={active} categories={categories} />
    </div>
  );
}
