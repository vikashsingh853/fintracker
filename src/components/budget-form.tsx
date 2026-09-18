"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { copyBudgets, deleteBudget, upsertBudget } from "@/lib/actions";
import { periodLabel, shiftPeriod } from "@/lib/dates";
import type { BudgetDTO, CategoryDTO } from "@/lib/types";
import { AmountInput, Button, ErrorNote, Field, Select } from "./form";
import { Sheet } from "./sheet";

function BudgetForm({
  period,
  categories,
  budget,
  onDone,
}: {
  period: string;
  categories: CategoryDTO[];
  budget?: BudgetDTO;
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await upsertBudget(formData);
      if (!result.ok) {
        setError(result.error ?? "Something went wrong");
        return;
      }
      router.refresh();
      onDone();
    });
  }

  function handleDelete() {
    if (!budget) return;
    startTransition(async () => {
      const result = await deleteBudget(budget.id);
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
      <input type="hidden" name="period" value={period} />

      <Field label="Category">
        <Select
          name="categoryId"
          defaultValue={budget?.category.id ?? ""}
          required
          disabled={Boolean(budget)}
        >
          <option value="">Select category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      {/* A disabled select is not submitted, so keep the id in the payload. */}
      {budget && <input type="hidden" name="categoryId" value={budget.category.id} />}

      <Field label={`Monthly limit for ${periodLabel(period)}`}>
        <AmountInput
          name="amount"
          required
          autoFocus
          placeholder="0"
          defaultValue={budget ? (budget.amount / 100).toString() : ""}
        />
      </Field>

      <ErrorNote message={error} />

      <div className="flex items-center gap-2 pt-1">
        <Button type="submit" disabled={pending} className="flex-1">
          {pending ? "Saving…" : budget ? "Save budget" : "Set budget"}
        </Button>
        {budget && (
          <Button type="button" variant="danger" onClick={handleDelete} disabled={pending}>
            Remove
          </Button>
        )}
        <Button type="button" variant="secondary" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function AddBudgetButton({
  period,
  categories,
}: {
  period: string;
  categories: CategoryDTO[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        Set budget
      </Button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Set a budget"
        description={`Monthly limit for ${periodLabel(period)}.`}
      >
        <BudgetForm period={period} categories={categories} onDone={() => setOpen(false)} />
      </Sheet>
    </>
  );
}

export function EditBudgetButton({
  budget,
  categories,
  children,
}: {
  budget: BudgetDTO;
  categories: CategoryDTO[];
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-xl px-2 py-2.5 text-left transition hover:bg-ink-50"
      >
        {children}
      </button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Edit budget"
        description={budget.category.name}
      >
        <BudgetForm
          period={budget.period}
          categories={categories}
          budget={budget}
          onDone={() => setOpen(false)}
        />
      </Sheet>
    </>
  );
}

/** Carries last month's budgets forward so users don't re-enter them. */
export function CopyBudgetsButton({ period }: { period: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleCopy() {
    setError(null);
    startTransition(async () => {
      const result = await copyBudgets(shiftPeriod(period, -1), period);
      if (!result.ok) {
        setError(result.error ?? "Could not copy");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="secondary" size="sm" onClick={handleCopy} disabled={pending}>
        {pending ? "Copying…" : "Copy last month"}
      </Button>
      <ErrorNote message={error} />
    </div>
  );
}
