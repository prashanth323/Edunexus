import { Link } from "react-router-dom"
import { AlertTriangle } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ATTENDANCE_STATUS_BADGE_CLASSES } from "../lib/dailyAttendanceRead"

type Props = {
  status: string
  remarks?: string | null
  linkTo?: string
}

export function AttendanceTodayBanner({ status, remarks, linkTo = "/attendance" }: Props) {
  if (!["absent", "late", "half_day"].includes(status)) return null

  return (
    <Card className="border-amber-500/40 bg-amber-500/5">
      <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Today&apos;s attendance</p>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <Badge
                className={`capitalize ${ATTENDANCE_STATUS_BADGE_CLASSES[status] ?? ""}`}
                variant="default"
              >
                {status.replace(/_/g, " ")}
              </Badge>
              {remarks ? <span className="text-sm text-muted-foreground">{remarks}</span> : null}
            </div>
          </div>
        </div>
        <Link to={linkTo} className="text-sm text-primary underline shrink-0">
          View details
        </Link>
      </CardContent>
    </Card>
  )
}
