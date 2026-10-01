import clsx from "clsx";
import type { ReactNode } from "react";

export function Card({
  children,
  className,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section
      className={clsx(
        "rounded-2xl border border-ink-200/80 bg-surface shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
        padded && "p-4 sm:p-5",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-ink-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-ink-500">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-ink-900 sm:text-2xl">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-ink-300 bg-ink-50/60 px-6 py-10 text-center">
      <p className="text-sm font-medium text-ink-700">{title}</p>
      <p className="max-w-sm text-xs text-ink-500">{description}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Progress({
  value,
  tone = "brand",
  className,
}: {
  value: number;
  tone?: "brand" | "good" | "warn" | "bad";
  className?: string;
}) {
  const tones = {
    brand: "bg-brand-600",
    good: "bg-good-solid",
    warn: "bg-warn-solid",
    bad: "bg-bad-solid",
  } as const;

  return (
    <div
      className={clsx(
        "h-2 w-full overflow-hidden rounded-full bg-ink-200",
        className,
      )}
      role="progressbar"
      aria-valuenow={Math.min(100, Math.max(0, value))}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={clsx(
          "h-full rounded-full transition-all duration-500",
          tones[tone],
        )}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "good" | "warn" | "bad" | "brand";
}) {
  const tones = {
    neutral: "bg-ink-100 text-ink-600 ring-ink-200",
    good: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    warn: "bg-amber-50 text-amber-700 ring-amber-200",
    bad: "bg-rose-50 text-rose-700 ring-rose-200",
    brand: "bg-brand-50 text-brand-700 ring-brand-100",
  } as const;

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export function StatTile({
  label,
  value,
  exact,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  /** Full-precision value, surfaced on hover when `value` is abbreviated. */
  exact?: string;
  hint?: string;
  tone?: "neutral" | "in" | "out";
}) {
  const valueTone = {
    neutral: "text-ink-900",
    in: "text-money-in",
    out: "text-money-out",
  } as const;

  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-ink-200/80 bg-surface p-3.5">
      <p className="truncate text-[11px] font-medium uppercase tracking-wide text-ink-500">
        {label}
      </p>
      <p
        title={exact ?? value}
        className={clsx(
          "tabular mt-1 truncate text-base font-semibold sm:text-lg lg:text-xl",
          valueTone[tone],
        )}
      >
        {value}
      </p>
      {hint && (
        <p className="mt-0.5 truncate text-[11px] text-ink-500">{hint}</p>
      )}
    </div>
  );
}
