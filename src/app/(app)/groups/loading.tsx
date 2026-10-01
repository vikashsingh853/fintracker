import { Card } from "@/components/ui";
import {
  ListCardSkeleton,
  LoadingRegion,
  PageHeaderSkeleton,
  Skeleton,
} from "@/components/skeleton";

export default function GroupsLoading() {
  return (
    <LoadingRegion label="Loading your groups">
      <div className="space-y-5">
        <PageHeaderSkeleton />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i} className="!p-3.5">
              <Skeleton className="h-2.5 w-24" />
              <Skeleton className="mt-2.5 h-5 w-28" />
            </Card>
          ))}
        </div>
        <ListCardSkeleton rows={4} title={false} />
      </div>
    </LoadingRegion>
  );
}
