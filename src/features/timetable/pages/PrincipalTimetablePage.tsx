import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { CalendarDays, GraduationCap, Settings2, UserCheck } from "lucide-react"

import { useAuth } from "@/features/auth/hooks/useAuth"
import {
  getSectionsWithClassTeachers,
  getTimetableForSection,
  getSubjectsForSchool,
  getStaffForSchool,
  type SectionWithClassTeacher,
  type TimetableSlot,
} from "../api/timetable.api"
import { TimetableGrid } from "../components/TimetableGrid"
import { TimetableSlotEditor } from "../components/TimetableSlotEditor"
import { ClassTeacherAssigner } from "../components/ClassTeacherAssigner"
import { TimetableApprovalPanel } from "../components/TimetableApprovalPanel"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export function PrincipalTimetablePage() {
  const { activeSchoolId } = useAuth()
  const [selectedSectionId, setSelectedSectionId] = useState<string>("")
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorDay, setEditorDay] = useState(0)
  const [editorPeriod, setEditorPeriod] = useState(1)
  const [editorSlot, setEditorSlot] = useState<TimetableSlot | undefined>()


  // Fetch all sections with class teacher info
  const { data: sectionsData = [], isLoading: sectionsLoading } = useQuery({
    queryKey: ["sections-with-class-teachers", activeSchoolId],
    queryFn: () => getSectionsWithClassTeachers(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  // Fetch timetable for the selected section
  const { data: slots = [], isLoading: slotsLoading } = useQuery({
    queryKey: ["timetable-section", selectedSectionId],
    queryFn: () => getTimetableForSection(selectedSectionId),
    enabled: !!selectedSectionId,
  })

  // Fetch subjects and staff (for the slot editor)
  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects-school", activeSchoolId],
    queryFn: () => getSubjectsForSchool(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const { data: staff = [] } = useQuery({
    queryKey: ["staff-for-school", activeSchoolId],
    queryFn: () => getStaffForSchool(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  // Group sections by class
  const classSectionMap = new Map<string, { className: string; sections: SectionWithClassTeacher[] }>()
  for (const sec of sectionsData) {
    const key = sec.class_id
    if (!classSectionMap.has(key)) {
      classSectionMap.set(key, { className: sec.class_name, sections: [] })
    }
    classSectionMap.get(key)!.sections.push(sec)
  }
  const classes = [...classSectionMap.entries()]

  const selectedSection = sectionsData.find((s) => s.section_id === selectedSectionId)

  function handleCellClick(day: number, period: number, existing?: TimetableSlot) {
    setEditorDay(day)
    setEditorPeriod(period)
    setEditorSlot(existing)
    setEditorOpen(true)
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      <TimetableApprovalPanel />
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <CalendarDays className="h-7 w-7 text-primary" />
            Timetable Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Assign class teachers, build weekly schedules for each section.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Settings2 className="h-4 w-4" />
          {sectionsData.length} section{sectionsData.length !== 1 ? "s" : ""} total
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* LEFT: Section picker */}
        <div className="flex flex-col gap-4">
          <Card className="border-none shadow-none bg-transparent">
            <CardHeader className="px-0 pb-3 pt-0">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-primary" />
                Class Selection
              </CardTitle>
              <CardDescription>Select a class and section to manage</CardDescription>
            </CardHeader>
          </Card>

          <div className="flex flex-col gap-2">
            {sectionsLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-12 bg-muted/50 animate-pulse rounded-xl" />
                ))}
              </div>
            ) : classes.length === 0 ? (
              <div className="text-center p-8 bg-muted/20 rounded-xl border border-dashed">
                <p className="text-sm text-muted-foreground">No sections found.</p>
              </div>
            ) : (
              classes.map(([classId, { className, sections }]) => (
                <div key={classId} className="space-y-1">
                  <div className="px-3 py-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                      {className}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {sections.map((sec) => (
                      <button
                        key={sec.section_id}
                        className={cn(
                          "flex flex-col items-start px-3 py-2 rounded-xl border transition-all text-left",
                          selectedSectionId === sec.section_id
                            ? "bg-primary border-primary text-primary-foreground shadow-md shadow-primary/20"
                            : "bg-card hover:bg-muted/50 border-border text-card-foreground"
                        )}
                        onClick={() => setSelectedSectionId(sec.section_id)}
                      >
                        <span className="text-xs font-bold uppercase">Section {sec.section_name}</span>
                        <span className={cn(
                          "text-[10px] truncate w-full",
                          selectedSectionId === sec.section_id ? "text-primary-foreground/80" : "text-muted-foreground"
                        )}>
                          {sec.class_teacher_name ?? "No Teacher"}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Tips */}
          <div className="mt-4 p-4 rounded-xl bg-primary/5 border border-primary/10">
            <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-2">Quick Tips</h4>
            <ul className="text-[11px] text-muted-foreground space-y-2">
              <li className="flex gap-2">
                <span className="text-primary font-bold">1.</span>
                Choose a section from the grid above.
              </li>
              <li className="flex gap-2">
                <span className="text-primary font-bold">2.</span>
                Click any cell in the timetable to add/edit.
              </li>
              <li className="flex gap-2">
                <span className="text-primary font-bold">3.</span>
                Changes are saved instantly to the system.
              </li>
            </ul>
          </div>
        </div>

        {/* RIGHT: Timetable grid */}
        <div className="min-w-0">
          {!selectedSectionId ? (
            <div className="flex flex-col items-center justify-center h-[500px] rounded-3xl border-2 border-dashed bg-muted/10 gap-4">
              <div className="p-4 rounded-full bg-muted/20">
                <CalendarDays className="h-10 w-10 text-muted-foreground/40" />
              </div>
              <div className="max-w-[280px] text-center">
                <p className="font-bold text-lg text-foreground">Select a Section</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Choose a class and section from the left panel to begin managing the schedule.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Active Section Header Card */}
              <Card className="overflow-hidden border-none shadow-sm bg-muted/30">
                <CardContent className="p-0">
                  <div className="flex flex-col md:flex-row md:items-center justify-between p-6 gap-6">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-none px-2 py-0 h-5 text-[10px] font-bold uppercase tracking-wider">
                          {selectedSection?.class_name}
                        </Badge>
                        {selectedSection?.is_current_year && (
                          <Badge variant="outline" className="h-5 text-[10px] font-medium border-primary/30 text-primary/80">
                            Current Year
                          </Badge>
                        )}
                      </div>
                      <h2 className="text-2xl font-bold tracking-tight">
                        Section {selectedSection?.section_name} Timetable
                      </h2>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">{slots.length}</span>
                        <span>periods scheduled this week</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 min-w-[280px]">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <UserCheck className="h-3 w-3" />
                        Class Teacher Assignment
                      </span>
                      <ClassTeacherAssigner
                        schoolId={activeSchoolId!}
                        section={selectedSection!}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Grid Card */}
              <Card className="border-none shadow-md overflow-hidden bg-card">
                <div className="p-1 bg-muted/10 border-b border-border/50">
                   <div className="flex items-center justify-between px-4 py-2">
                      <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Weekly Grid View</span>
                      <div className="flex items-center gap-3">
                         <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-primary/20" />
                            <span className="text-[10px] text-muted-foreground">Break</span>
                         </div>
                         <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-primary" />
                            <span className="text-[10px] text-muted-foreground">Class</span>
                         </div>
                      </div>
                   </div>
                </div>
                <CardContent className="p-6">
                  <TimetableGrid
                    slots={slots}
                    editable
                    onCellClick={handleCellClick}
                    loading={slotsLoading}
                    days={6}
                    periodsCount={6}
                  />
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* Slot editor dialog */}
      {editorOpen && selectedSectionId && activeSchoolId && (
        <TimetableSlotEditor
          open={editorOpen}
          onClose={() => setEditorOpen(false)}
          sectionId={selectedSectionId}
          schoolId={activeSchoolId}
          day={editorDay}
          period={editorPeriod}
          existing={editorSlot}
          subjects={subjects}
          staff={staff}
        />
      )}
    </div>
  )
}
