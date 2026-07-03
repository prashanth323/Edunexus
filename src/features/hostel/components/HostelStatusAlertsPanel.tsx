import { useQuery } from "@tanstack/react-query"
import { Home, Loader2 } from "lucide-react"
import { format } from "date-fns"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getRecentHostelStatusNotifications } from "../api/hostelStatus.api"

type Props = {
  title?: string
  description?: string
  limit?: number
  /** VP dashboard should only show VP-targeted alerts, not parent copies. */
  audience?: "vp" | "parent" | "all"
}

export function HostelStatusAlertsPanel({
  title = "Hostel status updates",
  description = "Recent hostel attendance and leave updates for your students.",
  limit = 8,
  audience = "all",
}: Props) {
  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ["hostel-status-notifications", limit, audience],
    queryFn: () =>
      getRecentHostelStatusNotifications(
        limit,
        audience === "vp" ? "vp" : audience === "parent" ? "parent" : "all",
      ),
  })

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (alerts.length === 0) return null

  return (
    <Card className="border-amber-500/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Home className="h-4 w-4 text-amber-600" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {alerts.map((alert) => (
          <div key={alert.id} className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-medium">{alert.title}</p>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {format(new Date(alert.created_at), "dd MMM yyyy, h:mm a")}
              </span>
            </div>
            <p className="text-muted-foreground mt-1">{alert.body}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
