import { supabase } from "@/lib/supabase"

export type MonthlyChartRow = { month: string; collected: number }

function dayKey(raw: unknown): string {
  if (raw == null) return ""
  const s = String(raw)
  return s.length >= 10 ? s.slice(0, 10) : s
}

function labelFromDay(day: string): string {
  const d = new Date(`${day}T12:00:00`)
  if (Number.isNaN(d.getTime())) return day
  return d.toLocaleString("default", { month: "short", year: "numeric" })
}

/** Aggregates `v_monthly_collections` (multiple rows per month from payment method) for charts. */
export async function fetchMonthlyCollectionChartSeries(
  schoolId: string,
): Promise<MonthlyChartRow[]> {
  const { data, error } = await supabase
    .from("v_monthly_collections")
    .select("month, total_collected")
    .eq("school_id", schoolId)
    .order("month", { ascending: true })

  if (error) throw error

  const agg = new Map<string, number>()
  for (const row of data ?? []) {
    const key = dayKey(row.month)
    if (!key) continue
    agg.set(key, (agg.get(key) ?? 0) + Number(row.total_collected))
  }

  return Array.from(agg.entries()).map(([day, collected]) => ({
    month: labelFromDay(day),
    collected,
  }))
}
