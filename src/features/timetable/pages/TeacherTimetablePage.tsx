import { useQuery } from "@tanstack/react-query"
import { CalendarDays, BookOpen, Users } from "lucide-react"

import { useAuth } from "@/features/auth/hooks/useAuth"
import { getMyTeacherTimetable, DAY_LABELS } from "../api/timetable.api"
import { TimetableGrid } from "../components/TimetableGrid"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export function TeacherTimetablePage() {
  const { user, activeSchoolId } = useAuth()

  const { data: slots = [], isLoading } = useQuery({
    queryKey: ["teacher-timetable", user?.id, activeSchoolId],
    queryFn: () => getMyTeacherTimetable(user!.id, activeSchoolId!),
    enabled: !!user?.id && !!activeSchoolId,
  })

  // Stats
  const uniqueSections = new Set(slots.map((s) => s.section_id)).size
  const uniqueSubjects = new Set(slots.map((s) => s.subject_id)).size

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
        <p className="text-muted-foreground mt-1">Your weekly teaching schedule across all sections.</p>
      </div>

      {/* Stat pills */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-sm font-medium">
          <CalendarDays className="h-4 w-4" />
          {slots.length} period{slots.length !== 1 ? "s" : ""} / week
        </div>
        <div className="flex items-center gap-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full px-4 py-1.5 text-sm font-medium">
          <Users className="h-4 w-4" />
          {uniqueSections} section{uniqueSections !== 1 ? "s" : ""}
        </div>
        <div className="flex items-center gap-2 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-full px-4 py-1.5 text-sm font-medium">
          <BookOpen className="h-4 w-4" />
          {uniqueSubjects} subject{uniqueSubjects !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Today's schedule highlight */}
      {!isLoading && todaySlots.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              Today — {DAY_LABELS[todayIndex]}
            </CardTitle>
            <CardDescription>{todaySlots.length} period{todaySlots.length !== 1 ? "s" : ""} today</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {todaySlots.map((slot) => (
                <div
                  key={slot.timetable_id}
                  className="flex items-center gap-2 bg-background border rounded-lg px-3 py-2 text-sm"
                >
                  <span className="font-bold text-primary text-xs w-8 shrink-0">P{slot.period_no}</span>
                  <div>
                    <p className="font-medium leading-tight">{slot.subject_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {slot.class_name} – {slot.section_name}
                      {slot.start_time && ` · ${slot.start_time.slice(0, 5)}`}
                      {slot.room_no && ` · ${slot.room_no}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Weekly grid */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Weekly schedule</CardTitle>
              <CardDescription>Full week view — Mon to Sat</CardDescription>
            </div>
            {!isLoading && (
              <Badge variant="outline" className="text-xs">
                {DAY_LABELS[todayIndex]}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <TimetableGrid slots={slots} loading={isLoading} />
        </CardContent>
      </Card>

      {/* Subject legend */}
      {!isLoading && slots.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">My subjects this week</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {[...new Map(slots.map((s) => [s.subject_id, s])).values()].map((s) => (
                <div
                  key={s.subject_id}
                  className="text-xs font-medium px-3 py-1 rounded-full border bg-muted/30"
                >
                  {s.subject_name}
                  {s.subject_code ? ` (${s.subject_code})` : ""}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
