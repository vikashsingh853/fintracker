import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight } from "lucide-react";
import { AddPartyButton } from "@/components/khata-forms";
import { PartySearch } from "@/components/party-search";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { formatShortDay } from "@/lib/dates";
import { getKhataSummary, getParties } from "@/lib/khata";
import { formatINRAdaptive, formatINRCompact } from "@/lib/money";
import { formatPhoneClient } from "@/lib/phone";

export const metadata = { title: "Khata — FinTrack" };

export default async function KhataPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim() : "";

  const [parties, summary] = await Promise.all([
    getParties(query || undefined),
    getKhataSummary(),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Khata"
        subtitle="Udhaar you'll collect and udhaar you owe — kept apart from your cash accounts."
        action={<AddPartyButton />}
      />

      <div className="grid grid-cols-2 gap-3">
        <div className="min-w-0 overflow-hidden rounded-xl border border-emerald-200 bg-emerald-50 p-3.5">
          <p className="truncate text-[11px] font-medium uppercase tracking-wide text-emerald-700">
            You will get
          </p>
          <p
            title={formatINRCompact(summary.toGet)}
            className="tabular mt-1 truncate text-lg font-semibold text-emerald-700 sm:text-xl"
          >
            {formatINRAdaptive(summary.toGet)}
          </p>
        </div>
        <div className="min-w-0 overflow-hidden rounded-xl border border-rose-200 bg-rose-50 p-3.5">
          <p className="truncate text-[11px] font-medium uppercase tracking-wide text-rose-700">
            You will give
          </p>
          <p
            title={formatINRCompact(summary.toGive)}
            className="tabular mt-1 truncate text-lg font-semibold text-rose-700 sm:text-xl"
          >
            {formatINRAdaptive(summary.toGive)}
          </p>
        </div>
      </div>

      <Suspense fallback={<div className="h-11" />}>
        <PartySearch />
      </Suspense>

      {parties.length === 0 ? (
        <Card>
          <EmptyState
            title={query ? "No matching contacts" : "Your khata is empty"}
            description={
              query
                ? "Try a different name or number."
                : "Add the people and shops you lend to or borrow from, then record what you gave and got."
            }
            action={query ? undefined : <AddPartyButton />}
          />
        </Card>
      ) : (
        <Card padded={false}>
          <ul className="divide-y divide-ink-100 p-2">
            {parties.map((party) => {
              const settled = party.balance === 0;
              const youGet = party.balance > 0;

              return (
                <li key={party.id}>
                  <Link
                    href={`/khata/${party.id}`}
                    className="flex items-center gap-3 rounded-xl p-3 transition hover:bg-ink-50"
                  >
                    <span
                      aria-hidden
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700"
                    >
                      {party.name.charAt(0).toUpperCase()}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink-900">
                        {party.name}
                      </span>
                      <span className="block truncate text-[11px] text-ink-500">
                        {party.phone
                          ? formatPhoneClient(party.phone)
                          : party.entryCount === 0
                            ? "No entries yet"
                            : `${party.entryCount} entr${party.entryCount === 1 ? "y" : "ies"}`}
                        {party.lastActivity
                          ? ` · ${formatShortDay(new Date(party.lastActivity))}`
                          : ""}
                      </span>
                    </span>

                    <span className="max-w-[40%] shrink-0 text-right">
                      <span
                        title={formatINRCompact(Math.abs(party.balance))}
                        className={
                          settled
                            ? "tabular block truncate text-sm font-semibold text-ink-500"
                            : youGet
                              ? "tabular block truncate text-sm font-semibold text-emerald-700"
                              : "tabular block truncate text-sm font-semibold text-rose-700"
                        }
                      >
                        {formatINRAdaptive(Math.abs(party.balance))}
                      </span>
                      <span className="block text-[11px] text-ink-400">
                        {settled ? "settled" : youGet ? "you will get" : "you will give"}
                      </span>
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
