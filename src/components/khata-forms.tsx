"use client";

import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import {
  createKhataEntry,
  createParty,
  deleteKhataEntry,
  deleteParty,
  settleParty,
  updateKhataEntry,
  updateParty,
} from "@/lib/khata-actions";
import { toDateInputValue } from "@/lib/dates";
import { PARTY_TYPES, PARTY_TYPE_LABELS } from "@/lib/types";
import type { KhataEntryDTO, KhataEntryType, PartyDTO } from "@/lib/types";
import { AmountInput, Button, ErrorNote, Field, Input, Select } from "./form";
import { Sheet } from "./sheet";

/* ------------------------------------------------------------------ */
/* Party                                                               */
/* ------------------------------------------------------------------ */

function PartyForm({
  party,
  onDone,
}: {
  party?: PartyDTO;
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
      const result = party
        ? await updateParty(party.id, formData)
        : await createParty(formData);

      if (!result.ok) {
        setError(result.error ?? "Something went wrong");
        return;
      }
      onDone();
      // Jump straight into a new contact's statement so an entry can be added.
      if (!party && result.id) router.push(`/khata/${result.id}`);
      else router.refresh();
    });
  }

  function handleDelete() {
    if (!party) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteParty(party.id);
      if (!result.ok) {
        setError(result.error ?? "Could not delete");
        return;
      }
      onDone();
      router.push("/khata");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-5">
      <Field label="Name">
        <Input
          name="name"
          required
          autoFocus
          maxLength={60}
          defaultValue={party?.name ?? ""}
          placeholder="Ramesh Kumar / Sharma Traders"
        />
      </Field>

      <Field
        label="Mobile number"
        hint="Optional — helps you reach them for reminders."
      >
        <Input
          name="phone"
          type="tel"
          inputMode="numeric"
          maxLength={15}
          defaultValue={party?.phone ?? ""}
          placeholder="98765 43210"
        />
      </Field>

      <Field label="Type">
        <Select name="type" defaultValue={party?.type ?? "CUSTOMER"}>
          {PARTY_TYPES.map((t) => (
            <option key={t} value={t}>
              {PARTY_TYPE_LABELS[t]}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Note">
        <Input
          name="note"
          maxLength={200}
          defaultValue={party?.note ?? ""}
          placeholder="Optional"
        />
      </Field>

      <ErrorNote message={error} />

      <div className="flex items-center gap-2 pt-1">
        <Button type="submit" disabled={pending} className="flex-1">
          {pending ? "Saving…" : party ? "Save changes" : "Add contact"}
        </Button>
        {party && (
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

      {party && (
        <p className="text-[11px] leading-relaxed text-ink-500">
          Deleting a contact also removes their whole statement. This can&apos;t
          be undone.
        </p>
      )}
    </form>
  );
}

export function AddPartyButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        Add contact
      </Button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Add contact"
        description="Someone you lend to or borrow from."
      >
        <PartyForm onDone={() => setOpen(false)} />
      </Sheet>
    </>
  );
}

export function EditPartyButton({ party }: { party: PartyDTO }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
      >
        Edit
      </Button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Edit contact"
        description={party.name}
      >
        <PartyForm party={party} onDone={() => setOpen(false)} />
      </Sheet>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Entries                                                             */
/* ------------------------------------------------------------------ */

function EntryForm({
  partyId,
  partyName,
  type,
  entry,
  onDone,
}: {
  partyId: string;
  partyName: string;
  type: KhataEntryType;
  entry?: KhataEntryDTO;
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [entryType, setEntryType] = useState<KhataEntryType>(
    entry?.type ?? type,
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = entry
        ? await updateKhataEntry(entry.id, formData)
        : await createKhataEntry(formData);

      if (!result.ok) {
        setError(result.error ?? "Something went wrong");
        return;
      }
      router.refresh();
      onDone();
    });
  }

  function handleDelete() {
    if (!entry) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteKhataEntry(entry.id);
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
      <input type="hidden" name="partyId" value={partyId} />
      <input type="hidden" name="type" value={entryType} />

      <div className="grid grid-cols-2 gap-1 rounded-xl bg-ink-100 p-1">
        <button
          type="button"
          onClick={() => setEntryType("GAVE")}
          aria-pressed={entryType === "GAVE"}
          className={clsx(
            "rounded-lg px-2 py-2 text-xs font-semibold transition",
            entryType === "GAVE"
              ? "bg-bad-solid text-white"
              : "text-ink-600 hover:bg-surface",
          )}
        >
          You gave
        </button>
        <button
          type="button"
          onClick={() => setEntryType("GOT")}
          aria-pressed={entryType === "GOT"}
          className={clsx(
            "rounded-lg px-2 py-2 text-xs font-semibold transition",
            entryType === "GOT"
              ? "bg-good-solid text-white"
              : "text-ink-600 hover:bg-surface",
          )}
        >
          You got
        </button>
      </div>

      <p className="rounded-xl bg-ink-50 px-3 py-2 text-[11px] leading-relaxed text-ink-600">
        {entryType === "GAVE"
          ? `You gave money or goods to ${partyName}. This increases what they owe you.`
          : `${partyName} paid you. This reduces what they owe you.`}
      </p>

      <Field label="Amount">
        <AmountInput
          name="amount"
          required
          autoFocus
          placeholder="0"
          defaultValue={entry ? (entry.amount / 100).toString() : ""}
        />
      </Field>

      <Field label="Date">
        <Input
          type="date"
          name="date"
          required
          defaultValue={toDateInputValue(
            entry ? new Date(entry.date) : new Date(),
          )}
        />
      </Field>

      <Field
        label="Due date (optional)"
        hint={
          entryType === "GAVE"
            ? `When ${partyName} should pay you back — shown on your dashboard.`
            : `When you need to pay ${partyName} — shown on your dashboard.`
        }
      >
        <Input
          type="date"
          name="dueDate"
          defaultValue={
            entry?.dueDate ? toDateInputValue(new Date(entry.dueDate)) : ""
          }
        />
      </Field>

      <Field label="Note">
        <Input
          name="note"
          maxLength={200}
          defaultValue={entry?.note ?? ""}
          placeholder="Item, bill number or reason"
        />
      </Field>

      <ErrorNote message={error} />

      <div className="flex items-center gap-2 pt-1">
        <Button type="submit" disabled={pending} className="flex-1">
          {pending ? "Saving…" : entry ? "Save changes" : "Add entry"}
        </Button>
        {entry && (
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

/** The two big action buttons at the bottom of a statement. */
export function EntryActions({ party }: { party: PartyDTO }) {
  const [openType, setOpenType] = useState<KhataEntryType | null>(null);

  return (
    <>
      <div className="fixed inset-x-0 bottom-[calc(55px+env(safe-area-inset-bottom))] z-30 border-t border-ink-200 bg-surface p-3 md:static md:mt-4 md:border-0 md:bg-transparent md:p-0">
        <div className="mx-auto flex max-w-3xl gap-2 md:max-w-none">
          <button
            type="button"
            onClick={() => setOpenType("GAVE")}
            className="flex-1 rounded-xl bg-bad-solid px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90"
          >
            You gave ₹
          </button>
          <button
            type="button"
            onClick={() => setOpenType("GOT")}
            className="flex-1 rounded-xl bg-good-solid px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90"
          >
            You got ₹
          </button>
        </div>
      </div>

      <Sheet
        open={openType !== null}
        onClose={() => setOpenType(null)}
        title={openType === "GOT" ? "You got" : "You gave"}
        description={party.name}
      >
        {openType && (
          <EntryForm
            partyId={party.id}
            partyName={party.name}
            type={openType}
            onDone={() => setOpenType(null)}
          />
        )}
      </Sheet>
    </>
  );
}

export function EditEntryButton({
  entry,
  party,
  children,
}: {
  entry: KhataEntryDTO;
  party: PartyDTO;
  children: ReactNode;
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
        title="Edit entry"
        description={party.name}
      >
        <EntryForm
          partyId={party.id}
          partyName={party.name}
          type={entry.type}
          entry={entry}
          onDone={() => setOpen(false)}
        />
      </Sheet>
    </>
  );
}

/** One-tap entry that zeroes the outstanding balance. */
export function SettleButton({ party }: { party: PartyDTO }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (party.balance === 0) return null;

  function handleSettle() {
    setError(null);
    startTransition(async () => {
      const result = await settleParty(party.id);
      if (!result.ok) {
        setError(result.error ?? "Could not settle");
        return;
      }
      router.refresh();
    });
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={handleSettle}
        disabled={pending}
      >
        {pending ? "Settling…" : "Settle up"}
      </Button>
      {error && <ErrorNote message={error} />}
    </span>
  );
}
