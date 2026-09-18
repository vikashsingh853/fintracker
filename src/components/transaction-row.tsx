import clsx from "clsx";
import { ArrowLeftRight, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { formatINRAdaptive, formatINRCompact } from "@/lib/money";
import { formatShortDay } from "@/lib/dates";
import type { TransactionDTO } from "@/lib/types";

export function TransactionRow({ transaction }: { transaction: TransactionDTO }) {
  const { type, amount, merchant, note, category, account, toAccount, date } = transaction;

  const Icon =
    type === "INCOME" ? ArrowDownLeft : type === "EXPENSE" ? ArrowUpRight : ArrowLeftRight;

  const iconTone =
    type === "INCOME"
      ? "bg-emerald-50 text-emerald-600"
      : type === "EXPENSE"
        ? "bg-rose-50 text-rose-600"
        : "bg-brand-50 text-brand-600";

  const amountTone =
    type === "INCOME"
      ? "text-money-in"
      : type === "EXPENSE"
        ? "text-ink-900"
        : "text-brand-700";

  const prefix = type === "INCOME" ? "+" : type === "EXPENSE" ? "−" : "";

  const title = merchant || note || category?.name || (type === "TRANSFER" ? "Transfer" : "—");
  const subtitle =
    type === "TRANSFER"
      ? `${account.name} → ${toAccount?.name ?? "—"}`
      : `${category?.name ?? "Uncategorised"} · ${account.name}`;

  return (
    <div className="flex items-center gap-3 px-2 py-2.5">
      <span className={clsx("grid h-9 w-9 shrink-0 place-items-center rounded-full", iconTone)}>
        <Icon size={16} strokeWidth={2.2} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink-900">{title}</span>
        <span className="block truncate text-[11px] text-ink-500">{subtitle}</span>
      </span>

      <span className="max-w-[45%] shrink-0 text-right">
        <span
          title={formatINRCompact(amount)}
          className={clsx("tabular block truncate text-sm font-semibold", amountTone)}
        >
          {prefix}
          {formatINRAdaptive(amount)}
        </span>
        <span className="block text-[11px] text-ink-400">{formatShortDay(new Date(date))}</span>
      </span>
    </div>
  );
}
