import { useQuery } from "@tanstack/react-query"
import { format } from "date-fns"
import { Home, History } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { getStudentHostelStatusInfo } from "../api/hostelStatus.api"
import { HOSTEL_LEAVE_STATUSES } from "../lib/hostelStatusLabels"

export function StudentHostelStatusPanel({
  studentId,
  transportMode,
}: {
  studentId: string
  transportMode?: string | null
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["student-hostel-status", studentId],
    queryFn: () => getStudentHostelStatusInfo(studentId),
    enabled: !!studentId && transportMode === "hostel",
  })

  if (transportMode !== "hostel") return null

  if (isLoading) {
    return (
      <div className="pt-3 border-t space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  if (!data || (!data.current_status && data.events.length === 0)) {
    return (
      <p className="text-xs text-muted-foreground pt-3 border-t">
        No hostel status history recorded yet.
      </p>
    )
  }

  const roomLabel =
    data.room_no || data.block
      ? `${data.block ? `${data.block} / ` : ""}${data.room_no ?? ""}`.trim()
      : null

  const onLeave = data.current_status && HOSTEL_LEAVE_STATUSES.has(data.current_status)

  return (
    <div className="pt-3 border-t space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
          <Home className="h-3.5 w-3.5" />
          Hostel status
        </span>
        {data.current_status_label && (
          <Badge variant={onLeave ? "secondary" : "outline"} className="text-xs">
            {data.current_status_label}
          </Badge>
        )}
        {data.status_updated_at && (
          <span className="text-xs text-muted-foreground">
            Updated {format(new Date(data.status_updated_at), "dd MMM yyyy")}
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Adm. no. <span className="font-mono text-foreground">{data.admission_no}</span>
        {roomLabel ? ` · Room ${roomLabel}` : null}
      </p>

      {data.events.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <History className="h-3.5 w-3.5" />
            Status history
          </p>
          <ul className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
            {data.events.map((ev) => (
              <li
                key={ev.event_id}
                className="text-xs border rounded-md px-2.5 py-2 bg-muted/30 flex flex-col gap-0.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{ev.status_label}</span>
                  <span className="text-muted-foreground shrink-0">
                    {format(new Date(ev.recorded_at), "dd MMM yyyy, h:mm a")}
                  </span>
                </div>
                {ev.notes ? (
                  <span className="text-muted-foreground">{ev.notes}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
