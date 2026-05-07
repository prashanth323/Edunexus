import { useState, useEffect } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Loader2, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DAY_LABELS, type TimetableSlot, upsertTimetableSlot, deleteTimetableSlot } from "../api/timetable.api"

type Subject = { id: string; name: string; code: string | null }
type StaffMember = { id: string; name: string; designation: string }

type SlotEditorProps = {
  open: boolean
  onClose: () => void
  sectionId: string
  schoolId: string
  day: number
  period: number
  existing?: TimetableSlot
  subjects: Subject[]
  staff: StaffMember[]
}

export function TimetableSlotEditor({
  open,
  onClose,
  sectionId,
  schoolId,
  day,
  period,
  existing,
  subjects,
  staff,
}: SlotEditorProps) {
  const qc = useQueryClient()
  const [subjectId, setSubjectId] = useState("")
  const [staffId, setStaffId] = useState("")
  const [startTime, setStartTime] = useState("08:00")
  const [endTime, setEndTime] = useState("08:45")
  const [roomNo, setRoomNo] = useState("")

  useEffect(() => {
    if (existing) {
      setSubjectId(existing.subject_id ?? "")
      setStaffId(existing.staff_id ?? "")
      setStartTime(existing.start_time?.slice(0, 5) ?? "08:00")
      setEndTime(existing.end_time?.slice(0, 5) ?? "08:45")
      setRoomNo(existing.room_no ?? "")
    } else {
      setSubjectId("")
      setStaffId("")
      setStartTime("08:00")
      setEndTime("08:45")
      setRoomNo("")
    }
  }, [existing, open])

  const invalidate = () => qc.invalidateQueries({ queryKey: ["timetable-section", sectionId] })

  const upsertMut = useMutation({
    mutationFn: () => {
      if (!subjectId) throw new Error("Select a subject")
      if (!startTime || !endTime) throw new Error("Enter start and end time")
      return upsertTimetableSlot({
        id: existing?.timetable_id,
        school_id: schoolId,
        section_id: sectionId,
        subject_id: subjectId,
        staff_id: staffId || null,
        day_of_week: day,
        period_no: period,
        start_time: startTime,
        end_time: endTime,
        room_no: roomNo || null,
      })
    },
    onSuccess: () => {
      toast.success(existing ? "Slot updated" : "Slot added")
      invalidate()
      onClose()
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not save slot"),
  })

  const deleteMut = useMutation({
    mutationFn: () => {
      if (!existing?.timetable_id) throw new Error("No slot to delete")
      return deleteTimetableSlot(existing.timetable_id)
    },
    onSuccess: () => {
      toast.success("Slot removed")
      invalidate()
      onClose()
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not delete slot"),
  })

  const isPending = upsertMut.isPending || deleteMut.isPending

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onClick={() => !isPending && onClose()}
    >
      <div
        role="dialog"
        className="w-full max-w-md rounded-xl border bg-background p-6 shadow-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">
              {existing ? "Edit period" : "Add period"} — {DAY_LABELS[day]}, Period {period}
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              {existing ? "Update or remove this timetable slot." : "Assign a subject and teacher to this slot."}
            </p>
          </div>
          <button
            className="text-muted-foreground hover:text-foreground transition-colors"
            onClick={onClose}
            disabled={isPending}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Subject */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Subject <span className="text-destructive">*</span>
            </label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
            >
              <option value="">Select subject…</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.code ? ` (${s.code})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Teacher */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Teacher</label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
            >
              <option value="">— Unassigned —</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.designation})
                </option>
              ))}
            </select>
          </div>

          {/* Time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Start time</label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">End time</label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>

          {/* Room */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Room / Lab (optional)</label>
            <Input
              placeholder="e.g. Room 101, Science Lab"
              value={roomNo}
              onChange={(e) => setRoomNo(e.target.value)}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 justify-end mt-6 pt-4 border-t">
          {existing && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => deleteMut.mutate()}
              disabled={isPending}
              className="mr-auto"
            >
              {deleteMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              <span className="ml-1.5">Remove</span>
            </Button>
          )}
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={() => upsertMut.mutate()} disabled={isPending}>
            {upsertMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {existing ? "Update" : "Add period"}
          </Button>
        </div>
      </div>
    </div>
  )
}
