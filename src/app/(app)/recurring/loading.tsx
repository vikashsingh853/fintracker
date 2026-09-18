import {
  ListCardSkeleton,
  LoadingRegion,
  PageHeaderSkeleton,
  StatTileSkeleton,
} from "@/components/skeleton";

export default function RecurringLoading() {
  return (
    <LoadingRegion label="Loading your bills">
      <div className="space-y-5">
        <PageHeaderSkeleton />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatTileSkeleton key={i} />
          ))}
        </div>
        <ListCardSkeleton rows={4} />
        <ListCardSkeleton rows={5} />
      </div>
    </LoadingRegion>
  );
}
