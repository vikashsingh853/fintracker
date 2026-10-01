"use client";

import { Pause, Play, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import {
  createRecurringRule,
  deleteRecurringRule,
  postRecurringRule,
  toggleRecurringRule,
  unpostRecurringRule,
  updateRecurringRule,
} from "@/lib/actions";
import { formatShortDay, toDateInputValue } from "@/lib/dates";
import { formatINRCompact } from "@/lib/money";
import {
  FREQUENCIES,
  FREQUENCY_LABELS,
  type AccountDTO,
  type CategoryDTO,
  type RecurringRuleDTO,
  type TransactionType,
} from "@/lib/types";
import {
  AmountInput,
  Button,
  ErrorNote,
  Field,
  Input,
  Select,
  Toggle,
} from "./form";
import { Sheet } from "./sheet";

function RuleForm({
  accounts,
  categories,
  rule,
  onDone,
}: {
  accounts: AccountDTO[];
  categories: CategoryDTO[];
  rule?: RecurringRuleDTO;
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<TransactionType>(rule?.type ?? "EXPENSE");

  const relevantCategories = categories.filter((c) =>
    type === "INCOME" ? c.kind === "INCOME" : c.kind === "EXPENSE",
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = rule
        ? await updateRecurringRule(rule.id, formData)
        : await createRecurringRule(formData);

      if (!result.ok) {
        setError(result.error ?? "Something went wrong");
        return;
      }
      router.refresh();
      onDone();
    });
  }

  function handleDelete() {
    if (!rule) return;
    startTransition(async () => {
      const result = await deleteRecurringRule(rule.id);
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

      <Field label="Name">
        <Input
          name="name"
          required
          autoFocus
          maxLength={60}
          defaultValue={rule?.name ?? ""}
          placeholder="Netflix, Flat rent, SIP…"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Kind">
          <Select
            value={type}
            onChange={(e) => setType(e.target.value as TransactionType)}
          >
            <option value="EXPENSE">Expense</option>
            <option value="INCOME">Income</option>
            <option value="TRANSFER">Transfer</option>
          </Select>
        </Field>

        <Field label="Amount">
          <AmountInput
            name="amount"
            required
            placeholder="0"
            defaultValue={rule ? (rule.amount / 100).toString() : ""}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={type === "INCOME" ? "Deposit into" : "Paid from"}>
          <Select name="accountId" defaultValue={rule?.account.id} required>
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
              defaultValue={rule?.toAccount?.id ?? ""}
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
              defaultValue={rule?.category?.id ?? ""}
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

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Repeats">
          <Select name="frequency" defaultValue={rule?.frequency ?? "MONTHLY"}>
            {FREQUENCIES.map((f) => (
              <option key={f} value={f}>
                {FREQUENCY_LABELS[f]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Next due">
          <Input
            type="date"
            name="nextDueDate"
            required
            defaultValue={toDateInputValue(
              rule ? new Date(rule.nextDueDate) : new Date(),
            )}
          />
        </Field>
      </div>

      <Field label="Merchant">
        <Input
          name="merchant"
          maxLength={80}
          defaultValue={rule?.merchant ?? ""}
          placeholder="Optional"
        />
      </Field>

      <div className="space-y-2">
        <Toggle
          name="isBill"
          label="Show in Bills & Subscriptions"
          defaultChecked={rule ? rule.isBill : true}
        />
        <Toggle
          name="autoPost"
          label="Auto-debits from my account"
          description="Standing instruction or auto-pay — you don't pay it manually."
          defaultChecked={rule?.autoPost}
        />
        <Toggle
          name="isVariable"
          label="Amount varies each time"
          description="Electricity, credit card bills — you'll confirm the amount when paying."
          defaultChecked={rule?.isVariable}
        />
      </div>

      <ErrorNote message={error} />

      <div className="flex items-center gap-2 pt-1">
        <Button type="submit" disabled={pending} className="flex-1">
          {pending ? "Saving…" : rule ? "Save changes" : "Add recurring"}
        </Button>
        {rule && (
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

export function AddRecurringButton({
  accounts,
  categories,
}: {
  accounts: AccountDTO[];
  categories: CategoryDTO[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        Add recurring
      </Button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Add recurring item"
        description="Rent, subscriptions, SIPs, EMIs and salary."
      >
        <RuleForm
          accounts={accounts}
          categories={categories}
          onDone={() => setOpen(false)}
        />
      </Sheet>
    </>
  );
}

export function EditRecurringButton({
  rule,
  accounts,
  categories,
  children,
}: {
  rule: RecurringRuleDTO;
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
        className="min-w-0 flex-1 rounded-xl text-left transition hover:bg-ink-50"
      >
        {children}
      </button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Edit recurring"
        description={rule.name}
      >
        <RuleForm
          accounts={accounts}
          categories={categories}
          rule={rule}
          onDone={() => setOpen(false)}
        />
      </Sheet>
    </>
  );
}

/** Posts the rule as a real transaction and advances its next due date. */
export function MarkPaidButton({ rule }: { rule: RecurringRuleDTO }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function post(amount?: string) {
    setError(null);
    startTransition(async () => {
      const result = await postRecurringRule(rule.id, amount);
      if (!result.ok) {
        setError(result.error ?? "Could not record payment");
        return;
      }
      router.refresh();
      setOpen(false);
    });
  }

  function handleClick() {
    // Variable bills need the real amount before we can post them.
    if (rule.isVariable) setOpen(true);
    else post();
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={handleClick}
        disabled={pending}
      >
        {pending ? "…" : "Mark paid"}
      </Button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={`Record ${rule.name}`}
        description={`Usually ${formatINRCompact(rule.amount)} — enter the actual amount.`}
      >
        <form
          className="space-y-4 p-5"
          onSubmit={(event) => {
            event.preventDefault();
            const value = new FormData(event.currentTarget).get("amount");
            post(typeof value === "string" ? value : undefined);
          }}
        >
          <Field label="Amount paid">
            <AmountInput
              name="amount"
              required
              autoFocus
              defaultValue={(rule.amount / 100).toString()}
            />
          </Field>
          <ErrorNote message={error} />
          <div className="flex gap-2">
            <Button type="submit" disabled={pending} className="flex-1">
              {pending ? "Recording…" : "Record payment"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Sheet>

      {!open && error && (
        <div className="mt-2">
          <ErrorNote message={error} />
        </div>
      )}
    </>
  );
}

/** Reverses the last recorded payment and puts the bill back on the due list. */
export function MarkUnpaidButton({
  rule,
  compact = false,
}: {
  rule: RecurringRuleDTO;
  /** Icon-only below `sm`, for rows that can't spare the width. */
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!rule.lastPosted) return null;

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await unpostRecurringRule(rule.id);
      if (!result.ok) {
        setError(result.error ?? "Could not undo payment");
        return;
      }
      router.refresh();
    });
  }

  const label = pending ? "Undoing…" : "Mark unpaid";

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={handleClick}
        disabled={pending}
        aria-label={label}
        title={`Undo the ${formatINRCompact(rule.lastPosted.amount)} payment recorded on ${formatShortDay(new Date(rule.lastPosted.date))}`}
        className={compact ? "max-sm:px-2" : undefined}
      >
        <Undo2 size={13} />
        <span className={compact ? "max-sm:hidden" : undefined}>{label}</span>
      </Button>
      {error && <ErrorNote message={error} />}
    </span>
  );
}

export function ToggleRecurringButton({ rule }: { rule: RecurringRuleDTO }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const label = rule.isActive ? "Pause" : "Resume";
  const Icon = rule.isActive ? Pause : Play;

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={pending}
      aria-label={label}
      title={label}
      className="max-sm:px-2"
      onClick={() =>
        startTransition(async () => {
          await toggleRecurringRule(rule.id);
          router.refresh();
        })
      }
    >
      <Icon size={13} className="sm:hidden" />
      <span className="max-sm:hidden">{label}</span>
    </Button>
  );
}
