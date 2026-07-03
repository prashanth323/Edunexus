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
import { applyTermInvoiceFine, type OverdueDueRow, type OverdueFeeLine } from "../api/feeManagement.api"
import { notifyStudentFeeDue, logFeeManualReminder } from "../api/feePlans.api"
import { feeCategoryLabel } from "../lib/feeCategories"

type TermGroup = {
  termLabel: string
  lines: OverdueFeeLine[]
  subtotal: number
  lastDueDate: string
  isOverdue: boolean
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  row: OverdueDueRow
  term: TermGroup
  onSuccess: () => void
}

function buildFineNotifyBody(row: OverdueDueRow, term: TermGroup, fineAmount: number, newSubtotal: number): string {
  const lines = term.lines
    .map(
      (l) =>
        `- ${l.name} (${feeCategoryLabel(l.category)}): ₹${Number(l.amount).toLocaleString()} — due ${new Date(l.due_date + "T12:00:00").toLocaleDateString()}`,
    )
    .join("\n")
  return `Late fine applied — ${term.termLabel}

Student: ${row.student_name}
Admission no: ${row.admission_no}
Class: ${row.class_name} – ${row.section_name}

Fee items (${term.termLabel}):
${lines}

Late fine: ₹${fineAmount.toLocaleString()}
${term.termLabel} total due (incl. fine): ₹${newSubtotal.toLocaleString()}
Last date to pay: ${term.lastDueDate ? new Date(term.lastDueDate + "T12:00:00").toLocaleDateString() : "—"}

Please clear dues at the school office.`
}

export function AddFineNotifyDialog({ open, onOpenChange, row, term, onSuccess }: Props) {
  const [fineAmount, setFineAmount] = useState("")

  const mutation = useMutation({
    mutationFn: async () => {
      const fine = Number(fineAmount)
      if (!fine || fine <= 0) throw new Error("Enter a valid fine amount")

      await applyTermInvoiceFine(
        term.lines.map((l) => l.invoice_id),
        fine,
      )

      const newSubtotal = term.subtotal + fine
      const body = buildFineNotifyBody(row, term, fine, newSubtotal)

      await notifyStudentFeeDue({
        studentId: row.student_id,
        title: `Late fine — ${term.termLabel} — ${row.student_name}`,
        body,
        amount: newSubtotal,
        metadata: {
          activity: "fine",
          fine_amount: fine,
          fee_lines: term.lines,
          term_label: term.termLabel,
          term_subtotal: newSubtotal,
          last_date_to_pay: term.lastDueDate,
          parent_email: row.parent_email,
          class_name: row.class_name,
          section_name: row.section_name,
          admission_no: row.admission_no,
          student_name: row.student_name,
        },
      })
      await logFeeManualReminder(term.lines.map((l) => l.invoice_id))
    },
    onSuccess: () => {
      toast.success("Fine applied — parent and VP notified")
      onSuccess()
      onOpenChange(false)
      setFineAmount("")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add fine & notify — {term.termLabel}</DialogTitle>
        </DialogHeader>

        <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
          <p className="font-medium">{row.student_name}</p>
          <p className="text-muted-foreground">
            {row.class_name} – {row.section_name} · Adm. {row.admission_no}
          </p>
          <p className="text-muted-foreground">
            Current due: ₹{term.subtotal.toLocaleString()}
            {term.isOverdue ? " (overdue)" : ""}
          </p>
        </div>

        <div className="grid gap-1.5">
          <Label>Fine amount (₹)</Label>
          <Input
            type="number"
            min={1}
            step="1"
            value={fineAmount}
            onChange={(e) => setFineAmount(e.target.value)}
            placeholder="e.g. 500"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button disabled={!fineAmount || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Apply fine & notify
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
