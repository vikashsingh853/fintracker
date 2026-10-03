import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, HandCoins, Receipt } from "lucide-react";
import {
  ActivityItemButton,
  AddExpenseButton,
  AddMembersButton,
  DeleteGroupButton,
  LeaveGroupButton,
  PendingMemberActions,
  SettleUpButton,
} from "@/components/group-forms";
import { Badge, Card, CardHeader, EmptyState } from "@/components/ui";
import { formatShortDay } from "@/lib/dates";
import { getGroupDetail } from "@/lib/groups";
import { formatINRAdaptive, formatINRCompact } from "@/lib/money";
import { formatPhoneClient } from "@/lib/phone";

export default async function GroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const group = await getGroupDetail(id);
  if (!group) notFound();

  const you = group.members.find((m) => m.isYou)!;
  const activeMembers = group.members.filter((m) => !m.hasLeft);
  const yourDebts = group.debts.filter(
    (d) => d.fromId === you.id || d.toId === you.id,
  );
  const otherDebts = group.debts.filter(
    (d) => d.fromId !== you.id && d.toId !== you.id,
  );

  return (
    <div className="space-y-5">
      <Link
        href="/groups"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-600 transition hover:text-ink-900"
      >
        <ArrowLeft size={14} /> All groups
      </Link>

      <Card>
        <h1 className="truncate text-lg font-semibold tracking-tight text-ink-900">
          {group.name}
        </h1>
        <p className="mt-0.5 text-xs text-ink-500">
          {activeMembers.length} members · {formatINRAdaptive(group.totalSpent)}{" "}
          spent in total
        </p>

        <div
          className={
            you.balance === 0
              ? "mt-4 rounded-xl border border-ink-200 bg-ink-50 p-3.5"
              : you.balance > 0
                ? "mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5"
                : "mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3.5"
          }
        >
          <p
            className={
              you.balance === 0
                ? "text-[11px] font-medium uppercase tracking-wide text-ink-500"
                : you.balance > 0
                  ? "text-[11px] font-medium uppercase tracking-wide text-emerald-700"
                  : "text-[11px] font-medium uppercase tracking-wide text-rose-700"
            }
          >
            {you.balance === 0
              ? "You're settled up"
              : you.balance > 0
                ? "You are owed"
                : "You owe"}
          </p>
          <p
            title={formatINRCompact(Math.abs(you.balance))}
            className={
              you.balance === 0
                ? "tabular mt-0.5 truncate text-xl font-bold text-ink-700"
                : you.balance > 0
                  ? "tabular mt-0.5 truncate text-xl font-bold text-emerald-700"
                  : "tabular mt-0.5 truncate text-xl font-bold text-rose-700"
            }
          >
            {formatINRAdaptive(Math.abs(you.balance))}
          </p>
        </div>

        <div className="mt-4 flex gap-2">
          <AddExpenseButton
            groupId={group.id}
            members={activeMembers}
            youMemberId={group.youMemberId}
          />
          <SettleUpButton
            groupId={group.id}
            members={group.members}
            youMemberId={group.youMemberId}
          />
        </div>
      </Card>

      {group.debts.length > 0 && (
        <Card>
          <CardHeader
            title="Who owes whom"
            subtitle="Simplified to the fewest payments"
          />
          <ul className="divide-y divide-ink-100">
            {[...yourDebts, ...otherDebts].map((d) => {
              const fromName = d.fromId === you.id ? "You" : d.fromName;
              const toName = d.toId === you.id ? "you" : d.toName;
              return (
                <li
                  key={`${d.fromId}-${d.toId}`}
                  className="flex items-center gap-2 py-2.5"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-1.5 text-sm text-ink-800">
                      <span className="truncate font-medium">{fromName}</span>
                      <ArrowRight size={13} className="shrink-0 text-ink-400" />
                      <span className="truncate font-medium">{toName}</span>
                    </span>
                    <span
                      title={formatINRCompact(d.amount)}
                      className="tabular block truncate text-xs font-semibold text-ink-600"
                    >
                      {formatINRAdaptive(d.amount)}
                    </span>
                  </span>
                  <SettleUpButton
                    groupId={group.id}
                    members={group.members}
                    youMemberId={group.youMemberId}
                    debt={d}
                    label="Settle"
                    variant="ghost"
                    className="shrink-0"
                  />
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Members"
          action={
            <AddMembersButton
              groupId={group.id}
              existingPhones={activeMembers.map((m) => m.phone)}
            />
          }
        />
        <ul className="divide-y divide-ink-100">
          {group.members.map((m) => (
            <li key={m.id} className="flex items-center gap-3 py-2.5">
              <span
                aria-hidden
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700"
              >
                {m.name.charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="min-w-0 truncate text-sm font-medium text-ink-900">
                    {m.isYou ? `${m.name} (you)` : m.name}
                  </span>
                  {m.role === "OWNER" && <Badge tone="brand">Owner</Badge>}
                  {m.isPending && <Badge tone="warn">Invited</Badge>}
                  {m.hasLeft && <Badge>Left</Badge>}
                </span>
                <span className="block truncate text-[11px] text-ink-500">
                  {m.phone ? formatPhoneClient(m.phone) : m.email}
                  {m.isPending && m.balance !== 0
                    ? ` · ${m.balance > 0 ? "+" : "−"}${formatINRAdaptive(Math.abs(m.balance))}`
                    : ""}
                </span>
              </span>
              {m.isPending ? (
                <PendingMemberActions memberId={m.id} />
              ) : (
                <span
                  title={formatINRCompact(Math.abs(m.balance))}
                  className={
                    m.balance === 0
                      ? "tabular max-w-[35%] shrink-0 truncate text-right text-xs text-ink-400"
                      : m.balance > 0
                        ? "tabular max-w-[35%] shrink-0 truncate text-right text-xs font-semibold text-emerald-700"
                        : "tabular max-w-[35%] shrink-0 truncate text-right text-xs font-semibold text-rose-700"
                  }
                >
                  {m.balance === 0
                    ? "settled"
                    : `${m.balance > 0 ? "+" : "−"}${formatINRAdaptive(Math.abs(m.balance))}`}
                </span>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <Card padded={false}>
        <div className="px-4 pt-4">
          <CardHeader title="Activity" subtitle="Tap an item for details" />
        </div>
        {group.activity.length === 0 ? (
          <div className="p-4 pt-0">
            <EmptyState
              title="No expenses yet"
              description="Add the first expense and FinTrack works out who owes whom."
            />
          </div>
        ) : (
          <ul className="divide-y divide-ink-100 px-2 pb-2">
            {group.activity.map((item) => (
              <li key={`${item.kind}-${item.id}`}>
                <ActivityItemButton item={item}>
                  <div className="flex items-center gap-3 px-2 py-2.5">
                    <span
                      className={
                        item.kind === "EXPENSE"
                          ? "grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink-100 text-ink-600"
                          : "grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-600"
                      }
                    >
                      {item.kind === "EXPENSE" ? (
                        <Receipt size={16} />
                      ) : (
                        <HandCoins size={16} />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink-900">
                        {item.kind === "EXPENSE"
                          ? item.description
                          : `${item.from.id === you.id ? "You" : item.from.name} paid ${item.to.id === you.id ? "you" : item.to.name}`}
                      </span>
                      <span className="block truncate text-[11px] text-ink-500">
                        {formatShortDay(new Date(item.date))}
                        {item.kind === "EXPENSE"
                          ? ` · ${item.paidBy.id === you.id ? "You" : item.paidBy.name} paid ${formatINRAdaptive(item.amount)}`
                          : ""}
                      </span>
                    </span>
                    <span className="max-w-[40%] shrink-0 text-right">
                      {item.kind === "EXPENSE" ? (
                        item.yourNet === 0 ? (
                          <span className="block text-[11px] text-ink-400">
                            not involved
                          </span>
                        ) : (
                          <>
                            <span
                              className={
                                item.yourNet > 0
                                  ? "tabular block truncate text-sm font-semibold text-emerald-700"
                                  : "tabular block truncate text-sm font-semibold text-rose-700"
                              }
                            >
                              {formatINRAdaptive(Math.abs(item.yourNet))}
                            </span>
                            <span className="block text-[11px] text-ink-400">
                              {item.yourNet > 0 ? "you lent" : "you borrowed"}
                            </span>
                          </>
                        )
                      ) : (
                        <span className="tabular block truncate text-sm font-semibold text-ink-900">
                          {formatINRAdaptive(item.amount)}
                        </span>
                      )}
                    </span>
                  </div>
                </ActivityItemButton>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="flex flex-wrap items-start gap-2">
        <LeaveGroupButton groupId={group.id} name={group.name} />
        {group.isOwner && (
          <DeleteGroupButton groupId={group.id} name={group.name} />
        )}
      </div>
    </div>
  );
}
