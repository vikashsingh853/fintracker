"use client";

import clsx from "clsx";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import type { AccountDTO, CategoryDTO } from "@/lib/types";
import { Select } from "./form";

const TYPE_FILTERS = [
  { value: "", label: "All" },
  { value: "EXPENSE", label: "Expense" },
  { value: "INCOME", label: "Income" },
  { value: "TRANSFER", label: "Transfer" },
];

export function TransactionFilters({
  accounts,
  categories,
  periods,
}: {
  accounts: AccountDTO[];
  categories: CategoryDTO[];
  periods: Array<{ value: string; label: string }>;
}) {
  const router = useRouter();
  const params = useSearchParams();

  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      router.push(`/transactions?${next.toString()}`);
    },
    [params, router],
  );

  const currentType = params.get("type") ?? "";

  return (
    <div className="space-y-3">
      <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {TYPE_FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => setParam("type", filter.value)}
            aria-pressed={currentType === filter.value}
            className={clsx(
              "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition",
              currentType === filter.value
                ? "bg-ink-900 text-ink-50"
                : "border border-ink-200 bg-surface text-ink-600 hover:bg-ink-50",
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <Select
          aria-label="Month"
          value={params.get("period") ?? ""}
          onChange={(e) => setParam("period", e.target.value)}
        >
          {periods.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </Select>

        <Select
          aria-label="Account"
          value={params.get("accountId") ?? ""}
          onChange={(e) => setParam("accountId", e.target.value)}
        >
          <option value="">All accounts</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>

        <Select
          aria-label="Category"
          value={params.get("categoryId") ?? ""}
          onChange={(e) => setParam("categoryId", e.target.value)}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
