"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import type { AccountDTO, CategoryDTO, TransactionDTO } from "@/lib/types";
import { Sheet } from "./sheet";
import { TransactionForm } from "./transaction-form";

/** Floating action button — the primary way to log money on mobile. */
export function QuickAdd({
  accounts,
  categories,
}: {
  accounts: AccountDTO[];
  categories: CategoryDTO[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Add transaction"
        className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-30 grid h-14 w-14 place-items-center rounded-full bg-brand-600 text-white shadow-lg shadow-brand-600/30 transition hover:bg-brand-700 active:scale-95 md:bottom-8 md:right-8"
      >
        <Plus size={24} strokeWidth={2.5} />
      </button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Add transaction"
        description="Log an expense, income or transfer between accounts."
      >
        <TransactionForm
          accounts={accounts}
          categories={categories}
          onDone={() => setOpen(false)}
        />
      </Sheet>
    </>
  );
}

/** Row-level editor used by the transactions list. */
export function EditTransaction({
  transaction,
  accounts,
  categories,
  children,
}: {
  transaction: TransactionDTO;
  accounts: AccountDTO[];
  categories: CategoryDTO[];
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-xl text-left transition hover:bg-ink-50"
      >
        {children}
      </button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Edit transaction"
        description="Update or remove this entry."
      >
        <TransactionForm
          accounts={accounts}
          categories={categories}
          transaction={transaction}
          onDone={() => setOpen(false)}
        />
      </Sheet>
    </>
  );
}
