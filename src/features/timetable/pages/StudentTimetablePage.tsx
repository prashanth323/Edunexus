import { useQuery } from "@tanstack/react-query"
import { CalendarDays, BookOpen, UserCheck } from "lucide-react"

import { useAuth } from "@/features/auth/hooks/useAuth"
import { getMyStudentTimetable, DAY_LABELS } from "../api/timetable.api"
import { TimetableGrid } from "../components/TimetableGrid"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export function StudentTimetablePage() {
  const { user, activeSchoolId } = useAuth()

  const { data: slots = [], isLoading } = useQuery({
    queryKey: ["student-timetable", user?.id, activeSchoolId],
    queryFn: () => getMyStudentTimetable(user!.id, activeSchoolId!),
    enabled: !!user?.id && !!activeSchoolId,
  })

  // Derive context from first slot
  const firstSlot = slots[0]
  const className = firstSlot?.class_name
  const sectionName = firstSlot?.section_name

  // Today's periods
  const todayIndex = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1 // Mon=0...Sat=5
  const todaySlots = slots
    .filter((s) => s.day_of_week === todayIndex)
    .sort((a, b) => a.period_no - b.period_no)

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <CalendarDays className="h-7 w-7 text-primary" />
          My Timetable
        </h1>
        {className && (
          <p className="text-muted-foreground mt-1">
            {className} – Section {sectionName}
          </p>
        )}
      </div>

      {/* Not enrolled state */}
      {!isLoading && slots.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-20 text-center gap-4">
          <CalendarDays className="h-12 w-12 text-muted-foreground/30" />
          <div>
            <p className="font-semibold text-muted-foreground">No timetable available</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Your class timetable will appear here once the principal has set it up.
            </p>
          </div>
        </div>
      )}

      {/* Today highlight */}
      {!isLoading && todaySlots.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              Today — {DAY_LABELS[todayIndex]}
            </CardTitle>
            <CardDescription>{todaySlots.length} class{todaySlots.length !== 1 ? "es" : ""} today</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {todaySlots.map((slot) => (
                <div
                  key={slot.timetable_id}
                  className="flex items-start gap-3 bg-background border rounded-lg px-3 py-2.5"
                >
                  <div className="flex flex-col items-center justify-center bg-primary/10 text-primary rounded-lg w-10 h-10 shrink-0">
                    <span className="text-[10px] font-bold leading-none">P</span>
                    <span className="text-sm font-bold leading-none">{slot.period_no}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm leading-tight truncate">{slot.subject_name}</p>
                    {slot.teacher_name && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <UserCheck className="h-3 w-3 shrink-0" />
                        {slot.teacher_name}
                      </p>
                    )}
                    {slot.start_time && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {slot.start_time.slice(0, 5)}–{slot.end_time?.slice(0, 5)}
                        {slot.room_no ? ` · ${slot.room_no}` : ""}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Weekly grid */}
      {(isLoading || slots.length > 0) && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle>Full weekly timetable</CardTitle>
                <CardDescription>Monday to Saturday · read-only view</CardDescription>
              </div>
              {!isLoading && (
                <Badge variant="outline" className="text-xs">
                  Today: {DAY_LABELS[todayIndex]}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <TimetableGrid slots={slots} loading={isLoading} />
          </CardContent>
        </Card>
      )}

      {/* Subject summary */}
      {!isLoading && slots.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Subjects this term
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {[...new Map(slots.map((s) => [s.subject_id, s])).values()].map((s) => (
                <div key={s.subject_id} className="flex items-start gap-2 bg-muted/30 border rounded-lg px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium text-sm">{s.subject_name}</p>
                    {s.teacher_name && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <UserCheck className="h-3 w-3 shrink-0" />
                        {s.teacher_name}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
