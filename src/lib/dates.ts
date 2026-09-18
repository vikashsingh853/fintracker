import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  differenceInCalendarDays,
  endOfMonth,
  format,
  isAfter,
  startOfDay,
  startOfMonth,
} from "date-fns";
import type { Frequency } from "./types";

/** "YYYY-MM" period key used by budgets — timezone-stable. */
export function periodKey(date: Date = new Date()): string {
  return format(date, "yyyy-MM");
}

export function periodToDate(period: string): Date {
  const [year, month] = period.split("-").map(Number);
  return new Date(year, month - 1, 1);
}

export function periodLabel(period: string): string {
  return format(periodToDate(period), "MMMM yyyy");
}

export function shiftPeriod(period: string, months: number): string {
  return periodKey(addMonths(periodToDate(period), months));
}

export function monthRange(period: string): { start: Date; end: Date } {
  const base = periodToDate(period);
  return { start: startOfMonth(base), end: endOfMonth(base) };
}

/** Days left in the month including today — the divisor for Safe to Spend. */
export function daysRemainingInMonth(reference: Date = new Date()): number {
  const end = endOfMonth(reference);
  return Math.max(1, differenceInCalendarDays(end, startOfDay(reference)) + 1);
}

export function daysElapsedInMonth(reference: Date = new Date()): number {
  return differenceInCalendarDays(startOfDay(reference), startOfMonth(reference)) + 1;
}

export function formatDay(date: Date): string {
  return format(date, "d MMM yyyy");
}

export function formatShortDay(date: Date): string {
  return format(date, "d MMM");
}

export function toDateInputValue(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/**
 * Clamps a target day onto a month that may be shorter.
 * A rule due on the 31st falls on the 28th/30th in shorter months.
 */
function withDayOfMonth(date: Date, dayOfMonth: number): Date {
  const lastDay = endOfMonth(date).getDate();
  const result = new Date(date);
  result.setDate(Math.min(dayOfMonth, lastDay));
  return startOfDay(result);
}

export interface RecurrenceSpec {
  frequency: Frequency;
  interval: number;
  dayOfMonth?: number | null;
  weekday?: number | null;
  monthOfYear?: number | null;
}

/** Next occurrence strictly after `from`. */
export function nextOccurrence(spec: RecurrenceSpec, from: Date): Date {
  const interval = Math.max(1, spec.interval);
  const base = startOfDay(from);

  switch (spec.frequency) {
    case "DAILY":
      return addDays(base, interval);

    case "WEEKLY": {
      if (spec.weekday == null) return addWeeks(base, interval);
      let candidate = addDays(base, 1);
      while (candidate.getDay() !== spec.weekday) {
        candidate = addDays(candidate, 1);
      }
      return startOfDay(candidate);
    }

    case "MONTHLY": {
      const day = spec.dayOfMonth ?? base.getDate();
      const candidate = withDayOfMonth(base, day);
      if (isAfter(candidate, base)) return candidate;
      return withDayOfMonth(addMonths(base, interval), day);
    }

    case "QUARTERLY": {
      const day = spec.dayOfMonth ?? base.getDate();
      return withDayOfMonth(addMonths(base, 3 * interval), day);
    }

    case "YEARLY": {
      const day = spec.dayOfMonth ?? base.getDate();
      const next = addYears(base, interval);
      if (spec.monthOfYear != null) next.setMonth(spec.monthOfYear - 1);
      return withDayOfMonth(next, day);
    }

    default:
      return addMonths(base, interval);
  }
}

/** All occurrences in [from, until] — drives the cash-flow projection. */
export function occurrencesBetween(
  spec: RecurrenceSpec,
  nextDueDate: Date,
  from: Date,
  until: Date,
  limit = 60,
): Date[] {
  const results: Date[] = [];
  let cursor = startOfDay(nextDueDate);
  const fromDay = startOfDay(from);

  while (cursor < fromDay && results.length < limit) {
    cursor = nextOccurrence(spec, cursor);
  }

  while (cursor <= until && results.length < limit) {
    results.push(cursor);
    cursor = nextOccurrence(spec, cursor);
  }

  return results;
}
