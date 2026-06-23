import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createLead } from "../api/crm.api"
import { ensureDefaultLeadSources } from "@/features/admissions/api/admissions.api"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  schoolId: string
}

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

export function LeadCreateDialog({ open, onOpenChange, schoolId }: Props) {
  const qc = useQueryClient()
  const [studentName, setStudentName] = useState("")
  const [parentName, setParentName] = useState("")
  const [parentPhone, setParentPhone] = useState("")
  const [parentEmail, setParentEmail] = useState("")
  const [sourceId, setSourceId] = useState("")
  const [priority, setPriority] = useState("medium")
  const [classInterested, setClassInterested] = useState("")
  const [notes, setNotes] = useState("")

  const { data: sources = [] } = useQuery({
    queryKey: ["lead-sources", schoolId],
    queryFn: () => ensureDefaultLeadSources(schoolId),
    enabled: open && !!schoolId,
  })

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      createLead({
        schoolId,
        studentName,
        parentName,
        parentPhone,
        parentEmail: parentEmail || undefined,
        leadSourceId: sourceId || undefined,
        priority,
        notes: notes || undefined,
        classInterested: classInterested || undefined,
      }),
    onSuccess: () => {
      toast.success("Lead created")
      qc.invalidateQueries({ queryKey: ["crm-leads"] })
      onOpenChange(false)
      setStudentName("")
      setParentName("")
      setParentPhone("")
      setParentEmail("")
      setNotes("")
    },
    onError: (e: Error) => toast.error(e.message || "Failed to create lead"),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New lead</DialogTitle>
          <DialogDescription>Walk-in or phone enquiry — capture contact details.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label>Student name</Label>
            <Input value={studentName} onChange={(e) => setStudentName(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Parent name</Label>
            <Input value={parentName} onChange={(e) => setParentName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Phone</Label>
              <Input value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Email</Label>
              <Input type="email" value={parentEmail} onChange={(e) => setParentEmail(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Source</Label>
              <select className={selectClass} value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
                <option value="">Select</option>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label>Priority</Label>
              <select className={selectClass} value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Class interested</Label>
            <Input value={classInterested} onChange={(e) => setClassInterested(e.target.value)} placeholder="e.g. Grade 5" />
          </div>
          <div className="grid gap-1.5">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={isPending || !studentName || !parentName || !parentPhone}
            onClick={() => mutate()}
          >
            {isPending ? "Saving…" : "Create lead"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
