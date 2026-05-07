import { Link } from "react-router-dom"
import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ArrowRight, LayoutGrid, LayoutList } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { GenericCardSkeleton } from "@/components/ui/card-skeleton"
import { cn } from "@/lib/utils"
import { getSchools, queryKeys } from "@/features/dashboard/api/platform.api"

const INSIGHTS_LAYOUT_STORAGE = "edunexus_insights_layout"

function readStoredLayout(): "grid" | "list" {
  try {
    const v = localStorage.getItem(INSIGHTS_LAYOUT_STORAGE)
    return v === "grid" ? "grid" : "list"
  } catch {
    return "list"
  }
}

export function PlatformInsightsList() {
  const { data: schools, isLoading } = useQuery({
    queryKey: queryKeys.platformSchools,
    queryFn: getSchools,
  })

  const [layout, setLayout] = useState<"grid" | "list">(readStoredLayout)

  function setLayoutAndStore(next: "grid" | "list") {
    setLayout(next)
    try {
      localStorage.setItem(INSIGHTS_LAYOUT_STORAGE, next)
    } catch {
      /* ignore */
    }
  }

  const sorted = useMemo(() => [...(schools ?? [])].sort((a, b) => a.name.localeCompare(b.name)), [schools])

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="space-y-2">
          <div className="h-9 w-64 bg-muted animate-pulse rounded-md" />
          <div className="h-4 w-full max-w-lg bg-muted animate-pulse rounded-md" />
        </div>
        <div className="h-10 w-48 bg-muted animate-pulse rounded-md" />
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <GenericCardSkeleton key={i} rows={2} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">School insights</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Open analytics for each school — enrollment and attendance aggregates.
          </p>
        </div>
        <div className="flex shrink-0 rounded-lg border p-1 bg-muted/40">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              "gap-2 px-3",
              layout === "grid" ? "bg-background shadow-sm" : "text-muted-foreground",
            )}
            onClick={() => setLayoutAndStore("grid")}
          >
            <LayoutGrid className="h-4 w-4" aria-hidden /> Grid
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              "gap-2 px-3",
              layout === "list" ? "bg-background shadow-sm" : "text-muted-foreground",
            )}
            onClick={() => setLayoutAndStore("list")}
          >
            <LayoutList className="h-4 w-4" aria-hidden /> List
          </Button>
        </div>
      </div>

      <ul
        className={cn(
          "gap-3",
          layout === "grid" ? "grid sm:grid-cols-2" : "flex flex-col",
        )}
      >
        {sorted.map((school) => (
          <li key={school.id}>
            <Link to={`/insights/${school.id}`} className="block h-full">
              <Card
                className={cn(
                  "h-full transition-colors hover:bg-muted/40 hover:border-primary/30",
                  layout === "list" && "py-1",
                )}
              >
                {layout === "grid" ? (
                  <CardHeader className="flex flex-row items-center justify-between gap-4">
                    <div className="min-w-0">
                      <CardTitle className="text-lg truncate">{school.name}</CardTitle>
                      {school.code ? <CardDescription>Code · {school.code}</CardDescription> : null}
                    </div>
                    <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                  </CardHeader>
                ) : (
                  <CardHeader className="flex flex-row items-center justify-between gap-4 py-3">
                    <div className="min-w-0 flex-1 flex flex-col sm:flex-row sm:items-center sm:gap-8">
                      <CardTitle className="text-base font-medium truncate">{school.name}</CardTitle>
                      {school.code ? (
                        <span className="text-sm text-muted-foreground shrink-0">Code · {school.code}</span>
                      ) : (
                        <span className="text-sm text-muted-foreground shrink-0">—</span>
                      )}
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  </CardHeader>
                )}
              </Card>
            </Link>
          </li>
        ))}
      </ul>
      {!sorted.length && (
        <p className="text-center text-muted-foreground text-sm">No schools on the platform yet.</p>
      )}
    </div>
  )
}
