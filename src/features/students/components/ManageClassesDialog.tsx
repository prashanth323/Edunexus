import { Loader2, CalendarRange } from "lucide-react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  createClass,
  createSection,
  listClasses,
  listSectionsForYear,
  type ClassRow,
} from "../api/academics.api"
import { createAcademicYear, suggestedAcademicYearDefaults } from "../api/academicYears.api"

function invalidateAcademicYearQueries(qc: ReturnType<typeof useQueryClient>, schoolId: string) {
  void qc.invalidateQueries({ queryKey: ["academic-year-meta-manage-classes", schoolId] })
  void qc.invalidateQueries({ queryKey: ["academic-year-current", schoolId] })
  void qc.invalidateQueries({ queryKey: ["section-options", schoolId] })
}

/** Shown when the school has no academic year rows yet (sections need a resolved year id). */
function AcademicYearBootstrapPanel({ schoolId }: { schoolId: string }) {
  const qc = useQueryClient()
  const suggested = useMemo(() => suggestedAcademicYearDefaults(), [])
  const [name, setName] = useState(suggested.name)
  const [startDate, setStartDate] = useState(suggested.startDate)
  const [endDate, setEndDate] = useState(suggested.endDate)
  const [busy, setBusy] = useState(false)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const n = name.trim()
    if (!n) {
      toast.error("Enter an academic year name (e.g. 2025-26)")
      return
    }
    if (endDate < startDate) {
      toast.error("End date must be on or after the start date.")
      return
    }
    setBusy(true)
    try {
      await createAcademicYear({
        schoolId,
        name: n,
        startDate,
        endDate,
        setAsCurrent: true,
      })
      toast.success("Academic year created and set as active.")
      invalidateAcademicYearQueries(qc, schoolId)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create academic year")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-lg border border-amber-200 dark:border-amber-900/80 bg-amber-50/60 dark:bg-amber-950/25 p-4 space-y-4">
      <div className="flex gap-3">
        <div className="shrink-0 mt-0.5 text-amber-700 dark:text-amber-400">
          <CalendarRange className="h-5 w-5" />
        </div>
        <div className="min-w-0 space-y-1">
          <h4 className="text-sm font-semibold text-foreground">Set up the academic calendar</h4>
          <p className="text-xs text-muted-foreground leading-snug">
            There is no academic year for this school yet. Add one below (shown with a typical July–June span; edit as
            needed). Only one year can be marked active — this one becomes active automatically.
          </p>
        </div>
      </div>

      <form onSubmit={handleCreate} className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="ay-name">Year name</Label>
          <Input id="ay-name" placeholder="2025-26" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ay-start">Start date</Label>
          <Input
            id="ay-start"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ay-end">End date</Label>
          <Input id="ay-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={busy} className="gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Create &amp; set as active year
          </Button>
        </div>
      </form>
    </div>
  )
}

export type ManageClassesDialogProps = {
  schoolId: string
  academicYearId: string | null
  academicYearLabel: string
}

