import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { getSectionAttendanceSnapshot, type SectionAttendanceSnapshotRow } from "../api/attendance.api"

type SectionGroup = {
  sectionId: string
  label: string
  absentRolls: string[]
  lateHalfDay: { roll: string; name: string; status: string; remarks: string | null }[]
}

function groupSnapshot(rows: SectionAttendanceSnapshotRow[]): SectionGroup[] {
  const map = new Map<string, SectionGroup>()

  for (const row of rows) {
    let g = map.get(row.section_id)
    if (!g) {
      g = {
        sectionId: row.section_id,
        label: `${row.class_name} – ${row.section_name}`,
        absentRolls: [],
        lateHalfDay: [],
      }
      map.set(row.section_id, g)
    }

    if (row.status === "absent") {
      g.absentRolls.push(row.roll_no?.trim() || row.student_name)
    } else if (row.status === "late" || row.status === "half_day") {
      g.lateHalfDay.push({
        roll: row.roll_no?.trim() || "—",
        name: row.student_name,
        status: row.status,
        remarks: row.remarks,
      })
    }
  }

  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label))
}

export function VpClassAttendancePanel() {
  const activeSchoolId = useAuth((s) => s.activeSchoolId)
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["section-attendance-snapshot", activeSchoolId, date],
    queryFn: () => getSectionAttendanceSnapshot(activeSchoolId!, date),
    enabled: !!activeSchoolId,
  })

  const sections = useMemo(() => groupSnapshot(rows), [rows])
  const hasAny = sections.some((s) => s.absentRolls.length > 0 || s.lateHalfDay.length > 0)

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <CardTitle>Class attendance today</CardTitle>
          <CardDescription>Absent roll numbers and late/half-day marks with receptionist remarks</CardDescription>
        </div>
        <Input type="date" className="w-auto" value={date} onChange={(e) => setDate(e.target.value)} />
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !hasAny ? (
          <p className="text-sm text-muted-foreground">No absent, late, or half-day students for this date.</p>
        ) : (
          sections.map((sec) => {
            if (sec.absentRolls.length === 0 && sec.lateHalfDay.length === 0) return null
            return (
              <div key={sec.sectionId} className="border rounded-lg p-4 space-y-3">
                <h3 className="font-semibold">{sec.label}</h3>
                {sec.absentRolls.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Absent (roll no.)</p>
                    <p className="text-sm font-mono">{sec.absentRolls.join(", ")}</p>
                  </div>
                )}
                {sec.lateHalfDay.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Late / half day</p>
                    <ul className="text-sm space-y-1">
                      {sec.lateHalfDay.map((item, i) => (
                        <li key={i} className="flex flex-wrap items-baseline gap-2">
                          <span className="font-mono">{item.roll}</span>
                          <span>{item.name}</span>
                          <Badge variant="secondary">{item.status.replace(/_/g, " ")}</Badge>
                          {item.remarks ? (
                            <span className="text-muted-foreground">— {item.remarks}</span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
