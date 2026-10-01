import clsx from "clsx";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Lightbulb,
  TrendingUp,
} from "lucide-react";
import { formatINRAdaptive, formatINRCompact } from "@/lib/money";
import type { Insight } from "@/lib/insights";
import type { SafeToSpend } from "@/lib/types";
import type { SalaryAllocation } from "@/lib/queries";
import { formatDay } from "@/lib/dates";
import { Card, CardHeader, Progress } from "./ui";

/** The hero number: what's genuinely free to spend today. */
export function SafeToSpendHero({
  safe,
  name,
}: {
  safe: SafeToSpend;
  name: string;
}) {
  return (
    <div className="animate-rise overflow-hidden rounded-2xl bg-gradient-to-br from-brand-700 via-brand-600 to-indigo-500 p-5 text-white shadow-lg shadow-brand-600/20 sm:p-6">
      <p className="text-xs font-medium uppercase tracking-wider text-white/70">
        Hi {name}, your safe to spend
      </p>

      {safe.isNegative ? (
        <>
          <p
            title={formatINRCompact(safe.safeTotal)}
            className="tabular mt-2 truncate text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl"
          >
            {formatINRAdaptive(safe.safeTotal)}
          </p>
          <p className="mt-1.5 text-sm text-white/85">
            Your committed outflows exceed your liquid balance this month.
          </p>
        </>
      ) : (
        <>
          <p
            title={formatINRCompact(safe.perDay)}
            className="tabular mt-2 flex items-baseline gap-1 text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl"
          >
            <span className="min-w-0 truncate">
              {formatINRAdaptive(safe.perDay)}
            </span>
            <span className="shrink-0 text-base font-medium text-white/70 sm:text-lg">
              /day
            </span>
          </p>
          <p className="mt-1.5 text-sm text-white/85">
            {formatINRAdaptive(safe.safeTotal)} left for the next{" "}
            {safe.daysRemaining} day
            {safe.daysRemaining === 1 ? "" : "s"}, after bills and planned
            savings.
          </p>
        </>
      )}

      <dl className="mt-5 grid grid-cols-3 gap-2 border-t border-white/20 pt-4 text-center sm:gap-3">
        <div className="min-w-0">
          <dt className="truncate text-[10px] uppercase tracking-wide text-white/65">
            Liquid
          </dt>
          <dd
            title={formatINRCompact(safe.liquidBalance)}
            className="tabular mt-0.5 truncate text-xs font-semibold sm:text-sm"
          >
            {formatINRAdaptive(safe.liquidBalance)}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="truncate text-[10px] uppercase tracking-wide text-white/65">
            Upcoming bills
          </dt>
          <dd
            title={formatINRCompact(safe.upcomingOutflows)}
            className="tabular mt-0.5 truncate text-xs font-semibold sm:text-sm"
          >
            −{formatINRAdaptive(safe.upcomingOutflows)}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="truncate text-[10px] uppercase tracking-wide text-white/65">
            Planned savings
          </dt>
          <dd
            title={formatINRCompact(safe.plannedSavings)}
            className="tabular mt-0.5 truncate text-xs font-semibold sm:text-sm"
          >
            −{formatINRAdaptive(safe.plannedSavings)}
          </dd>
        </div>
      </dl>
    </div>
  );
}

const TONE_STYLES = {
  positive: {
    wrap: "border-emerald-200 bg-emerald-50",
    icon: "text-emerald-600",
    Icon: CheckCircle2,
  },
  warning: {
    wrap: "border-amber-200 bg-amber-50",
    icon: "text-amber-600",
    Icon: AlertTriangle,
  },
  critical: {
    wrap: "border-rose-200 bg-rose-50",
    icon: "text-rose-600",
    Icon: AlertTriangle,
  },
  neutral: {
    wrap: "border-brand-100 bg-brand-50",
    icon: "text-brand-600",
    Icon: Info,
  },
} as const;

export function InsightList({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) return null;

  return (
    <Card>
      <CardHeader
        title="FinTrack Insights"
        subtitle="Generated from your ledger — no guesswork"
        action={<Lightbulb size={16} className="text-amber-500" />}
      />
      <ul className="space-y-2.5">
        {insights.map((insight) => {
          const tone = TONE_STYLES[insight.tone];
          return (
            <li
              key={insight.id}
              className={clsx("flex gap-3 rounded-xl border p-3", tone.wrap)}
            >
              <tone.Icon
                size={16}
                className={clsx("mt-0.5 shrink-0", tone.icon)}
              />
              <div className="min-w-0 break-words">
                <p className="text-sm font-medium text-ink-900">
                  {insight.title}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-ink-600">
                  {insight.detail}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/** Salary Intelligence: turns a credit into a suggested allocation. */
export function SalaryCard({
  salary,
}: {
  salary: {
    amount: number;
    receivedOn: string | null;
    source: string;
    allocations: SalaryAllocation[];
  };
}) {
  return (
    <Card>
      <CardHeader
        title="Salary Intelligence"
        subtitle={
          salary.receivedOn
            ? `${salary.source} · credited ${formatDay(new Date(salary.receivedOn))}`
            : "Based on your expected monthly income"
        }
        action={<TrendingUp size={16} className="text-emerald-600" />}
      />

      <div className="mb-4 rounded-xl bg-ink-50 p-3.5">
        <p className="text-[11px] font-medium uppercase tracking-wide text-ink-500">
          Income received
        </p>
        <p
          title={formatINRCompact(salary.amount)}
          className="tabular mt-0.5 truncate text-xl font-bold text-ink-900 sm:text-2xl"
        >
          {formatINRAdaptive(salary.amount)}
        </p>
      </div>

      <p className="mb-3 text-xs font-medium text-ink-600">
        Recommended allocation
      </p>
      <ul className="space-y-3">
        {salary.allocations.map((a) => (
          <li key={a.bucket}>
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2 text-sm text-ink-700">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: a.color }}
                  aria-hidden
                />
                <span className="truncate">{a.label}</span>
                <span className="shrink-0 text-[11px] text-ink-400">
                  {a.percent}%
                </span>
              </span>
              <span
                title={formatINRCompact(a.amount)}
                className="tabular shrink-0 text-sm font-semibold text-ink-900"
              >
                {formatINRAdaptive(a.amount)}
              </span>
            </div>
            <Progress value={a.percent * 2} tone="brand" className="h-1.5" />
          </li>
        ))}
      </ul>

      <p className="mt-4 text-[11px] leading-relaxed text-ink-500">
        A starting split you can tune. Editable allocations and auto-transfers
        arrive with Goals in Phase 2.
      </p>
    </Card>
  );
}
