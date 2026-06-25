import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { getApprovedFeeCatalog, type FeeCatalogRow } from "@/features/finance/api/feePlans.api"

export function AdmissionsFeeCatalog() {
  const activeSchoolId = useAuth((s) => s.activeSchoolId)

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["fee-catalog", activeSchoolId],
    queryFn: () => getApprovedFeeCatalog(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const byClass = useMemo(() => {
    const map = new Map<string, { className: string; terms: Map<string, FeeCatalogRow[]> }>()
    for (const row of rows) {
      let cls = map.get(row.class_id)
      if (!cls) {
        cls = { className: row.class_name, terms: new Map() }
        map.set(row.class_id, cls)
      }
      const key = `${row.term_order}-${row.term_label}`
      const list = cls.terms.get(key) ?? []
      list.push(row)
      cls.terms.set(key, list)
    }
    return map
  }, [rows])

  if (isLoading) return <p className="text-muted-foreground">Loading fee catalog…</p>

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No VP-approved fee plans yet. Ask the head accountant to submit class fee plans.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Term-wise fees approved by the Vice Principal — share with parents during admission.
      </p>
      {Array.from(byClass.entries()).map(([classId, { className, terms }]) => (
        <Card key={classId}>
          <CardHeader>
            <CardTitle className="text-lg">{className}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from(terms.entries()).map(([termKey, items]) => {
              const term = items[0]
              const termTotal = items.reduce((s, i) => s + Number(i.amount), 0)
              return (
                <div key={termKey} className="border rounded-lg p-3">
                  <div className="flex justify-between items-baseline mb-2">
                    <span className="font-medium">{term.term_label}</span>
                    <span className="text-sm text-muted-foreground">
                      Due: {term.due_date ?? "TBD"} · Total ₹{termTotal.toLocaleString()}
                    </span>
                  </div>
                  <ul className="text-sm space-y-1">
                    {items.map((i, idx) => (
                      <li key={idx} className="flex justify-between">
                        <span>{i.item_name}</span>
                        <span>₹{Number(i.amount).toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
