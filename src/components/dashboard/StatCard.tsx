import type { ComponentType } from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export type DashboardStatCardProps = {
  title: string
  /** Numeric value; combined with `displayValue` when both set, `displayValue` wins for the main figure. */
  value?: number | string
  /** Override display (e.g. formatted currency). */
  displayValue?: string
  description?: string
  icon: ComponentType<{ className?: string }>
  onClick?: () => void
  color?: "default" | "amber" | "navy" | "blue" | "emerald" | "purple" | "rose" | "indigo" | "orange" | "yellow" | "cyan" | "fuchsia" | "violet"
}

const colorMap = {
  default: {
    cardBg: "bg-card border-transparent shadow-sm",
    iconBg: "bg-primary/10",
    iconText: "text-primary",
    titleText: "text-muted-foreground",
    valueText: "text-foreground",
    descText: "text-muted-foreground",
    bgIcon: "text-primary/5",
  },
  amber: {
    cardBg: "bg-[#f6c46a] border-transparent shadow-sm",
    iconBg: "border border-slate-900/10",
    iconText: "text-slate-900",
    titleText: "text-slate-900",
    valueText: "text-slate-900",
    descText: "text-slate-800",
    bgIcon: "text-slate-900/5",
  },
  navy: {
    cardBg: "bg-[#14335c] border-transparent shadow-sm",
    iconBg: "border border-white/20",
    iconText: "text-white",
    titleText: "text-blue-100",
    valueText: "text-white",
    descText: "text-blue-200",
    bgIcon: "text-white/5",
  },
  blue: {
    cardBg: "bg-blue-100/80 dark:bg-blue-900/20 border-blue-300 dark:border-blue-800",
    iconBg: "bg-blue-200 dark:bg-blue-900/60",
    iconText: "text-blue-700 dark:text-blue-300",
    bgIcon: "text-blue-600",
  },
  emerald: {
    cardBg: "bg-emerald-100/80 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-800",
    iconBg: "bg-emerald-200 dark:bg-emerald-900/60",
    iconText: "text-emerald-700 dark:text-emerald-300",
    bgIcon: "text-emerald-600",
  },
  purple: {
    cardBg: "bg-purple-100/80 dark:bg-purple-900/20 border-purple-300 dark:border-purple-800",
    iconBg: "bg-purple-200 dark:bg-purple-900/60",
    iconText: "text-purple-700 dark:text-purple-300",
    bgIcon: "text-purple-600",
  },
  rose: {
    cardBg: "bg-rose-100/80 dark:bg-rose-900/20 border-rose-300 dark:border-rose-800",
    iconBg: "bg-rose-200 dark:bg-rose-900/60",
    iconText: "text-rose-700 dark:text-rose-300",
    bgIcon: "text-rose-600",
  },
  indigo: {
    cardBg: "bg-indigo-100/80 dark:bg-indigo-900/20 border-indigo-300 dark:border-indigo-800",
    iconBg: "bg-indigo-200 dark:bg-indigo-900/60",
    iconText: "text-indigo-700 dark:text-indigo-300",
    bgIcon: "text-indigo-600",
  },
  orange: {
    cardBg: "bg-orange-100/80 dark:bg-orange-900/20 border-orange-300 dark:border-orange-800",
    iconBg: "bg-orange-200 dark:bg-orange-900/60",
    iconText: "text-orange-700 dark:text-orange-300",
    bgIcon: "text-orange-600",
  },
  yellow: {
    cardBg: "bg-yellow-100/80 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-800",
    iconBg: "bg-yellow-200 dark:bg-yellow-900/60",
    iconText: "text-yellow-700 dark:text-yellow-300",
    bgIcon: "text-yellow-600",
  },
  cyan: {
    cardBg: "bg-cyan-100/80 dark:bg-cyan-900/20 border-cyan-300 dark:border-cyan-800",
    iconBg: "bg-cyan-200 dark:bg-cyan-900/60",
    iconText: "text-cyan-700 dark:text-cyan-300",
    bgIcon: "text-cyan-600",
  },
  fuchsia: {
    cardBg: "bg-fuchsia-100/80 dark:bg-fuchsia-900/20 border-fuchsia-300 dark:border-fuchsia-800",
    iconBg: "bg-fuchsia-200 dark:bg-fuchsia-900/60",
    iconText: "text-fuchsia-700 dark:text-fuchsia-300",
    bgIcon: "text-fuchsia-600",
  },
  violet: {
    cardBg: "bg-violet-100/80 dark:bg-violet-900/20 border-violet-300 dark:border-violet-800",
    iconBg: "bg-violet-200 dark:bg-violet-900/60",
    iconText: "text-violet-700 dark:text-violet-300",
    bgIcon: "text-violet-600",
  },
}

export function DashboardStatCard({
  title,
  value,
  displayValue,
  description,
  icon: Icon,
  onClick,
  color = "default",
}: DashboardStatCardProps) {
  const main =
    displayValue ??
    (value !== undefined ? (typeof value === "number" ? value.toLocaleString(undefined, { maximumFractionDigits: 0 }) : value) : "—")

  const theme = (colorMap[color] as any) || colorMap.default

  return (
    <Card 
      className={cn(
        "relative overflow-hidden border shadow-soft transition-all duration-300",
        theme.cardBg,
        onClick ? "cursor-pointer hover:shadow-premium hover:-translate-y-1" : "hover:shadow-premium hover:-translate-y-1"
      )}
      onClick={onClick}
    >
      <div className="absolute -right-4 -top-4 opacity-[0.03] pointer-events-none transition-transform duration-500 group-hover:scale-110">
        <Icon className={cn("h-24 w-24", theme.bgIcon)} />
      </div>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
        <CardTitle className={cn("text-sm font-semibold", theme.titleText || "text-muted-foreground")}>{title}</CardTitle>
        <div className={cn("p-2 rounded-full", theme.iconBg)}>
          <Icon className={cn("h-4 w-4", theme.iconText)} />
        </div>
      </CardHeader>
      <CardContent className="relative z-10">
        <div className={cn("text-2xl font-bold tabular-nums", theme.valueText || "text-foreground")}>{main}</div>
        {description ? <p className={cn("text-xs mt-1.5 font-medium", theme.descText || "text-muted-foreground")}>{description}</p> : null}
      </CardContent>
    </Card>
  )
}
