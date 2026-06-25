import { useEffect, useState } from "react"
import { Loader2, Bus, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { updateStudentServicePreference } from "@/features/students/api/studentService.api"

type ChildRow = {
  student_id: string
  student_name: string
  class_name: string | null
  section_name: string | null
  transport_mode?: string | null
}

type Props = {
  child: ChildRow
  onClose: () => void
  onSuccess: () => void
}

export function ChildServicePreferenceDialog({ child, onClose, onSuccess }: Props) {
  const [submitting, setSubmitting] = useState(false)
  const [transportMode, setTransportMode] = useState<"self" | "school_bus" | "hostel">("self")

  useEffect(() => {
    const mode = child.transport_mode as "self" | "school_bus" | "hostel" | undefined
    setTransportMode(mode === "school_bus" || mode === "hostel" ? mode : "self")
  }, [child])

  async function handleSave() {
    try {
      setSubmitting(true)
      await updateStudentServicePreference(child.student_id, transportMode)
      toast.success("Service preference updated")
      onSuccess()
      onClose()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to update preference")
    } finally {
      setSubmitting(false)
    }
  }

  const classLabel = [child.class_name, child.section_name ? `Section ${child.section_name}` : null]
    .filter(Boolean)
    .join(" · ")

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Bus className="h-4 w-4" />
              Service preferences
            </CardTitle>
            <CardDescription className="mt-1">
              {child.student_name}
              {classLabel ? ` · ${classLabel}` : ""}
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Choose hostel, school bus, or own transport. Hostel and bus requests go to the VP allocation
            queue until assigned.
          </p>
          <div className="grid gap-1.5">
            <Label>Transport / boarding</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={transportMode}
              onChange={(e) => setTransportMode(e.target.value as "self" | "school_bus" | "hostel")}
            >
              <option value="self">Self / own transport</option>
              <option value="school_bus">School bus</option>
              <option value="hostel">Hostel</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Save
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
