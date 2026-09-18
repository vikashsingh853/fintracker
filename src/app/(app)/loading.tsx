import {
  BarListSkeleton,
  HeroSkeleton,
  ListCardSkeleton,
  LoadingRegion,
  PageHeaderSkeleton,
  StatTileSkeleton,
} from "@/components/skeleton";

export default function DashboardLoading() {
  return (
    <LoadingRegion label="Loading your dashboard">
      <div className="space-y-5">
        <PageHeaderSkeleton />
        <HeroSkeleton />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatTileSkeleton key={i} />
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <BarListSkeleton rows={3} />
          <ListCardSkeleton rows={4} />
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <BarListSkeleton rows={4} />
          <ListCardSkeleton rows={4} />
        </div>
      </div>
    </LoadingRegion>
  );
}
