import {
  ListCardSkeleton,
  LoadingRegion,
  PageHeaderSkeleton,
  Skeleton,
  StatTileSkeleton,
} from "@/components/skeleton";

export default function TransactionsLoading() {
  return (
    <LoadingRegion label="Loading your transactions">
      <div className="space-y-5">
        <PageHeaderSkeleton />

        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <StatTileSkeleton key={i} />
          ))}
        </div>

        <div className="space-y-3">
          <div className="flex gap-1.5">
            {[16, 20, 18, 22].map((w, i) => (
              <Skeleton key={i} className="h-7 rounded-full" style={{ width: `${w * 4}px` }} />
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 rounded-xl" />
            ))}
          </div>
        </div>

        <ListCardSkeleton rows={4} title={false} />
        <ListCardSkeleton rows={3} title={false} />
      </div>
    </LoadingRegion>
  );
}
