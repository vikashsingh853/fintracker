import { cache } from "react";
import { daysElapsedInMonth, daysRemainingInMonth, periodKey, shiftPeriod } from "./dates";
import { formatINRCompact } from "./money";
import {
  getBudgets,
  getMonthSummary,
  getSafeToSpend,
  getSpendByCategory,
  getUpcoming,
} from "./queries";

export type InsightTone = "positive" | "warning" | "critical" | "neutral";

export interface Insight {
  id: string;
  tone: InsightTone;
  title: string;
  detail: string;
}

/**
 * Phase 1 coach: deterministic rules over the ledger, no model calls.
 * The Phase 3 AI Money Coach replaces the copy generation here, but the
 * underlying signals (pace, trend, projection) stay the same.
 */
export const getInsights = cache(async function getInsights(): Promise<Insight[]> {
  const period = periodKey();
  const previous = shiftPeriod(period, -1);

  const [summary, prevSummary, budgets, thisMonthSpend, lastMonthSpend, upcoming, safe] =
    await Promise.all([
      getMonthSummary(period),
      getMonthSummary(previous),
      getBudgets(period),
      getSpendByCategory(period),
      getSpendByCategory(previous),
      getUpcoming(),
      getSafeToSpend(),
    ]);

  const insights: Insight[] = [];
  const elapsed = daysElapsedInMonth();
  const remaining = daysRemainingInMonth();
  const daysInMonth = elapsed + remaining - 1;

  // 1. Biggest category movement vs last month.
  const lastByCategory = new Map(lastMonthSpend.map((c) => [c.categoryId, c.amount]));
  let biggestSwing: { name: string; delta: number; pct: number; amount: number } | null = null;

  for (const category of thisMonthSpend) {
    const prev = lastByCategory.get(category.categoryId) ?? 0;
    if (prev <= 0) continue;

    // Compare like-for-like: scale last month to the days elapsed so far.
    const pace = (prev / daysInMonth) * elapsed;
    if (pace <= 0) continue;

    const delta = category.amount - pace;
    const pct = Math.round((delta / pace) * 100);

    if (Math.abs(pct) >= 15 && (!biggestSwing || Math.abs(delta) > Math.abs(biggestSwing.delta))) {
      biggestSwing = { name: category.name, delta, pct, amount: category.amount };
    }
  }

  if (biggestSwing) {
    const up = biggestSwing.delta > 0;
    insights.push({
      id: "category-trend",
      tone: up ? "warning" : "positive",
      title: `${biggestSwing.name} is ${up ? "up" : "down"} ${Math.abs(biggestSwing.pct)}% this month`,
      detail: `You've spent ${formatINRCompact(biggestSwing.amount)} on ${biggestSwing.name.toLowerCase()} so far — ${formatINRCompact(Math.abs(biggestSwing.delta))} ${up ? "more" : "less"} than your pace at this point last month.`,
    });
  }

  // 2. Budgets projected to overshoot at the current burn rate.
  const projected = budgets
    .filter((b) => b.spent > 0 && b.amount > 0)
    .map((b) => {
      const projectedSpend = Math.round((b.spent / elapsed) * daysInMonth);
      return { ...b, projectedSpend, overBy: projectedSpend - b.amount };
    })
    .filter((b) => b.overBy > 0)
    .sort((a, b) => b.overBy - a.overBy);

  const alreadyOver = budgets.filter((b) => b.remaining < 0).sort((a, b) => a.remaining - b.remaining);

  if (alreadyOver.length > 0) {
    const worst = alreadyOver[0];
    insights.push({
      id: "budget-exceeded",
      tone: "critical",
      title: `${worst.category.name} budget exceeded`,
      detail: `You're ${formatINRCompact(Math.abs(worst.remaining))} over your ${formatINRCompact(worst.amount)} budget${alreadyOver.length > 1 ? `, and ${alreadyOver.length - 1} other ${alreadyOver.length === 2 ? "budget is" : "budgets are"} over too` : ""}.`,
    });
  } else if (projected.length > 0) {
    const worst = projected[0];
    insights.push({
      id: "budget-projection",
      tone: "warning",
      title: `On track to overspend on ${worst.category.name}`,
      detail: `At your current rate you'll finish the month around ${formatINRCompact(worst.projectedSpend)} — roughly ${formatINRCompact(worst.overBy)} over budget.`,
    });
  }

  // 3. Safe to spend guidance.
  if (safe.isNegative) {
    insights.push({
      id: "safe-negative",
      tone: "critical",
      title: "Your committed spending exceeds your balance",
      detail: `Upcoming bills and planned savings total more than what's in your liquid accounts. Consider deferring ${formatINRCompact(Math.abs(safe.safeTotal))} of planned outflows.`,
    });
  } else {
    insights.push({
      id: "safe-daily",
      tone: "neutral",
      title: `You can safely spend about ${formatINRCompact(safe.perDay)}/day`,
      detail: `That's ${formatINRCompact(safe.safeTotal)} spread across the ${safe.daysRemaining} days left this month, after ${formatINRCompact(safe.upcomingOutflows)} of upcoming bills and ${formatINRCompact(safe.plannedSavings)} of planned savings.`,
    });
  }

  // 4. Savings rate vs last month.
  if (summary.income > 0) {
    const better = summary.savingsRate >= prevSummary.savingsRate;
    insights.push({
      id: "savings-rate",
      tone: better ? "positive" : "warning",
      title: `Saving ${summary.savingsRate}% of income this month`,
      detail:
        prevSummary.income > 0
          ? `Last month you saved ${prevSummary.savingsRate}%. You're ${better ? "ahead of" : "behind"} that pace, with ${formatINRCompact(summary.saved)} kept so far.`
          : `You've kept ${formatINRCompact(summary.saved)} of ${formatINRCompact(summary.income)} so far.`,
    });
  }

  // 5. Bills landing in the next seven days.
  const thisWeek = upcoming.filter((u) => u.daysUntil <= 7 && u.type !== "INCOME");
  if (thisWeek.length > 0) {
    const total = thisWeek.reduce((sum, u) => sum + u.amount, 0);
    insights.push({
      id: "bills-week",
      tone: "neutral",
      title: `${thisWeek.length} payment${thisWeek.length > 1 ? "s" : ""} due this week`,
      detail: `${thisWeek
        .slice(0, 3)
        .map((u) => u.name)
        .join(", ")}${thisWeek.length > 3 ? ` and ${thisWeek.length - 3} more` : ""} — ${formatINRCompact(total)} in total.`,
    });
  }

  return insights;
});
