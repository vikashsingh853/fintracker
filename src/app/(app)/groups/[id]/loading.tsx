import { Card } from "@/components/ui";
import {
  ListCardSkeleton,
  LoadingRegion,
  Skeleton,
} from "@/components/skeleton";

export default function GroupLoading() {
  return (
    <LoadingRegion label="Loading group">
      <div className="space-y-5">
        <Skeleton className="h-3 w-20" />
        <Card>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-2 h-3 w-48" />
          <Skeleton className="mt-4 h-16 w-full rounded-xl" />
          <div className="mt-4 flex gap-2">
            <Skeleton className="h-10 flex-1 rounded-xl" />
            <Skeleton className="h-10 w-28 rounded-xl" />
          </div>
        </Card>
        <ListCardSkeleton rows={3} />
        <ListCardSkeleton rows={4} />
      </div>
    </LoadingRegion>
  );
}
