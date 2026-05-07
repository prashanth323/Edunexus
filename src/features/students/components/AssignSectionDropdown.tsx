import { Loader2 } from "lucide-react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { enrollStudentInSection, flattenSectionOptionsForCurrentYear } from "../api/academics.api"
import type { Student } from "../api/students.api"

export type AssignSectionDropdownProps = {
  enabled: boolean
  schoolId: string | undefined
}

export function AssignSectionDropdownItems({
  student,
  dropdownProps,
}: {
  student: Student
  dropdownProps: AssignSectionDropdownProps
}) {
  const qc = useQueryClient()
  const [busy, setBusy] = useState(false)

  const { data: options = [], isLoading } = useQuery({
    queryKey: ["section-options", dropdownProps.schoolId],
    queryFn: () => flattenSectionOptionsForCurrentYear(dropdownProps.schoolId!),
    enabled: dropdownProps.enabled && !!dropdownProps.schoolId,
    staleTime: 30_000,
  })

  const sortedOpts = useMemo(() => [...options].sort((a, b) => a.label.localeCompare(b.label)), [options])

  if (!dropdownProps.enabled || !dropdownProps.schoolId) return null

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuLabel>Assign class / section</DropdownMenuLabel>
      {busy ? (
        <div className="px-2 py-2 flex items-center gap-2 text-muted-foreground text-xs">
          <Loader2 className="h-3 w-3 animate-spin" /> Saving…
        </div>
      ) : isLoading ? (
        <div className="px-2 py-2 text-xs text-muted-foreground">Loading sections…</div>
      ) : sortedOpts.length === 0 ? (
        <DropdownMenuItem disabled className="text-xs">
          Add sections via “Manage classes” first.
        </DropdownMenuItem>
      ) : (
        sortedOpts.map((o) => (
          <DropdownMenuItem
            key={o.id}
            className="text-xs cursor-pointer"
            onSelect={(e) => {
              e.preventDefault()
              setBusy(true)
              void enrollStudentInSection({
                schoolId: dropdownProps.schoolId!,
                studentId: student.id,
                sectionId: o.id,
              })
                .then(async () => {
                  toast.success("Student assigned to section.")
                  await qc.invalidateQueries({ queryKey: ["students", dropdownProps.schoolId] })
                })
                .catch((err) =>
                  toast.error(err instanceof Error ? err.message : "Could not enroll student."),
                )
                .finally(() => setBusy(false))
            }}
          >
            {o.label}
          </DropdownMenuItem>
        ))
      )}
    </>
  )
}
