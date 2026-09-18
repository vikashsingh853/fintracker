import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Phone } from "lucide-react";
import {
  EditEntryButton,
  EditPartyButton,
  EntryActions,
  SettleButton,
} from "@/components/khata-forms";
import { Card, EmptyState } from "@/components/ui";
import { formatDay } from "@/lib/dates";
import { getPartyDetail } from "@/lib/khata";
import { formatINRAdaptive, formatINRCompact } from "@/lib/money";
import { formatPhoneClient } from "@/lib/phone";
import { PARTY_TYPE_LABELS } from "@/lib/types";

export default async function PartyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getPartyDetail(id);
  if (!detail) notFound();

  const { party, entries } = detail;
  const settled = party.balance === 0;
  const youGet = party.balance > 0;

  return (
    // Extra bottom padding clears the fixed You gave / You got bar on mobile.
    <div className="space-y-5 pb-24 md:pb-0">
      <Link
        href="/khata"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-600 transition hover:text-ink-900"
      >
        <ArrowLeft size={14} /> All khata
      </Link>

      <Card>
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-50 text-base font-semibold text-brand-700"
          >
            {party.name.charAt(0).toUpperCase()}
          </span>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold tracking-tight text-ink-900">
              {party.name}
            </h1>
            <p className="mt-0.5 truncate text-xs text-ink-500">
              {PARTY_TYPE_LABELS[party.type]}
              {party.note ? ` · ${party.note}` : ""}
            </p>
            {party.phone && (
              <a
                href={`tel:+91${party.phone}`}
                className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700"
              >
                <Phone size={12} /> {formatPhoneClient(party.phone)}
              </a>
            )}
          </div>

          <EditPartyButton party={party} />
        </div>

        <div
          className={
            settled
              ? "mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink-200 bg-ink-50 p-3.5"
              : youGet
                ? "mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5"
                : "mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3.5"
          }
        >
          <div className="min-w-0">
            <p
              className={
                settled
                  ? "text-[11px] font-medium uppercase tracking-wide text-ink-500"
                  : youGet
                    ? "text-[11px] font-medium uppercase tracking-wide text-emerald-700"
                    : "text-[11px] font-medium uppercase tracking-wide text-rose-700"
              }
            >
              {settled ? "All settled" : youGet ? "You will get" : "You will give"}
            </p>
            <p
              title={formatINRCompact(Math.abs(party.balance))}
              className={
                settled
                  ? "tabular mt-0.5 truncate text-xl font-bold text-ink-700"
                  : youGet
                    ? "tabular mt-0.5 truncate text-xl font-bold text-emerald-700"
                    : "tabular mt-0.5 truncate text-xl font-bold text-rose-700"
              }
            >
              {formatINRAdaptive(Math.abs(party.balance))}
            </p>
          </div>
          <SettleButton party={party} />
        </div>
      </Card>

      <Card padded={false}>
        <header className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-ink-200 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-ink-500">
          <span>Entries</span>
          <span className="w-20 text-right">You gave</span>
          <span className="w-20 text-right">You got</span>
        </header>

        {entries.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No entries yet"
              description="Record what you gave or got using the buttons below."
            />
          </div>
        ) : (
          <ul className="divide-y divide-ink-100 p-2">
            {entries.map((entry) => (
              <li key={entry.id}>
                <EditEntryButton entry={entry} party={party}>
                  <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-2 py-2.5">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink-900">
                        {entry.note || (entry.type === "GAVE" ? "You gave" : "You got")}
                      </span>
                      <span className="block truncate text-[11px] text-ink-500">
                        {formatDay(new Date(entry.date))} · bal{" "}
                        {formatINRAdaptive(Math.abs(entry.runningBalance))}{" "}
                        {entry.runningBalance === 0
                          ? "settled"
                          : entry.runningBalance > 0
                            ? "to get"
                            : "to give"}
                      </span>
                    </span>

                    <span
                      className="tabular w-20 text-right text-sm font-semibold text-rose-700"
                      title={entry.type === "GAVE" ? formatINRCompact(entry.amount) : undefined}
                    >
                      {entry.type === "GAVE" ? formatINRAdaptive(entry.amount) : ""}
                    </span>
                    <span
                      className="tabular w-20 text-right text-sm font-semibold text-emerald-700"
                      title={entry.type === "GOT" ? formatINRCompact(entry.amount) : undefined}
                    >
                      {entry.type === "GOT" ? formatINRAdaptive(entry.amount) : ""}
                    </span>
                  </div>
                </EditEntryButton>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <EntryActions party={party} />
    </div>
  );
}
