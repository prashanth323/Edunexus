import { useEffect, useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
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
import {
  approveAdmissionApplication,
  getFeeCommitmentByApplication,
  updateApplicationStatus,
  type Application,
  type FeeBreakdownLine,
} from "../api/admissions.api"
import { ApplicationVerificationDetails } from "./ApplicationVerificationDetails"

type Props = {
  app: Application
  open: boolean
  onClose: () => void
  onDone: () => void
}

export function AdmissionReviewDialog({ app, open, onClose, onDone }: Props) {
  const [breakdown, setBreakdown] = useState<FeeBreakdownLine[]>([])
  const [concessionNotes, setConcessionNotes] = useState("")

  const { data: commitment } = useQuery({
    queryKey: ["fee-commitment", app.id],
    queryFn: () => getFeeCommitmentByApplication(app.id),
    enabled: open,
  })

  useEffect(() => {
    if (!open) return
    const raw = commitment?.fee_breakdown
    if (Array.isArray(raw) && raw.length > 0) {
      setBreakdown(
        raw.map((line: Record<string, unknown>) => ({
          fee_structure_id: String(line.fee_structure_id ?? ""),
          name: String(line.name ?? ""),
          amount: Number(line.amount ?? 0),
          concession: Number(line.concession ?? line.concession_amount ?? 0),
        })),
      )
    } else if (commitment?.total_fee) {
      setBreakdown([
        {
          fee_structure_id: "",
          name: "Total commitment",
          amount: Number(commitment.total_fee),
          concession: 0,
        },
      ])
    }
    setConcessionNotes(String(commitment?.concession_notes ?? ""))
  }, [open, commitment])

  const approveMutation = useMutation({
    mutationFn: () =>
      approveAdmissionApplication(
        app.id,
        breakdown.length ? breakdown : undefined,
        // Remote RPC requires route/room when mode is school_bus/hostel — use self until pickers exist.
        { transportMode: "self" },
      ),
    onSuccess: (result) => {
      toast.success(`Approved — admission no. ${result.admissionNo}`)
      onDone()
      onClose()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const rejectMutation = useMutation({
    mutationFn: (reason: string) => updateApplicationStatus(app.id, "rejected", reason),
    onSuccess: () => {
      toast.success("Application rejected")
      onDone()
      onClose()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const feeTotal = breakdown.reduce(
    (sum, line) => sum + line.amount - (line.concession ?? 0),
    0,
  )

  function updateLineAmount(index: number, amount: number) {
    setBreakdown((prev) =>
      prev.map((line, i) => (i === index ? { ...line, amount } : line)),
    )
  }

  function updateLineConcession(index: number, concession: number) {
    setBreakdown((prev) =>
      prev.map((line, i) => (i === index ? { ...line, concession } : line)),
    )
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review admission</DialogTitle>
          <DialogDescription>
            Verify details and approve to generate admission number and student record.
          </DialogDescription>
        </DialogHeader>

        <ApplicationVerificationDetails app={app} feeTotal={feeTotal} />

        {breakdown.length > 0 && (
          <div className="space-y-3 border-t pt-4">
            <Label>Fee breakdown (adjust concessions if needed)</Label>
            {breakdown.map((line, i) => (
              <div key={`${line.fee_structure_id}-${i}`} className="grid grid-cols-3 gap-2 items-end">
                <div className="col-span-3 text-sm font-medium">{line.name}</div>
                <div>
                  <Label className="text-xs">Amount</Label>
                  <Input
                    type="number"
                    min={0}
                    value={line.amount}
                    onChange={(e) => updateLineAmount(i, Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label className="text-xs">Concession</Label>
                  <Input
                    type="number"
                    min={0}
                    value={line.concession ?? 0}
                    onChange={(e) => updateLineConcession(i, Number(e.target.value))}
                  />
                </div>
                <div className="text-sm text-muted-foreground pb-2">
                  Net: ₹{(line.amount - (line.concession ?? 0)).toLocaleString("en-IN")}
                </div>
              </div>
            ))}
            <div>
              <Label>Concession notes</Label>
              <Textarea
                value={concessionNotes}
                onChange={(e) => setConcessionNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            type="button"
            variant="destructive"
            disabled={rejectMutation.isPending || approveMutation.isPending}
            onClick={() => {
              const reason = window.prompt("Rejection reason?")
              if (reason?.trim()) rejectMutation.mutate(reason.trim())
            }}
          >
            Reject
          </Button>
          <Button
            type="button"
            onClick={() => approveMutation.mutate()}
            disabled={approveMutation.isPending || rejectMutation.isPending}
          >
            {approveMutation.isPending ? "Approving…" : "Approve & create student"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
