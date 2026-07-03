import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  notifyFeeVpActivity,
  recordTermPayments,
  type OverdueDueRow,
  type OverdueFeeLine,
} from "../api/feeManagement.api"

type TermGroup = {
  termLabel: string
  lines: OverdueFeeLine[]
  subtotal: number
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  schoolId: string
  row: OverdueDueRow
  term: TermGroup
  onSuccess: () => void
}

export function TermPaymentDialog({ open, onOpenChange, schoolId, row, term, onSuccess }: Props) {
  const [method, setMethod] = useState("cash")
  const [ref, setRef] = useState("")

  const mutation = useMutation({
    mutationFn: async () => {
      const total = await recordTermPayments(schoolId, row.student_id, term.lines, method, ref)
      await notifyFeeVpActivity({
        studentId: row.student_id,
        title: `Payment received — ${row.student_name}`,
        body: `Adm. no. ${row.admission_no}: ₹${total.toLocaleString()} received for ${term.termLabel} (${method.replace(/_/g, " ")}).`,
        amount: total,
        metadata: {
          activity: "payment",
          term_label: term.termLabel,
          class_name: row.class_name,
          section_name: row.section_name,
          admission_no: row.admission_no,
          student_name: row.student_name,
          payment_method: method,
        },
      })
      return total
    },
    onSuccess: (total) => {
      toast.success(`Payment of ₹${total.toLocaleString()} recorded — VP notified`)
      onSuccess()
      onOpenChange(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Received payment — {term.termLabel}</DialogTitle>
        </DialogHeader>

        <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
          <p className="font-medium">{row.student_name}</p>
          <p className="text-muted-foreground">
            {row.class_name} – {row.section_name} · Adm. {row.admission_no}
          </p>
          <p className="font-medium pt-1">₹{term.subtotal.toLocaleString()} for {term.termLabel}</p>
          <ul className="text-xs text-muted-foreground pt-1 space-y-0.5">
            {term.lines.map((l) => (
              <li key={l.invoice_id}>
                {l.name} — ₹{Number(l.amount).toLocaleString()}
              </li>
            ))}
          </ul>
        </div>

        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Method</Label>
              <select
                className="flex h-10 rounded-md border px-3 text-sm"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="bank_transfer">Bank transfer</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label>Reference (optional)</Label>
              <Input value={ref} onChange={(e) => setRef(e.target.value)} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Record payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
