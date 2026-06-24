import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Loader2, UserCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { assignClassTeacher, getStaffForSchool, type SectionWithClassTeacher } from "../api/timetable.api"
import { useState, useEffect } from "react"

type Props = {
  schoolId: string
  section: SectionWithClassTeacher
  onSaved?: () => void
}

export function ClassTeacherAssigner({ schoolId, section, onSaved }: Props) {
  const qc = useQueryClient()
  const [staffId, setStaffId] = useState<string>(section.class_teacher_staff_id ?? "")

  useEffect(() => {
    setStaffId(section.class_teacher_staff_id ?? "")
  }, [section.class_teacher_staff_id])

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ["staff-for-school", schoolId],
    queryFn: () => getStaffForSchool(schoolId),
    enabled: !!schoolId,
  })

  const mut = useMutation({
    mutationFn: () => assignClassTeacher(section.section_id, staffId || null),
    onSuccess: () => {
      toast.success(`Class teacher ${staffId ? "assigned" : "unassigned"} for ${section.class_name} – ${section.section_name}`)
      qc.invalidateQueries({ queryKey: ["sections-with-class-teachers", schoolId] })
      onSaved?.()
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not save"),
  })

  const changed = staffId !== (section.class_teacher_staff_id ?? "")

  const teacherStaff = staff.filter((s) => {
    const d = (s.designation ?? "").toLowerCase()
    return d.includes("teacher") || d.includes("faculty") || d.includes("tutor")
  })
  const currentInList = teacherStaff.some((s) => s.id === section.class_teacher_staff_id)
  const staffOptions =
    section.class_teacher_staff_id && !currentInList
      ? [
          ...teacherStaff,
          staff.find((s) => s.id === section.class_teacher_staff_id)!,
        ].filter(Boolean)
      : teacherStaff.length > 0
        ? teacherStaff
        : staff

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
        <UserCheck className="h-3.5 w-3.5 shrink-0" />
        <span className="text-xs truncate">
          {section.class_teacher_name ?? "No class teacher"}
        </span>
      </div>
      <select
        className="h-8 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring flex-1 min-w-[140px]"
        value={staffId}
        onChange={(e) => setStaffId(e.target.value)}
        disabled={isLoading || mut.isPending}
      >
        <option value="">— None —</option>
        {staffOptions.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      {changed && (
        <Button size="sm" className="h-8 text-xs px-3" onClick={() => mut.mutate()} disabled={mut.isPending}>
          {mut.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
          Save
        </Button>
      )}
    </div>
  )
}
