import clsx from "clsx";
import type { CSSProperties, ReactNode } from "react";
import { Card } from "./ui";

/** A single shimmering placeholder block. */
export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return <span className={clsx("skeleton block", className)} style={style} aria-hidden />;
}

/**
 * Screen readers get a single polite announcement rather than a wall of
 * meaningless placeholder nodes.
 */
export function LoadingRegion({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

export function StatTileSkeleton() {
  return (
    <div className="rounded-xl border border-ink-200/80 bg-surface p-3.5">
      <Skeleton className="h-2.5 w-20" />
      <Skeleton className="mt-2.5 h-5 w-24" />
      <Skeleton className="mt-2 h-2 w-16" />
    </div>
  );
}

export function RowSkeleton({ lines = 2 }: { lines?: number }) {
  return (
    <div className="flex items-center gap-3 px-2 py-3">
      <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-3 w-2/5" />
        {lines > 1 && <Skeleton className="h-2.5 w-3/5" />}
      </div>
      <div className="shrink-0 space-y-1.5 text-right">
        <Skeleton className="ml-auto h-3 w-16" />
        <Skeleton className="ml-auto h-2.5 w-10" />
      </div>
    </div>
  );
}

export function ListCardSkeleton({ rows = 4, title = true }: { rows?: number; title?: boolean }) {
  return (
    <Card padded={false}>
      {title && (
        <div className="space-y-2 px-4 pt-4">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-2.5 w-44" />
        </div>
      )}
      <div className="divide-y divide-ink-100 p-2">
        {Array.from({ length: rows }).map((_, i) => (
          <RowSkeleton key={i} />
        ))}
      </div>
    </Card>
  );
}

export function BarListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <Card>
      <div className="mb-4 space-y-2">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-2.5 w-40" />
      </div>
      <div className="space-y-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
        ))}
      </div>
    </Card>
  );
}

/** Mirrors the Safe-to-Spend hero so the swap doesn't shift the layout. */
export function HeroSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-brand-700 via-brand-600 to-indigo-500 p-5 sm:p-6">
      <span className="skeleton block h-2.5 w-40 !bg-white/25" aria-hidden />
      <span className="skeleton mt-3 block h-10 w-52 !bg-white/25" aria-hidden />
      <span className="skeleton mt-3 block h-3 w-full max-w-sm !bg-white/20" aria-hidden />
      <div className="mt-5 grid grid-cols-3 gap-3 border-t border-white/20 pt-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <span className="skeleton mx-auto block h-2 w-14 !bg-white/20" aria-hidden />
            <span className="skeleton mx-auto block h-3 w-16 !bg-white/25" aria-hidden />
          </div>
        ))}
      </div>
    </div>
  );
}

export function PageHeaderSkeleton() {
  return (
    <div className="mb-5 space-y-2">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-6 w-40" />
    </div>
  );
}
