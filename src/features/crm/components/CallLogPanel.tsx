import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import { Phone, Plus } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  createCallFollowup,
  getCounselorIdForCurrentUser,
  getFollowups,
  getLeads,
} from "../api/crm.api"

type Props = { schoolId: string }

export function CallLogPanel({ schoolId }: Props) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [leadId, setLeadId] = useState("")
  const [outcome, setOutcome] = useState("")
  const [notes, setNotes] = useState("")
  const [nextFollowup, setNextFollowup] = useState("")

  const { data: followups = [] } = useQuery({
    queryKey: ["call-followups", schoolId],
    queryFn: () => getFollowups(schoolId),
    enabled: !!schoolId,
  })

  const { data: leads = [] } = useQuery({
    queryKey: ["crm-leads-call", schoolId],
    queryFn: () => getLeads(schoolId),
    enabled: open && !!schoolId,
  })

  const calls = followups.filter((f) => f.type === "call")

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      const counselorId = await getCounselorIdForCurrentUser(schoolId)
      if (!counselorId) throw new Error("Counselor profile not found")
      return createCallFollowup({
        schoolId,
        leadId,
        counselorId,
        scheduledAt: new Date().toISOString(),
        outcome,
        notes,
        nextFollowup: nextFollowup || undefined,
      })
    },
    onSuccess: () => {
      toast.success("Call logged")
      qc.invalidateQueries({ queryKey: ["call-followups"] })
      setOpen(false)
      setLeadId("")
      setOutcome("")
      setNotes("")
      setNextFollowup("")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Phone className="h-4 w-4" /> Call log
          </CardTitle>
          <CardDescription>Telecaller / counsellor call tracking</CardDescription>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Log call
        </Button>
      </CardHeader>
      <CardContent className="space-y-2 max-h-48 overflow-y-auto">
        {calls.length === 0 ? (
          <p className="text-sm text-muted-foreground">No calls logged yet.</p>
        ) : (
          calls.slice(0, 8).map((c) => (
            <div key={c.id} className="text-sm border-b pb-2 last:border-0">
              <p className="font-medium">{c.leads?.student_name ?? "Lead"}</p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(c.scheduled_at), "MMM d, h:mm a")} — {c.outcome ?? "No outcome"}
              </p>
            </div>
          ))
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log call</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>Lead</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={leadId}
                onChange={(e) => setLeadId(e.target.value)}
              >
                <option value="">Select lead</option>
                {leads.map((l) => (
                  <option key={l.id} value={l.id}>{l.student_name} — {l.parent_phone}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label>Outcome</Label>
              <Input value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="Interested, callback, etc." />
            </div>
            <div className="grid gap-1.5">
              <Label>Next callback</Label>
              <Input type="datetime-local" value={nextFollowup} onChange={(e) => setNextFollowup(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button disabled={!leadId || isPending} onClick={() => mutate()}>
              Save call
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
