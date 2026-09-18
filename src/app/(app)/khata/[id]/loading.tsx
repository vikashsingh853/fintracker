import { Card } from "@/components/ui";
import {
  ListCardSkeleton,
  LoadingRegion,
  Skeleton,
} from "@/components/skeleton";

export default function PartyLoading() {
  return (
    <LoadingRegion label="Loading statement">
      <div className="space-y-5 pb-24 md:pb-0">
        <Skeleton className="h-3 w-24" />

        <Card>
          <div className="flex items-start gap-3">
            <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-2.5 w-28" />
              <Skeleton className="h-2.5 w-32" />
            </div>
            <Skeleton className="h-7 w-14 rounded-xl" />
          </div>
          <div className="mt-4 rounded-xl border border-ink-200 p-3.5">
            <Skeleton className="h-2.5 w-24" />
            <Skeleton className="mt-2 h-6 w-32" />
          </div>
        </Card>

        <ListCardSkeleton rows={5} title={false} />
      </div>
    </LoadingRegion>
  );
}
