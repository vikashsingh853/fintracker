"use client";

import clsx from "clsx";
import { Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import {
  acceptGroupInvite,
  addGroupExpense,
  addGroupMembers,
  createGroup,
  deleteGroup,
  deleteGroupExpense,
  deleteGroupSettlement,
  removePendingMember,
  resendGroupInvite,
  settleGroupDebt,
  type GroupActionResult,
} from "@/lib/group-actions";
import { formatDay, toDateInputValue } from "@/lib/dates";
import { formatINRCompact } from "@/lib/money";
import {
  SPLIT_TYPES,
  SPLIT_TYPE_LABELS,
  type GroupActivity,
  type GroupDebt,
  type GroupMemberDTO,
  type SplitType,
} from "@/lib/types";
import { AmountInput, Button, ErrorNote, Field, Input, Select } from "./form";
import { Sheet } from "./sheet";

/** Runs a server action, surfaces its error, and refreshes on success. */
function useAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(
    action: () => Promise<GroupActionResult>,
    onSuccess?: (result: GroupActionResult) => void,
  ) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? "Something went wrong");
        return;
      }
      if (onSuccess) onSuccess(result);
      else router.refresh();
    });
  }

  return { pending, error, run, router };
}

function parseRupees(value: string): number {
  const n = Number(value.replace(/[₹,%\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/* ------------------------------------------------------------------ */
/* Members input                                                       */
/* ------------------------------------------------------------------ */

function MemberRows() {
  const [rows, setRows] = useState([0]);
  const [nextKey, setNextKey] = useState(1);

  return (
    <div className="space-y-2">
      {rows.map((key, index) => (
        <div key={key} className="flex items-start gap-2">
          <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
            <Input
              name="memberName"
              maxLength={60}
              placeholder={`Name ${index + 1}`}
              aria-label={`Member ${index + 1} name`}
            />
            <Input
              name="memberEmail"
              type="email"
              required
              maxLength={254}
              placeholder="friend@email.com"
              aria-label={`Member ${index + 1} email`}
            />
          </div>
          {rows.length > 1 && (
            <button
              type="button"
              onClick={() => setRows((r) => r.filter((k) => k !== key))}
              aria-label={`Remove member ${index + 1}`}
              className="mt-2 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-ink-400 transition hover:bg-ink-100 hover:text-ink-700"
            >
              <X size={15} />
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() => {
          setRows((r) => [...r, nextKey]);
          setNextKey((k) => k + 1);
        }}
        className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
      >
        <Plus size={14} /> Add another person
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Create group / add members                                          */
/* ------------------------------------------------------------------ */

export function CreateGroupButton({
  defaultEmail,
}: {
  defaultEmail: string | null;
}) {
  const [open, setOpen] = useState(false);
  const { pending, error, run, router } = useAction();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    run(
      () => createGroup(formData),
      (result) => {
        setOpen(false);
        router.push(`/groups/${result.id}`);
      },
    );
  }

  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        Create group
      </Button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Create group"
        description="Everyone gets an email invite to join."
      >
        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <Field label="Group name">
            <Input
              name="name"
              required
              autoFocus
              maxLength={60}
              placeholder="Goa trip, Flat 302…"
            />
          </Field>

          <Field
            label="Your email"
            hint="Required — group updates are sent here."
          >
            <Input
              name="yourEmail"
              type="email"
              required
              maxLength={254}
              defaultValue={defaultEmail ?? ""}
              placeholder="you@email.com"
            />
          </Field>

          <Field label="Members">
            <MemberRows />
          </Field>

          <ErrorNote message={error} />

          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={pending} className="flex-1">
              {pending ? "Creating & emailing…" : "Create & send invites"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Sheet>
    </>
  );
}

export function AddMembersButton({ groupId }: { groupId: string }) {
  const [open, setOpen] = useState(false);
  const { pending, error, run, router } = useAction();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    run(
      () => addGroupMembers(groupId, formData),
      () => {
        setOpen(false);
        router.refresh();
      },
    );
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={() => setOpen(true)}
      >
        <Plus size={13} /> Add
      </Button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Add members"
        description="They'll get an email invite."
      >
        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <MemberRows />
          <ErrorNote message={error} />
          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={pending} className="flex-1">
              {pending ? "Sending invites…" : "Send invites"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Sheet>
    </>
  );
}

export function PendingMemberActions({ memberId }: { memberId: string }) {
  const { pending, error, run } = useAction();
  const [sent, setSent] = useState(false);

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <span className="flex items-center gap-1">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending || sent}
          onClick={() =>
            run(
              () => resendGroupInvite(memberId),
              () => setSent(true),
            )
          }
        >
          {sent ? "Sent" : "Resend"}
        </Button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => removePendingMember(memberId))}
          aria-label="Remove invite"
          title="Remove invite"
          className="grid h-7 w-7 place-items-center rounded-lg text-ink-400 transition hover:bg-rose-50 hover:text-rose-600"
        >
          <Trash2 size={14} />
        </button>
      </span>
      {error && <ErrorNote message={error} />}
    </span>
  );
}

export function DeleteGroupButton({
  groupId,
  name,
}: {
  groupId: string;
  name: string;
}) {
  const { pending, error, run, router } = useAction();
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button
        type="button"
        variant="danger"
        size="sm"
        onClick={() => setConfirming(true)}
      >
        Delete group
      </Button>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border border-rose-200 bg-rose-50 p-3">
      <p className="text-xs text-rose-700">
        Delete &ldquo;{name}&rdquo; with all its expenses for everyone? This
        can&apos;t be undone.
      </p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="danger"
          size="sm"
          disabled={pending}
          onClick={() =>
            run(
              () => deleteGroup(groupId),
              () => router.push("/groups"),
            )
          }
        >
          {pending ? "Deleting…" : "Yes, delete"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setConfirming(false)}
        >
          Cancel
        </Button>
      </div>
      <ErrorNote message={error} />
    </div>
  );
}

export function JoinGroupButton({ token }: { token: string }) {
  const { pending, error, run, router } = useAction();

  return (
    <div className="space-y-3">
      <Button
        type="button"
        className="w-full"
        disabled={pending}
        onClick={() =>
          run(
            () => acceptGroupInvite(token),
            (result) => router.push(`/groups/${result.id}`),
          )
        }
      >
        {pending ? "Joining…" : "Join group"}
      </Button>
      <ErrorNote message={error} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Expenses                                                            */
/* ------------------------------------------------------------------ */

function SplitEditor({
  members,
  splitType,
  total,
}: {
  members: GroupMemberDTO[];
  splitType: SplitType;
  total: number;
}) {
  const [included, setIncluded] = useState(
    () => new Set(members.map((m) => m.id)),
  );
  const [values, setValues] = useState<Record<string, string>>({});

  if (splitType === "EQUAL") {
    const each = included.size > 0 ? total / included.size : 0;
    return (
      <ul className="divide-y divide-ink-100 rounded-xl border border-ink-200">
        {members.map((m) => (
          <li key={m.id}>
            <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5">
              <input
                type="checkbox"
                name="participant"
                value={m.id}
                checked={included.has(m.id)}
                onChange={(e) =>
                  setIncluded((prev) => {
                    const next = new Set(prev);
                    if (e.target.checked) next.add(m.id);
                    else next.delete(m.id);
                    return next;
                  })
                }
                className="h-4 w-4 shrink-0 rounded border-ink-300 text-brand-600"
              />
              <span className="min-w-0 flex-1 truncate text-sm text-ink-800">
                {m.isYou ? "You" : m.name}
              </span>
              <span className="tabular shrink-0 text-xs text-ink-500">
                {included.has(m.id) ? `₹${each.toFixed(2)}` : "—"}
              </span>
            </label>
          </li>
        ))}
      </ul>
    );
  }

  const isPercent = splitType === "PERCENT";
  const sum = Object.values(values).reduce((s, v) => s + parseRupees(v), 0);
  const target = isPercent ? 100 : total;
  const left = Math.round((target - sum) * 100) / 100;

  return (
    <div className="space-y-2">
      <ul className="divide-y divide-ink-100 rounded-xl border border-ink-200">
        {members.map((m) => (
          <li key={m.id} className="flex items-center gap-3 px-3 py-2">
            <span className="min-w-0 flex-1 truncate text-sm text-ink-800">
              {m.isYou ? "You" : m.name}
            </span>
            <div className="relative w-28 shrink-0">
              <input
                name={`share_${m.id}`}
                inputMode="decimal"
                autoComplete="off"
                value={values[m.id] ?? ""}
                onChange={(e) =>
                  setValues((v) => ({ ...v, [m.id]: e.target.value }))
                }
                placeholder="0"
                aria-label={`${m.name} ${isPercent ? "percent" : "amount"}`}
                className={clsx(
                  "tabular w-full rounded-lg border border-ink-300 bg-surface py-1.5 text-right text-sm text-ink-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100",
                  isPercent ? "pl-2 pr-6" : "pl-6 pr-2",
                )}
              />
              <span
                className={clsx(
                  "pointer-events-none absolute top-1/2 -translate-y-1/2 text-xs text-ink-400",
                  isPercent ? "right-2" : "left-2",
                )}
              >
                {isPercent ? "%" : "₹"}
              </span>
            </div>
          </li>
        ))}
      </ul>
      <p
        className={clsx(
          "text-right text-[11px] font-medium",
          left === 0 ? "text-emerald-600" : "text-amber-600",
        )}
      >
        {left === 0
          ? "All assigned"
          : isPercent
            ? `${left.toFixed(2)}% ${left > 0 ? "left" : "over"}`
            : `₹${Math.abs(left).toFixed(2)} ${left > 0 ? "left" : "over"}`}
      </p>
    </div>
  );
}

export function AddExpenseButton({
  groupId,
  members,
  youMemberId,
}: {
  groupId: string;
  members: GroupMemberDTO[];
  youMemberId: string;
}) {
  const [open, setOpen] = useState(false);
  const [splitType, setSplitType] = useState<SplitType>("EQUAL");
  const [amount, setAmount] = useState("");
  const { pending, error, run, router } = useAction();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    run(
      () => addGroupExpense(groupId, formData),
      () => {
        setOpen(false);
        setAmount("");
        router.refresh();
      },
    );
  }

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)} className="flex-1">
        <Plus size={15} /> Add expense
      </Button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Add expense"
        description="Everyone in the split gets an email."
      >
        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <input type="hidden" name="splitType" value={splitType} />

          <Field label="Description">
            <Input
              name="description"
              required
              autoFocus
              maxLength={80}
              placeholder="Dinner, cab, groceries…"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Amount">
              <AmountInput
                name="amount"
                required
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </Field>
            <Field label="Paid by">
              <Select name="paidById" defaultValue={youMemberId}>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.isYou ? "You" : m.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Date">
            <Input
              type="date"
              name="date"
              required
              defaultValue={toDateInputValue(new Date())}
            />
          </Field>

          <div>
            <span className="mb-1.5 block text-xs font-medium text-ink-700">
              Split
            </span>
            <div className="mb-3 grid grid-cols-3 gap-1 rounded-xl bg-ink-100 p-1">
              {SPLIT_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setSplitType(t)}
                  aria-pressed={splitType === t}
                  className={clsx(
                    "truncate rounded-lg px-1 py-2 text-xs font-semibold transition",
                    splitType === t
                      ? "bg-surface text-ink-900 shadow-sm"
                      : "text-ink-600 hover:bg-surface/60",
                  )}
                >
                  {SPLIT_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
            <SplitEditor
              key={splitType}
              members={members}
              splitType={splitType}
              total={parseRupees(amount)}
            />
          </div>

          <ErrorNote message={error} />

          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={pending} className="flex-1">
              {pending ? "Saving…" : "Add expense"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Sheet>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Settle up                                                           */
/* ------------------------------------------------------------------ */

export function SettleUpButton({
  groupId,
  members,
  youMemberId,
  debt,
  label = "Settle up",
  variant = "secondary",
  className,
}: {
  groupId: string;
  members: GroupMemberDTO[];
  youMemberId: string;
  debt?: GroupDebt;
  label?: string;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const { pending, error, run, router } = useAction();

  const defaultFrom = debt?.fromId ?? youMemberId;
  const defaultTo =
    debt?.toId ?? members.find((m) => m.id !== defaultFrom)?.id ?? "";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    run(
      () => settleGroupDebt(groupId, formData),
      () => {
        setOpen(false);
        router.refresh();
      },
    );
  }

  const options = members.map((m) => (
    <option key={m.id} value={m.id}>
      {m.isYou ? "You" : m.name}
    </option>
  ));

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={debt ? "sm" : "md"}
        onClick={() => setOpen(true)}
        className={className}
      >
        {label}
      </Button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Record a payment"
        description="Both people get an email."
      >
        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Paid by">
              <Select name="fromMemberId" defaultValue={defaultFrom}>
                {options}
              </Select>
            </Field>
            <Field label="Paid to">
              <Select name="toMemberId" defaultValue={defaultTo}>
                {options}
              </Select>
            </Field>
          </div>
          <Field label="Amount">
            <AmountInput
              name="amount"
              required
              autoFocus
              placeholder="0"
              defaultValue={debt ? (debt.amount / 100).toString() : ""}
            />
          </Field>
          <Field label="Date">
            <Input
              type="date"
              name="date"
              required
              defaultValue={toDateInputValue(new Date())}
            />
          </Field>
          <ErrorNote message={error} />
          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={pending} className="flex-1">
              {pending ? "Saving…" : "Record payment"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Sheet>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Activity detail                                                     */
/* ------------------------------------------------------------------ */

export function ActivityItemButton({
  item,
  children,
}: {
  item: GroupActivity;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { pending, error, run, router } = useAction();

  function handleDelete() {
    run(
      () =>
        item.kind === "EXPENSE"
          ? deleteGroupExpense(item.id)
          : deleteGroupSettlement(item.id),
      () => {
        setOpen(false);
        router.refresh();
      },
    );
  }

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
        title={item.kind === "EXPENSE" ? item.description : "Payment"}
        description={formatDay(new Date(item.date))}
      >
        <div className="space-y-4 p-5">
          {item.kind === "EXPENSE" ? (
            <>
              <p className="text-sm text-ink-700">
                <span className="font-semibold text-ink-900">
                  {item.paidBy.name}
                </span>{" "}
                paid{" "}
                <span className="tabular font-semibold text-ink-900">
                  {formatINRCompact(item.amount)}
                </span>
                , split {SPLIT_TYPE_LABELS[item.splitType].toLowerCase()}.
              </p>
              <ul className="divide-y divide-ink-100 rounded-xl border border-ink-200">
                {item.shares.map((s) => (
                  <li
                    key={s.memberId}
                    className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
                  >
                    <span className="min-w-0 truncate text-ink-800">
                      {s.name}
                    </span>
                    <span className="tabular shrink-0 font-medium text-ink-900">
                      {formatINRCompact(s.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-ink-700">
              <span className="font-semibold text-ink-900">
                {item.from.name}
              </span>{" "}
              paid{" "}
              <span className="font-semibold text-ink-900">{item.to.name}</span>{" "}
              <span className="tabular font-semibold text-ink-900">
                {formatINRCompact(item.amount)}
              </span>
              .
            </p>
          )}

          <ErrorNote message={error} />

          <div className="flex gap-2">
            <Button
              type="button"
              variant="danger"
              onClick={handleDelete}
              disabled={pending}
            >
              {pending ? "Deleting…" : "Delete"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
              className="flex-1"
            >
              Close
            </Button>
          </div>
        </div>
      </Sheet>
    </>
  );
}
