"use client";

import { Search, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export function PartySearch() {
  const router = useRouter();
  const params = useSearchParams();
  const initial = params.get("q") ?? "";
  const [value, setValue] = useState(initial);

  // Debounce so typing doesn't fire a navigation per keystroke.
  useEffect(() => {
    if (value === initial) return;
    const timer = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set("q", value);
      else next.delete("q");
      router.replace(`/khata?${next.toString()}`);
    }, 250);
    return () => clearTimeout(timer);
  }, [value, initial, params, router]);

  return (
    <div className="relative">
      <Search
        size={16}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
      />
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search by name or number"
        aria-label="Search contacts"
        className="w-full rounded-xl border border-ink-300 bg-surface py-2.5 pl-9 pr-9 text-sm text-ink-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
      />
      {value && (
        <button
          type="button"
          onClick={() => setValue("")}
          aria-label="Clear search"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-ink-400 transition hover:bg-ink-100 hover:text-ink-700"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
