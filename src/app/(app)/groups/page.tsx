import Link from "next/link";
import { ChevronRight, Users } from "lucide-react";
import { CreateGroupButton } from "@/components/group-forms";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { getGroups } from "@/lib/groups";
import { formatINRAdaptive, formatINRCompact } from "@/lib/money";

export const metadata = { title: "Groups — FinTrack" };

export default async function GroupsPage() {
  const groups = await getGroups();

  const owedToYou = groups.reduce(
    (sum, g) => sum + Math.max(0, g.yourBalance),
    0,
  );
  const youOwe = groups.reduce(
    (sum, g) => sum + Math.max(0, -g.yourBalance),
    0,
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Groups"
        subtitle="Split bills with friends, flatmates and trips."
        action={<CreateGroupButton />}
      />

      <div className="grid grid-cols-2 gap-3">
        <div className="min-w-0 overflow-hidden rounded-xl border border-emerald-200 bg-emerald-50 p-3.5">
          <p className="truncate text-[11px] font-medium uppercase tracking-wide text-emerald-700">
            You are owed
          </p>
          <p
            title={formatINRCompact(owedToYou)}
            className="tabular mt-1 truncate text-lg font-semibold text-emerald-700 sm:text-xl"
          >
            {formatINRAdaptive(owedToYou)}
          </p>
        </div>
        <div className="min-w-0 overflow-hidden rounded-xl border border-rose-200 bg-rose-50 p-3.5">
          <p className="truncate text-[11px] font-medium uppercase tracking-wide text-rose-700">
            You owe
          </p>
          <p
            title={formatINRCompact(youOwe)}
            className="tabular mt-1 truncate text-lg font-semibold text-rose-700 sm:text-xl"
          >
            {formatINRAdaptive(youOwe)}
          </p>
        </div>
      </div>

      {groups.length === 0 ? (
        <Card>
          <EmptyState
            title="No groups yet"
            description="Create a group, add friends by mobile number and start splitting expenses."
            action={<CreateGroupButton />}
          />
        </Card>
      ) : (
        <Card padded={false}>
          <ul className="divide-y divide-ink-100 p-2">
            {groups.map((g) => {
              const settled = g.yourBalance === 0;
              const owed = g.yourBalance > 0;
              return (
                <li key={g.id}>
                  <Link
                    href={`/groups/${g.id}`}
                    className="flex items-center gap-3 rounded-xl p-3 transition hover:bg-ink-50"
                  >
                    <span
                      aria-hidden
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700"
                    >
                      <Users size={18} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink-900">
                        {g.name}
                      </span>
                      <span className="block truncate text-[11px] text-ink-500">
                        {g.memberCount} member{g.memberCount === 1 ? "" : "s"}
                        {g.pendingCount > 0
                          ? ` · ${g.pendingCount} invited`
                          : ""}
                      </span>
                    </span>
                    <span className="max-w-[40%] shrink-0 text-right">
                      <span
                        title={formatINRCompact(Math.abs(g.yourBalance))}
                        className={
                          settled
                            ? "block truncate text-xs font-medium text-ink-500"
                            : owed
                              ? "tabular block truncate text-sm font-semibold text-emerald-700"
                              : "tabular block truncate text-sm font-semibold text-rose-700"
                        }
                      >
                        {settled
                          ? "Settled up"
                          : formatINRAdaptive(Math.abs(g.yourBalance))}
                      </span>
                      {!settled && (
                        <span className="block text-[11px] text-ink-400">
                          {owed ? "you are owed" : "you owe"}
                        </span>
                      )}
                    </span>
                    <ChevronRight size={16} className="shrink-0 text-ink-400" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
