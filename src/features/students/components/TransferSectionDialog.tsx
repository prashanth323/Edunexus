import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ArrowRightLeft, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { flattenSectionOptionsForCurrentYear } from "../api/academics.api"
import { transferStudentSection } from "../api/studentProfile.api"

type TransferSectionDialogProps = {
  studentId: string
  studentName: string
  schoolId: string
  currentEnrollmentId: string
  currentSectionName: string
  currentClassName: string
  academicYearId: string
  onClose: () => void
  onSuccess: () => void
}

export function TransferSectionDialog({
  studentId,
  studentName,
  schoolId,
  currentEnrollmentId,
  currentSectionName,
  currentClassName,
  academicYearId,
  onClose,
  onSuccess,
}: TransferSectionDialogProps) {
  const [targetSectionId, setTargetSectionId] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const { data: sectionOptions = [], isLoading: sectionsLoading } = useQuery({
    queryKey: ["section-options-transfer", schoolId],
    queryFn: () => flattenSectionOptionsForCurrentYear(schoolId),
    enabled: !!schoolId,
  })

  async function handleTransfer() {
    if (!targetSectionId) {
      toast.error("Please select a target section")
      return
    }
    setSubmitting(true)
    try {
      await transferStudentSection(studentId, schoolId, currentEnrollmentId, targetSectionId, academicYearId)
      toast.success(`${studentName} transferred successfully`)
      onSuccess()
      onClose()
    } catch (err: any) {
      toast.error(err.message || "Transfer failed")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
            Transfer Section
          </CardTitle>
          <CardDescription>
            Move <strong>{studentName}</strong> from{" "}
            <strong>{currentClassName} - {currentSectionName}</strong> to a new section.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Current section</p>
            <p className="font-medium">{currentClassName} — Section {currentSectionName}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="target-section">Transfer to</Label>
            <select
              id="target-section"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={targetSectionId}
              onChange={(e) => setTargetSectionId(e.target.value)}
              disabled={sectionsLoading}
            >
              <option value="">Select new section…</option>
              {sectionOptions
                .sort((a, b) => a.label.localeCompare(b.label))
                .map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleTransfer} disabled={submitting || !targetSectionId}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Transfer Student
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
