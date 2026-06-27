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
import { recordPayment, type OverdueDueRow } from "../api/feeManagement.api"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  schoolId: string
  row: OverdueDueRow
  onSuccess: () => void
}

export function MarkPaymentDialog({ open, onOpenChange, schoolId, row, onSuccess }: Props) {
  const [invoiceId, setInvoiceId] = useState(row.lines[0]?.invoice_id ?? "")
  const [amount, setAmount] = useState(String(row.lines[0]?.amount ?? row.total_due))
  const [method, setMethod] = useState("cash")
  const [ref, setRef] = useState("")

  const mutation = useMutation({
    mutationFn: () =>
      recordPayment(schoolId, {
        invoiceId,
        studentId: row.student_id,
        amount: Number(amount),
        method,
        transactionRef: ref,
        notes: "",
      }),
    onSuccess: () => {
      toast.success("Payment recorded")
      onSuccess()
      onOpenChange(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Mark payment</DialogTitle>
        </DialogHeader>

        <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
          <p className="font-medium">{row.student_name}</p>
          <p className="text-muted-foreground">Adm. {row.admission_no}</p>
          <p className="text-muted-foreground">
            {row.class_name} – {row.section_name}
          </p>
          {row.parent_email && (
            <p className="text-muted-foreground">Parent: {row.parent_email}</p>
          )}
        </div>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Invoice</Label>
            <select
              className="flex h-10 rounded-md border px-3 text-sm w-full"
              value={invoiceId}
              onChange={(e) => {
                setInvoiceId(e.target.value)
                const line = row.lines.find((l) => l.invoice_id === e.target.value)
                if (line) setAmount(String(line.amount))
              }}
            >
              {row.lines.map((l) => (
                <option key={l.invoice_id} value={l.invoice_id}>
                  {l.invoice_no} — ₹{Number(l.amount).toLocaleString()} due{" "}
                  {new Date(l.due_date + "T12:00:00").toLocaleDateString()}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Amount</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
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
          </div>
          <div className="grid gap-1.5">
            <Label>Reference (optional)</Label>
            <Input value={ref} onChange={(e) => setRef(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button
            disabled={!invoiceId || !amount || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Record payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
