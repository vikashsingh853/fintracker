import {
  BarListSkeleton,
  LoadingRegion,
  PageHeaderSkeleton,
  StatTileSkeleton,
} from "@/components/skeleton";

export default function BudgetsLoading() {
  return (
    <LoadingRegion label="Loading your budgets">
      <div className="space-y-5">
        <PageHeaderSkeleton />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatTileSkeleton key={i} />
          ))}
        </div>
        <BarListSkeleton rows={6} />
      </div>
    </LoadingRegion>
  );
}
