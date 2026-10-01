import type { SplitType } from "./types";

export type ShareResult =
  | { ok: true; shares: Map<string, bigint> }
  | { ok: false; error: string };

/**
 * Splits `total` paise across members. Rounding remainders go to the first
 * members, one paisa each, so shares always sum exactly to the total.
 *
 * - EQUAL:   `values` keys are the participating member ids (values ignored)
 * - EXACT:   `values` are rupee amounts per member
 * - PERCENT: `values` are percentages per member
 */
export function computeShares(
  total: bigint,
  splitType: SplitType,
  values: Map<string, number>,
): ShareResult {
  const ids = [...values.keys()];
  if (ids.length === 0)
    return { ok: false, error: "Pick at least one person to split with" };

  if (splitType === "EQUAL") {
    const n = BigInt(ids.length);
    const base = total / n;
    let remainder = total - base * n;
    const shares = new Map<string, bigint>();
    for (const id of ids) {
      shares.set(id, base + (remainder > 0n ? 1n : 0n));
      if (remainder > 0n) remainder -= 1n;
    }
    return { ok: true, shares };
  }

  if (splitType === "EXACT") {
    const shares = new Map<string, bigint>();
    let sum = 0n;
    for (const [id, rupees] of values) {
      if (!Number.isFinite(rupees) || rupees < 0)
        return { ok: false, error: "Amounts can't be negative" };
      const paise = BigInt(Math.round(rupees * 100));
      if (paise > 0n) shares.set(id, paise);
      sum += paise;
    }
    if (sum !== total) {
      const diff = Number(total - sum) / 100;
      return {
        ok: false,
        error:
          diff > 0
            ? `₹${diff.toFixed(2)} is still unassigned`
            : `Shares exceed the total by ₹${(-diff).toFixed(2)}`,
      };
    }
    if (shares.size === 0)
      return { ok: false, error: "Enter at least one share" };
    return { ok: true, shares };
  }

  // PERCENT
  let pctSum = 0;
  for (const pct of values.values()) {
    if (!Number.isFinite(pct) || pct < 0)
      return { ok: false, error: "Percentages can't be negative" };
    pctSum += pct;
  }
  if (Math.abs(pctSum - 100) > 0.01) {
    return {
      ok: false,
      error: `Percentages add up to ${pctSum.toFixed(2)}%, not 100%`,
    };
  }

  // Basis points keep the arithmetic in integers.
  const shares = new Map<string, bigint>();
  let assigned = 0n;
  for (const [id, pct] of values) {
    const bps = BigInt(Math.round(pct * 100));
    if (bps === 0n) continue;
    const share = (total * bps) / 10_000n;
    shares.set(id, share);
    assigned += share;
  }
  let remainder = total - assigned;
  for (const id of shares.keys()) {
    if (remainder <= 0n) break;
    shares.set(id, shares.get(id)! + 1n);
    remainder -= 1n;
  }
  return { ok: true, shares };
}

/**
 * Greedy settle-up plan: repeatedly matches the largest debtor with the
 * largest creditor, which keeps the number of payments small.
 */
export function simplifyDebts(
  balances: Map<string, number>,
): Array<{ from: string; to: string; amount: number }> {
  const creditors = [...balances]
    .filter(([, b]) => b > 0)
    .map(([id, b]) => ({ id, amount: b }));
  const debtors = [...balances]
    .filter(([, b]) => b < 0)
    .map(([id, b]) => ({ id, amount: -b }));
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const result: Array<{ from: string; to: string; amount: number }> = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].amount, creditors[j].amount);
    if (amount > 0)
      result.push({ from: debtors[i].id, to: creditors[j].id, amount });
    debtors[i].amount -= amount;
    creditors[j].amount -= amount;
    if (debtors[i].amount === 0) i++;
    if (creditors[j].amount === 0) j++;
  }
  return result;
}
