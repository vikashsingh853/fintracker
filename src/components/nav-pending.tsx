"use client";

import { useLinkStatus } from "next/link";

/**
 * Instant feedback on navigation. `useLinkStatus` reports the pending state of
 * the enclosing <Link>, so a click acknowledges itself immediately even while
 * the server is still assembling the page.
 */
export function NavPending() {
  const { pending } = useLinkStatus();
  if (!pending) return null;

  return (
    <span
      role="status"
      aria-label="Loading"
      className="absolute inset-x-2 -bottom-0.5 h-0.5 overflow-hidden rounded-full bg-brand-600/20"
    >
      <span className="block h-full w-1/2 animate-[shimmer_1s_infinite] bg-brand-600" />
    </span>
  );
}
