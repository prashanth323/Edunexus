import type { ComponentType } from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export type DashboardStatCardProps = {
  title: string
  /** Numeric value; combined with `displayValue` when both set, `displayValue` wins for the main figure. */
  value?: number
  /** Override display (e.g. formatted currency). */
  displayValue?: string
  description?: string
  icon: ComponentType<{ className?: string }>
}

export function DashboardStatCard({
  title,
  value,
  displayValue,
  description,
  icon: Icon,
}: DashboardStatCardProps) {
  const main =
    displayValue ??
    (value !== undefined ? value.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "—")

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tabular-nums">{main}</div>
        {description ? <p className="text-xs text-muted-foreground mt-1">{description}</p> : null}
      </CardContent>
    </Card>
  )
}
