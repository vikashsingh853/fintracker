"use client";

import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import {
  createTransaction,
  deleteTransaction,
  updateTransaction,
} from "@/lib/actions";
import { toDateInputValue } from "@/lib/dates";
import type {
  AccountDTO,
  CategoryDTO,
  TransactionDTO,
  TransactionType,
} from "@/lib/types";
import { AmountInput, Button, ErrorNote, Field, Input, Select } from "./form";

const TYPE_TABS: Array<{
  value: TransactionType;
  label: string;
  active: string;
}> = [
  { value: "EXPENSE", label: "Expense", active: "bg-bad-solid text-white" },
  { value: "INCOME", label: "Income", active: "bg-good-solid text-white" },
  { value: "TRANSFER", label: "Transfer", active: "bg-brand-600 text-white" },
];

export function TransactionForm({
  accounts,
  categories,
  transaction,
  onDone,
}: {
  accounts: AccountDTO[];
  categories: CategoryDTO[];
  transaction?: TransactionDTO;
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<TransactionType>(
    transaction?.type ?? "EXPENSE",
  );

  const relevantCategories = categories.filter((c) =>
    type === "INCOME" ? c.kind === "INCOME" : c.kind === "EXPENSE",
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = transaction
        ? await updateTransaction(transaction.id, formData)
        : await createTransaction(formData);

      if (!result.ok) {
        setError(result.error ?? "Something went wrong");
        return;
      }
      router.refresh();
      onDone();
    });
  }

  function handleDelete() {
    if (!transaction) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteTransaction(transaction.id);
      if (!result.ok) {
        setError(result.error ?? "Could not delete");
        return;
      }
      router.refresh();
      onDone();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-5">
      <input type="hidden" name="type" value={type} />
      {/* Hidden for now; carried through so edits don't wipe existing values. */}
      <input
        type="hidden"
        name="paymentMethod"
        value={transaction?.paymentMethod ?? "UPI"}
      />
      <input type="hidden" name="note" value={transaction?.note ?? ""} />
      <input
        type="hidden"
        name="excludeFromBudget"
        value={transaction?.excludeFromBudget ? "on" : ""}
      />

      <div className="grid grid-cols-3 gap-1 rounded-xl bg-ink-100 p-1">
        {TYPE_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setType(tab.value)}
            aria-pressed={type === tab.value}
            className={clsx(
              "rounded-lg px-2 py-2 text-xs font-semibold transition",
              type === tab.value ? tab.active : "text-ink-600 hover:bg-surface",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <Field label="Amount">
        <AmountInput
          name="amount"
          placeholder="0"
          required
          autoFocus
          defaultValue={
            transaction ? (transaction.amount / 100).toString() : ""
          }
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={type === "INCOME" ? "Deposit into" : "Paid from"}>
          <Select
            name="accountId"
            defaultValue={transaction?.account.id}
            required
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </Field>

        {type === "TRANSFER" ? (
          <Field label="Transfer to">
            <Select
              name="toAccountId"
              defaultValue={transaction?.toAccount?.id ?? ""}
              required
            >
              <option value="">Select account</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <Field label="Category">
            <Select
              name="categoryId"
              defaultValue={transaction?.category?.id ?? ""}
              required
            >
              <option value="">Select category</option>
              {relevantCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>

      <Field label="Date">
        <Input
          type="date"
          name="date"
          required
          defaultValue={toDateInputValue(
            transaction ? new Date(transaction.date) : new Date(),
          )}
        />
      </Field>

      <Field label="Merchant" hint="Swiggy, BigBasket, landlord…">
        <Input
          name="merchant"
          maxLength={80}
          defaultValue={transaction?.merchant ?? ""}
          placeholder="Where did it go?"
        />
      </Field>

      <ErrorNote message={error} />

      <div className="flex items-center gap-2 pt-1">
        <Button type="submit" disabled={pending} className="flex-1">
          {pending
            ? "Saving…"
            : transaction
              ? "Save changes"
              : "Add transaction"}
        </Button>
        {transaction && (
          <Button
            type="button"
            variant="danger"
            onClick={handleDelete}
            disabled={pending}
          >
            Delete
          </Button>
        )}
        <Button
          type="button"
          variant="secondary"
          onClick={onDone}
          disabled={pending}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
