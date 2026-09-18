"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { archiveAccount, createAccount, updateAccount } from "@/lib/actions";
import { ACCOUNT_TYPES, ACCOUNT_TYPE_LABELS, type AccountDTO, type AccountType } from "@/lib/types";
import { AmountInput, Button, ErrorNote, Field, Input, Select } from "./form";
import { Sheet } from "./sheet";

const COLORS = [
  "#2563eb",
  "#0e7490",
  "#15803d",
  "#b45309",
  "#9f1239",
  "#6d28d9",
  "#0f172a",
];

function AccountForm({ account, onDone }: { account?: AccountDTO; onDone: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<AccountType>(account?.type ?? "BANK");
  const [color, setColor] = useState(account?.color ?? COLORS[0]);

  const isCredit = type === "CREDIT_CARD";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = account
        ? await updateAccount(account.id, formData)
        : await createAccount(formData);

      if (!result.ok) {
        setError(result.error ?? "Something went wrong");
        return;
      }
      router.refresh();
      onDone();
    });
  }

  function handleArchive() {
    if (!account) return;
    startTransition(async () => {
      const result = await archiveAccount(account.id);
      if (!result.ok) {
        setError(result.error ?? "Could not update");
        return;
      }
      router.refresh();
      onDone();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-5">
      <input type="hidden" name="color" value={color} />
      <input type="hidden" name="icon" value={account?.icon ?? "wallet"} />

      <Field label="Account name">
        <Input
          name="name"
          required
          maxLength={60}
          autoFocus
          defaultValue={account?.name ?? ""}
          placeholder="HDFC Salary A/c"
        />
      </Field>

      <Field label="Type">
        <Select
          name="type"
          value={type}
          onChange={(e) => setType(e.target.value as AccountType)}
        >
          {ACCOUNT_TYPES.map((t) => (
            <option key={t} value={t}>
              {ACCOUNT_TYPE_LABELS[t]}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label={isCredit ? "Opening outstanding" : "Opening balance"}
        hint={
          isCredit
            ? "Leave at 0 and log card spends as expenses on this account."
            : "What the account held before you started tracking."
        }
      >
        <AmountInput
          name="openingBalance"
          defaultValue={account ? (account.openingBalance / 100).toString() : "0"}
        />
      </Field>

      {isCredit && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Credit limit">
            <AmountInput
              name="creditLimit"
              defaultValue={account?.creditLimit ? (account.creditLimit / 100).toString() : ""}
              placeholder="200000"
            />
          </Field>
          <Field label="Statement day">
            <Input
              name="billingCycleDay"
              type="number"
              min={1}
              max={31}
              defaultValue={account?.billingCycleDay ?? ""}
              placeholder="18"
            />
          </Field>
          <Field label="Due day">
            <Input
              name="dueDay"
              type="number"
              min={1}
              max={31}
              defaultValue={account?.dueDay ?? ""}
              placeholder="5"
            />
          </Field>
        </div>
      )}

      <Field label="Colour">
        <div className="flex flex-wrap gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Colour ${c}`}
              aria-pressed={color === c}
              onClick={() => setColor(c)}
              style={{ backgroundColor: c }}
              className={
                color === c
                  ? "h-8 w-8 rounded-full ring-2 ring-ink-900 ring-offset-2 ring-offset-surface"
                  : "h-8 w-8 rounded-full"
              }
            />
          ))}
        </div>
      </Field>

      <ErrorNote message={error} />

      <div className="flex items-center gap-2 pt-1">
        <Button type="submit" disabled={pending} className="flex-1">
          {pending ? "Saving…" : account ? "Save changes" : "Add account"}
        </Button>
        {account && (
          <Button type="button" variant="danger" onClick={handleArchive} disabled={pending}>
            {account.isArchived ? "Restore" : "Archive"}
          </Button>
        )}
        <Button type="button" variant="secondary" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function AddAccountButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        Add account
      </Button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Add account"
        description="Bank, cash, UPI wallet, credit card or investments."
      >
        <AccountForm onDone={() => setOpen(false)} />
      </Sheet>
    </>
  );
}

export function EditAccountButton({
  account,
  children,
}: {
  account: AccountDTO;
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
        title="Edit account"
        description={account.name}
      >
        <AccountForm account={account} onDone={() => setOpen(false)} />
      </Sheet>
    </>
  );
}
