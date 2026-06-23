import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
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
import { useAuth } from "@/features/auth/hooks/useAuth"
import { recordPayment } from "../api/feeManagement.api"
import { supabase } from "@/lib/supabase"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PaymentEntryDialog({ open, onOpenChange }: Props) {
  const activeSchoolId = useAuth((s) => s.activeSchoolId)
  const qc = useQueryClient()
  const [studentQuery, setStudentQuery] = useState("")
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("")
  const [selectedStudentId, setSelectedStudentId] = useState("")
  const [amount, setAmount] = useState("")
  const [method, setMethod] = useState("cash")
  const [ref, setRef] = useState("")

  const { data: invoices = [] } = useQuery({
    queryKey: ["payment-invoices", activeSchoolId, studentQuery],
    queryFn: async () => {
      const { data: students } = await supabase
        .from("students")
        .select("id, admission_no, profiles:profile_id ( full_name )")
        .eq("school_id", activeSchoolId!)
        .or(`admission_no.ilike.%${studentQuery}%`)
        .limit(5)
      if (!students?.length) return []
      const ids = students.map((s) => s.id)
      const { data: inv } = await supabase
        .from("student_invoices")
        .select("id, student_id, invoice_no, due_amount, status")
        .in("student_id", ids)
        .in("status", ["pending", "partial", "overdue"])
      return (inv ?? []).map((i) => ({
        ...i,
        student: students.find((s) => s.id === i.student_id),
      }))
    },
    enabled: open && !!activeSchoolId && studentQuery.length >= 2,
  })

  const mutation = useMutation({
    mutationFn: () =>
      recordPayment(activeSchoolId!, {
        invoiceId: selectedInvoiceId,
        studentId: selectedStudentId,
        amount: Number(amount),
        method,
        transactionRef: ref,
        notes: "",
      }),
    onSuccess: () => {
      toast.success("Payment recorded")
      qc.invalidateQueries({ queryKey: ["finance"] })
      onOpenChange(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Search student (admission no.)</Label>
            <Input value={studentQuery} onChange={(e) => setStudentQuery(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Invoice</Label>
            <select
              className="flex h-10 rounded-md border px-3 text-sm w-full"
              value={selectedInvoiceId}
              onChange={(e) => {
                setSelectedInvoiceId(e.target.value)
                const inv = invoices.find((i) => i.id === e.target.value)
                if (inv) {
                  setSelectedStudentId(inv.student_id)
                  setAmount(String(inv.due_amount))
                }
              }}
            >
              <option value="">Select invoice</option>
              {invoices.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.invoice_no} — due {i.due_amount}
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
              <select className="flex h-10 rounded-md border px-3 text-sm" value={method} onChange={(e) => setMethod(e.target.value)}>
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="bank">Bank transfer</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Reference</Label>
            <Input value={ref} onChange={(e) => setRef(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button disabled={!selectedInvoiceId || !amount} onClick={() => mutation.mutate()}>
            Record payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
