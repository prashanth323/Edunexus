import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export function StatCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn(className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-4 rounded" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-20 mb-2" />
        <Skeleton className="h-3 w-32" />
      </CardContent>
    </Card>
  )
}

export function StatCardSkeletonGrid({
  count = 4,
  className,
  columnsClassName = "grid gap-4 md:grid-cols-2 lg:grid-cols-4",
}: {
  count?: number
  className?: string
  columnsClassName?: string
}) {
  return (
    <div className={cn(columnsClassName, className)}>
      {Array.from({ length: count }, (_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  )
}

export function CourseOrNoticeCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn("overflow-hidden flex flex-col", className)}>
      <Skeleton className="aspect-video w-full rounded-none rounded-t-lg" />
      <CardHeader className="pb-2 space-y-3">
        <div className="flex justify-between gap-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-5 rounded" />
        </div>
        <Skeleton className="h-5 w-3/4 max-w-[240px]" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </CardHeader>
      <CardContent className="pt-0">
        <Skeleton className="h-3 w-24" />
      </CardContent>
      <CardFooter className="mt-auto border-t pt-4 gap-2">
        <Skeleton className="h-9 flex-1" />
        <Skeleton className="h-9 flex-1" />
      </CardFooter>
    </Card>
  )
}

export function CourseCardSkeletonGrid({
  count = 6,
  className,
  columnsClassName = "grid gap-4 md:grid-cols-2 lg:grid-cols-3",
}: {
  count?: number
  className?: string
  columnsClassName?: string
}) {
  return (
    <div className={cn(columnsClassName, className)}>
      {Array.from({ length: count }, (_, i) => (
        <CourseOrNoticeCardSkeleton key={i} />
      ))}
    </div>
  )
}

export function GenericCardSkeleton({
  className,
  withAccent = false,
  rows = 2,
}: {
  className?: string
  /** Top color bar (e.g. parent dashboard child cards). */
  withAccent?: boolean
  rows?: number
}) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      {withAccent ? <Skeleton className="h-2 w-full rounded-none" /> : null}
      <CardHeader className="flex flex-row items-start gap-4">
        <Skeleton className="h-14 w-14 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className="h-4 w-full max-w-md" />
        ))}
      </CardContent>
    </Card>
  )
}

export function TableSkeletonRows({
  rows = 6,
  cols = 3,
  className,
}: {
  rows?: number
  cols?: number
  className?: string
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: rows }, (_, ri) => (
        <div key={ri} className="flex gap-3">
          {Array.from({ length: cols }, (_, ci) => (
            <Skeleton key={ci} className="h-10 flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}

export function DirectoryCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn(className)}>
      <CardHeader className="flex flex-row items-start gap-3 pb-2">
        <Skeleton className="h-12 w-12 rounded-full shrink-0" />
        <div className="flex-1 space-y-2 min-w-0">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-3 w-48" />
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
      </CardContent>
    </Card>
  )
}

/** Matches staff directory cards (banner + centered avatar + contact rows). */
export function StaffDirectoryCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="p-0">
        <Skeleton className="h-16 w-full rounded-none" />
        <div className="flex justify-center -mt-10 mb-2">
          <Skeleton className="h-20 w-20 rounded-full border-4 border-background" />
        </div>
        <div className="text-center px-4 pb-2 space-y-2">
          <Skeleton className="h-6 w-40 mx-auto" />
          <Skeleton className="h-4 w-28 mx-auto" />
          <Skeleton className="h-5 w-20 mx-auto rounded-full" />
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-2 bg-muted/10 border-t space-y-3">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-4 w-4 rounded shrink-0" />
            <Skeleton className="h-4 flex-1 max-w-[200px]" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export function StaffDirectorySkeletonGrid({
  count = 8,
  className,
  columnsClassName = "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mt-4",
}: {
  count?: number
  className?: string
  columnsClassName?: string
}) {
  return (
    <div className={cn(columnsClassName, className)}>
      {Array.from({ length: count }, (_, i) => (
        <StaffDirectoryCardSkeleton key={i} />
      ))}
    </div>
  )
}

/** LMS course player: lesson list + main content panels. */
export function CoursePlayerPageSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col gap-4 animate-in fade-in duration-500", className)}>
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,280px)_1fr] items-start">
        <Card className="min-w-0">
          <CardHeader className="pb-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-24 mt-2" />
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-md" />
            ))}
          </CardContent>
        </Card>
        <Card className="min-w-0">
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-full max-w-md mt-2" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="aspect-video w-full max-w-3xl rounded-md" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full max-w-xl" />
            <Skeleton className="h-4 w-full max-w-sm" />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
