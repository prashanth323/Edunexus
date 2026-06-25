import { useState } from "react"
import { useQuery } from "@tanstack/react-query"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { getHomeroomSections } from "@/features/dashboard/api/dashboard.api"
import { getTimetableForSection } from "@/features/timetable/api/timetable.api"
import { TimetableGrid } from "@/features/timetable/components/TimetableGrid"

export function ClassTeacherTimetableTab() {
  const user = useAuth((s) => s.user)
  const activeSchoolId = useAuth((s) => s.activeSchoolId)

  const { data: homerooms = [], isLoading: homeroomsLoading } = useQuery({
    queryKey: ["homeroom-sections", user?.id, activeSchoolId],
    queryFn: () => getHomeroomSections(user!.id, activeSchoolId!),
    enabled: !!user?.id && !!activeSchoolId,
  })

  const [sectionId, setSectionId] = useState<string | null>(null)

  const effectiveSectionId = sectionId ?? homerooms[0]?.section_id ?? null

  const { data: slots = [], isLoading: slotsLoading } = useQuery({
    queryKey: ["class-teacher-timetable", effectiveSectionId],
    queryFn: () => getTimetableForSection(effectiveSectionId!),
    enabled: !!effectiveSectionId,
  })

  const selected = homerooms.find((h) => h.section_id === effectiveSectionId)

  if (!activeSchoolId) return null

  if (homeroomsLoading) {
    return <p className="text-sm text-muted-foreground p-4">Loading homeroom sections…</p>
  }

  if (homerooms.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          You are not assigned as class teacher for any section yet.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <CardTitle>Class timetable</CardTitle>
          <CardDescription>Weekly schedule for your homeroom section</CardDescription>
        </div>
        {homerooms.length > 1 && (
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={effectiveSectionId ?? ""}
            onChange={(e) => setSectionId(e.target.value || null)}
          >
            {homerooms.map((h) => (
              <option key={h.section_id} value={h.section_id}>
                {h.class_name} – {h.section_name}
              </option>
            ))}
          </select>
        )}
      </CardHeader>
      <CardContent>
        {selected && (
          <p className="text-sm text-muted-foreground mb-4">
            {selected.class_name} – {selected.section_name}
          </p>
        )}
        <TimetableGrid slots={slots} loading={slotsLoading} />
      </CardContent>
    </Card>
  )
}
