"use client";

import clsx from "clsx";
import { Check, Plus, Search, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useState,
  useTransition,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  acceptGroupInvite,
  addGroupExpense,
  addGroupMembers,
  createGroup,
  deleteGroup,
  deleteGroupExpense,
  deleteGroupSettlement,
  leaveGroup,
  removePendingMember,
  searchPeople,
  settleGroupDebt,
  type GroupActionResult,
} from "@/lib/group-actions";
import { formatDay, toDateInputValue } from "@/lib/dates";
import { formatINRCompact } from "@/lib/money";
import { formatPhoneClient, normalisePhone } from "@/lib/phone";
import {
  SPLIT_TYPES,
  SPLIT_TYPE_LABELS,
  type GroupActivity,
  type GroupDebt,
  type GroupMemberDTO,
  type GroupPersonDTO,
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
/* Member picker                                                       */
/* ------------------------------------------------------------------ */

/** WhatsApp-style picker: find FinTrack accounts by mobile number or name. */
function MemberPicker({
  existingPhones = [],
}: {
  existingPhones?: Array<string | null>;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<GroupPersonDTO[]>([]);
  const [found, setFound] = useState<{
    query: string;
    people: GroupPersonDTO[];
  } | null>(null);

  const q = query.trim();
  const active = q.length >= 2;
  const searching = active && found?.query !== q;
  const results = active && found?.query === q ? found.people : [];
  const isFullNumber = normalisePhone(q) !== null;

  // Debounce so typing doesn't fire a server call per keystroke.
  useEffect(() => {
    if (q.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const people = await searchPeople(q).catch(() => []);
      if (!cancelled) setFound({ query: q, people });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q]);

  const taken = (p: GroupPersonDTO) =>
    p.isYou ||
    existingPhones.includes(p.phone) ||
    selected.some((s) => s.id === p.id);

  function add(person: GroupPersonDTO) {
    if (taken(person)) return;
    setSelected((s) => [...s, person]);
    setQuery("");
  }

  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {selected.map((p) => (
            <li
              key={p.id}
              className="inline-flex max-w-full items-center gap-1 rounded-full bg-brand-50 py-1 pl-3 pr-1 text-xs font-medium text-brand-700"
            >
              <input type="hidden" name="memberUserId" value={p.id} />
              <span className="truncate">{p.name}</span>
              <button
                type="button"
                onClick={() =>
                  setSelected((s) => s.filter((x) => x.id !== p.id))
                }
                aria-label={`Remove ${p.name}`}
                className="grid h-5 w-5 shrink-0 place-items-center rounded-full transition hover:bg-brand-100"
              >
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
        />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            // Enter picks the only match instead of submitting the form.
            if (e.key !== "Enter") return;
            e.preventDefault();
            if (results.length === 1) add(results[0]);
          }}
          maxLength={60}
          autoComplete="off"
          placeholder="Mobile number or name"
          aria-label="Search people on FinTrack"
          className="pl-9"
        />
      </div>

      {!active ? (
        <p className="text-[11px] text-ink-500">
          Enter a 10-digit mobile number to find anyone on FinTrack, or search
          by name among people from your groups and khata.
        </p>
      ) : searching ? (
        <p className="text-[11px] text-ink-500">Searching…</p>
      ) : results.length === 0 ? (
        <p className="text-[11px] text-ink-500">
          {isFullNumber
            ? "No FinTrack account with this number. Ask them to sign up first."
            : "No match. Try their full 10-digit mobile number."}
        </p>
      ) : (
        <ul className="divide-y divide-ink-100 rounded-xl border border-ink-200">
          {results.map((p) => {
            const added = taken(p);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  disabled={added}
                  onClick={() => add(p)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-ink-50 disabled:cursor-default disabled:hover:bg-transparent"
                >
                  <span
                    aria-hidden
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700"
                  >
                    {p.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink-900">
                      {p.isYou ? `${p.name} (you)` : p.name}
                    </span>
                    <span className="block truncate text-[11px] text-ink-500">
                      {formatPhoneClient(p.phone)}
                    </span>
                  </span>
                  {p.isYou ? (
                    <span className="shrink-0 text-[11px] text-ink-400">
                      That&apos;s you
                    </span>
                  ) : added ? (
                    <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-ink-400">
                      <Check size={13} />{" "}
                      {existingPhones.includes(p.phone) ? "In group" : "Added"}
                    </span>
                  ) : (
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-brand-600">
                      <Plus size={13} /> Add
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Create group / add members                                          */
/* ------------------------------------------------------------------ */

export function CreateGroupButton() {
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
        description="Add people who have a FinTrack account."
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

          <div>
            <span className="mb-1.5 block text-xs font-medium text-ink-700">
              Members
            </span>
            <MemberPicker />
          </div>

          <ErrorNote message={error} />

          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={pending} className="flex-1">
              {pending ? "Creating…" : "Create group"}
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

export function AddMembersButton({
  groupId,
  existingPhones,
}: {
  groupId: string;
  existingPhones: Array<string | null>;
}) {
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
        description="They're added straight away — no invite needed."
      >
        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <MemberPicker existingPhones={existingPhones} />
          <ErrorNote message={error} />
          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={pending} className="flex-1">
              {pending ? "Adding…" : "Add to group"}
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

  return (
    <span className="inline-flex flex-col items-end gap-1">
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

export function LeaveGroupButton({
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
        variant="secondary"
        size="sm"
        onClick={() => setConfirming(true)}
      >
        Leave group
      </Button>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border border-ink-200 bg-ink-50 p-3">
      <p className="text-xs text-ink-700">
        Leave &ldquo;{name}&rdquo;? Past expenses stay for the others. You can
        be added back later.
      </p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="danger"
          size="sm"
          disabled={pending}
          onClick={() =>
            run(
              () => leaveGroup(groupId),
              () => router.push("/groups"),
            )
          }
        >
          {pending ? "Leaving…" : "Yes, leave"}
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
        description="Split it with anyone in the group."
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
        description="Record money paid between members."
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
