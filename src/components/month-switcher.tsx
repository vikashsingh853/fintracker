import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { periodLabel, shiftPeriod } from "@/lib/dates";

/** Server-rendered month pager — keeps the page a pure server component. */
export function MonthSwitcher({ basePath, period }: { basePath: string; period: string }) {
  const previous = shiftPeriod(period, -1);
  const next = shiftPeriod(period, 1);

  return (
    <div className="flex items-center gap-1 rounded-xl border border-ink-200 bg-surface p-1">
      <Link
        href={`${basePath}?period=${previous}`}
        aria-label={`Go to ${periodLabel(previous)}`}
        className="grid h-8 w-8 place-items-center rounded-lg text-ink-500 transition hover:bg-ink-100 hover:text-ink-900"
      >
        <ChevronLeft size={16} />
      </Link>
      <span className="min-w-[120px] text-center text-xs font-semibold text-ink-800">
        {periodLabel(period)}
      </span>
      <Link
        href={`${basePath}?period=${next}`}
        aria-label={`Go to ${periodLabel(next)}`}
        className="grid h-8 w-8 place-items-center rounded-lg text-ink-500 transition hover:bg-ink-100 hover:text-ink-900"
      >
        <ChevronRight size={16} />
      </Link>
    </div>
  );
}