export function ManageClassesPanel({
  schoolId,
  academicYearId,
  academicYearLabel,
}: ManageClassesDialogProps) {
  const qc = useQueryClient()
  const [newClassName, setNewClassName] = useState("")
  const [newNumeric, setNewNumeric] = useState("")
  const [creatingClass, setCreatingClass] = useState(false)
  const [sectionInputs, setSectionInputs] = useState<Record<string, string>>({})
  const [creatingSectionFor, setCreatingSectionFor] = useState<string | null>(null)

  const { data: classes, isLoading } = useQuery({
    queryKey: ["school-classes", schoolId],
    queryFn: () => listClasses(schoolId),
    enabled: !!schoolId,
  })

  const clsList = classes ?? []

  async function refreshClasses() {
    await qc.invalidateQueries({ queryKey: ["school-classes", schoolId] })
  }

  const refreshSections = async (classId?: string) => {
    await qc.invalidateQueries({ queryKey: ["school-sections", schoolId, academicYearId, classId] })
    await qc.invalidateQueries({ queryKey: ["section-options", schoolId] })
  }

  async function handleAddClass(e: React.FormEvent) {
    e.preventDefault()
    const name = newClassName.trim()
    if (!name || !schoolId) return
    const nlev = newNumeric.trim() ? Number.parseInt(newNumeric.trim(), 10) : NaN
    const numericLevel = Number.isFinite(nlev) ? nlev : undefined
    setCreatingClass(true)
    try {
      await createClass({ schoolId, name, numericLevel })
      setNewClassName("")
      setNewNumeric("")
      await refreshClasses()
      await qc.invalidateQueries({ queryKey: ["section-options", schoolId] })
    } finally {
      setCreatingClass(false)
    }
  }

  async function handleAddSection(classId: string) {
    if (!schoolId || !academicYearId) return
    const raw = sectionInputs[classId]
    const name = (typeof raw === "string" ? raw : "").trim()
    if (!name) return

    setCreatingSectionFor(classId)
    try {
      await createSection({ schoolId, classId, academicYearId, name })
      setSectionInputs((m) => ({ ...m, [classId]: "" }))
      await refreshSections(classId)
    } finally {
      setCreatingSectionFor(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold">Classes &amp; sections</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Sections are tied to this academic year: <span className="font-medium">{academicYearLabel}</span>.
        </p>
      </div>

      {!academicYearId ? <AcademicYearBootstrapPanel schoolId={schoolId} /> : null}

      <form onSubmit={handleAddClass} className="flex flex-wrap items-end gap-2">
        <div className="space-y-1.5 min-w-[160px] flex-1">
          <Label htmlFor="new-class-name">New class name</Label>
          <Input
            id="new-class-name"
            placeholder="e.g. Grade 5"
            value={newClassName}
            onChange={(e) => setNewClassName(e.target.value)}
          />
        </div>
        <div className="space-y-1.5 w-24">
          <Label htmlFor="new-class-lvl">Order #</Label>
          <Input
            id="new-class-lvl"
            type="number"
            placeholder="5"
            value={newNumeric}
            onChange={(e) => setNewNumeric(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={creatingClass || !newClassName.trim()}>
          {creatingClass ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add class"}
        </Button>
      </form>

      {isLoading ? (
        <div className="space-y-3 py-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-md" />
          ))}
        </div>
      ) : clsList.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center border rounded-md border-dashed">
          No classes yet. Create one above, then add sections (A, B, …).
        </p>
      ) : (
        <ul className="space-y-3">
          {clsList.map((c) => (
            <ClassSectionsBlock
              key={c.id}
              schoolId={schoolId}
              cls={c}
              academicYearId={academicYearId}
              sectionInput={sectionInputs[c.id] ?? ""}
              onSectionInputChange={(v) => setSectionInputs((m) => ({ ...m, [c.id]: v }))}
              onSubmitSection={() => handleAddSection(c.id)}
              sectionBusy={creatingSectionFor === c.id}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

/** Card block for sections under one class — needs its own query for sections list */
function ClassSectionsBlock({
  schoolId,
  cls,
  academicYearId,
  sectionInput,
  onSectionInputChange,
  onSubmitSection,
  sectionBusy,
}: {
  schoolId: string
  cls: ClassRow
  academicYearId: string | null
  sectionInput: string
  onSectionInputChange: (v: string) => void
  onSubmitSection: () => void | Promise<void>
  sectionBusy: boolean
}) {
  const { data: sectionsRaw, isLoading } = useQuery({
    queryKey: ["school-sections", schoolId, academicYearId, cls.id],
    queryFn: () => listSectionsForYear(schoolId, academicYearId!, cls.id),
    enabled: !!schoolId && !!academicYearId,
  })

  const sections =
    [...(sectionsRaw ?? [])].sort((a, b) => String(a.name).localeCompare(String(b.name)))

  const labelFor = (r: { name: string }) => `${cls.name} · Section ${r.name}`

  return (
    <li>
      <Card>
        <CardHeader className="py-3">
          <p className="font-medium">{cls.name}</p>
          {cls.numeric_level != null ? (
            <p className="text-xs text-muted-foreground">Order: {cls.numeric_level}</p>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {!academicYearId ? null : (
            <div className="flex flex-wrap gap-2 items-end">
              <div className="space-y-1.5 min-w-[180px]">
                <Label htmlFor={`sec-${cls.id}`}>New section name</Label>
                <Input
                  id={`sec-${cls.id}`}
                  placeholder="A"
                  maxLength={8}
                  value={sectionInput}
                  onChange={(e) => onSectionInputChange(e.target.value)}
                />
              </div>
              <Button
                type="button"
                size="sm"
                disabled={!sectionInput.trim() || sectionBusy}
                onClick={() => void onSubmitSection()}
              >
                {sectionBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add section"}
              </Button>
            </div>
          )}

          {isLoading ? (
            <div className="space-y-2 py-2">
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} className="h-8 w-full rounded-md" />
              ))}
            </div>
          ) : !academicYearId ? (
            <p className="text-xs text-muted-foreground">
              Add an academic year above before you can attach sections to classes.
            </p>
          ) : sections.length === 0 ? (
            <p className="text-xs text-muted-foreground">No sections for this year yet.</p>
          ) : (
            <ul className="text-sm space-y-1 border rounded-md divide-y divide-border bg-muted/20">
              {sections.map((s) => (
                <li key={s.id} className="px-3 py-2 flex justify-between gap-2">
                  <span>{labelFor(s)}</span>
                  <span className="text-xs font-mono text-muted-foreground shrink-0" title="Section ID">
                    {s.id.slice(0, 8)}…
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </li>
  )
}
