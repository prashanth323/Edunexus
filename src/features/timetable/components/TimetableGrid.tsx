import { cn } from "@/lib/utils"
import { DAY_LABELS, type TimetableSlot } from "../api/timetable.api"
import { Clock, MapPin, BookOpen } from "lucide-react"

// Colour palette per subject index (cycles)
const SUBJECT_COLORS = [
  "bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-400",
  "bg-purple-500/10 border-purple-500/30 text-purple-700 dark:text-purple-400",
  "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400",
  "bg-orange-500/10 border-orange-500/30 text-orange-700 dark:text-orange-400",
  "bg-pink-500/10 border-pink-500/30 text-pink-700 dark:text-pink-400",
  "bg-cyan-500/10 border-cyan-500/30 text-cyan-700 dark:text-cyan-400",
  "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400",
  "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-400",
]

function getSubjectColor(subjectId: string, subjectColorMap: Map<string, number>) {
  if (!subjectColorMap.has(subjectId)) {
    subjectColorMap.set(subjectId, subjectColorMap.size % SUBJECT_COLORS.length)
  }
  return SUBJECT_COLORS[subjectColorMap.get(subjectId)!]
}

type TimetableGridProps = {
  slots: TimetableSlot[]
  /** Called when principal clicks a cell to edit/add */
  onCellClick?: (day: number, period: number, existing?: TimetableSlot) => void
  editable?: boolean
  /** How many days to show (default 6 = Mon–Sat) */
  days?: number
  /** How many periods to show (default 8) */
  periodsCount?: number
  loading?: boolean
}

export function TimetableGrid({
  slots,
  onCellClick,
  editable = false,
  days = 6,
  periodsCount = 8,
  loading = false,
}: TimetableGridProps) {
  const subjectColorMap = new Map<string, number>()

  // Build lookup: day → period → slot
  const slotMap = new Map<string, TimetableSlot>()
  for (const slot of slots) {
    slotMap.set(`${slot.day_of_week}-${slot.period_no}`, slot)
  }

  const dayLabels = DAY_LABELS.slice(0, days)
  const periods = Array.from({ length: periodsCount }, (_, i) => i + 1)

  if (loading) {
    return (
      <div className="overflow-x-auto rounded-xl border border-border">
        <div className="min-w-[640px] animate-pulse">
          {/* header */}
          <div className="grid bg-muted/50 border-b" style={{ gridTemplateColumns: `80px repeat(${days}, 1fr)` }}>
            <div className="p-3" />
            {dayLabels.map((d) => (
              <div key={d} className="p-3 text-center">
                <div className="h-4 w-16 bg-muted rounded mx-auto" />
              </div>
            ))}
          </div>
          {periods.map((p) => (
            <div
              key={p}
              className="grid border-b last:border-0"
              style={{ gridTemplateColumns: `80px repeat(${days}, 1fr)` }}
            >
              <div className="p-3 flex items-center justify-center border-r">
                <div className="h-4 w-10 bg-muted rounded" />
              </div>
              {dayLabels.map((d) => (
                <div key={d} className="p-2 border-r last:border-0">
                  <div className="h-14 bg-muted/40 rounded-lg" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (slots.length === 0 && !editable) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center gap-3">
        <BookOpen className="h-10 w-10 text-muted-foreground/40" />
        <div>
          <p className="font-medium text-muted-foreground">No timetable entries yet</p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            When periods are assigned, they will appear here.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border shadow-sm">
      <div className="min-w-[640px]">
        {/* Day header row */}
        <div
          className="grid bg-muted/50 border-b sticky top-0 z-10"
          style={{ gridTemplateColumns: `80px repeat(${days}, 1fr)` }}
        >
          <div className="p-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide border-r">
            Period
          </div>
          {dayLabels.map((day) => (
            <div
              key={day}
              className="p-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide border-r last:border-0"
            >
              {day.slice(0, 3)}
              <span className="hidden sm:inline">{day.slice(3)}</span>
            </div>
          ))}
        </div>

        {/* Period rows */}
        {periods.map((periodNo) => (
          <div
            key={periodNo}
            className="grid border-b last:border-0 hover:bg-muted/20 transition-colors"
            style={{ gridTemplateColumns: `80px repeat(${days}, 1fr)` }}
          >
            {/* Period number column */}
            <div className="p-3 flex items-center justify-center border-r bg-muted/20">
              <span className="text-xs font-bold text-muted-foreground">P{periodNo}</span>
            </div>

            {/* Day columns */}
            {Array.from({ length: days }, (_, dayIdx) => {
              const slot = slotMap.get(`${dayIdx}-${periodNo}`)
              const colorClass = slot ? getSubjectColor(slot.subject_id, subjectColorMap) : ""

              return (
                <div
                  key={dayIdx}
                  className={cn(
                    "p-1.5 border-r last:border-0 min-h-[72px] flex items-stretch",
                    editable && "cursor-pointer group",
                  )}
                  onClick={() => editable && onCellClick?.(dayIdx, periodNo, slot)}
                >
                  {slot ? (
                    <div
                      className={cn(
                        "flex-1 rounded-lg border px-2 py-1.5 text-left transition-all",
                        colorClass,
                        editable && "group-hover:brightness-95 group-hover:shadow-sm",
                      )}
                    >
                      <p className="font-semibold text-xs leading-tight truncate">{slot.subject_name}</p>
                      {slot.teacher_name && (
                        <p className="text-[10px] mt-0.5 opacity-80 truncate">{slot.teacher_name}</p>
                      )}
                      {(slot.start_time || slot.room_no) && (
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {slot.start_time && slot.end_time && (
                            <span className="flex items-center gap-0.5 text-[9px] opacity-70">
                              <Clock className="h-2.5 w-2.5 shrink-0" />
                              {slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)}
                            </span>
                          )}
                          {slot.room_no && (
                            <span className="flex items-center gap-0.5 text-[9px] opacity-70">
                              <MapPin className="h-2.5 w-2.5 shrink-0" />
                              {slot.room_no}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ) : editable ? (
                    <div className="flex-1 flex items-center justify-center rounded-lg border border-dashed border-border/50 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/60">
                      <span className="text-[10px]">+ Add</span>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
