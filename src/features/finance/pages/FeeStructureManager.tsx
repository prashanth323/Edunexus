import { useState } from "react"
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query"
import { Plus, Loader2, Trash2, DollarSign, Calendar, Send, Clock } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/features/auth/hooks/useAuth"
import {
  getFeeStructures,
  createFeeStructure,
  deleteFeeStructure,
  generateBulkInvoices,
  type FeeStructureInput,
} from "../api/feeManagement.api"
import { getSectionsForSchool } from "@/features/exams/api/exams.api"

const FREQUENCIES = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "half_yearly", label: "Half Yearly" },
  { value: "yearly", label: "Yearly" },
  { value: "one_time", label: "One-time" },
]

export function FeeStructureManager() {
  const activeSchoolId = useAuth((s) => s.activeSchoolId)
  const qc = useQueryClient()
  const [creating, setCreating] = useState(false)
  const [assigning, setAssigning] = useState<string | null>(null)

  // Fee structures
  const { data: structures = [], isLoading } = useQuery({
    queryKey: ["fee-structures", activeSchoolId],
    queryFn: () => getFeeStructures(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  // Sections for bulk assignment
  const { data: sections = [] } = useQuery({
    queryKey: ["sections-fee", activeSchoolId],
    queryFn: () => getSectionsForSchool(activeSchoolId!),
    enabled: !!activeSchoolId && assigning !== null,
  })

  // Create form state
  const [form, setForm] = useState<FeeStructureInput>({
    name: "",
    amount: 0,
    frequency: "monthly",
    due_day: 5,
    late_fine_per_day: 0,
    description: "",
  })
  const [submitting, setSubmitting] = useState(false)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!activeSchoolId) return
    if (!form.name.trim()) { toast.error("Fee name is required"); return }
    if (form.amount <= 0) { toast.error("Amount must be positive"); return }

    setSubmitting(true)
    try {
      await createFeeStructure(activeSchoolId, form)
      toast.success("Fee structure created")
      qc.invalidateQueries({ queryKey: ["fee-structures", activeSchoolId] })
      setCreating(false)
      setForm({ name: "", amount: 0, frequency: "monthly", due_day: 5, late_fine_per_day: 0, description: "" })
    } catch (err: any) {
      toast.error(err.message || "Failed to create fee structure")
    } finally {
      setSubmitting(false)
    }
  }

  const { mutate: handleDelete } = useMutation({
    mutationFn: deleteFeeStructure,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fee-structures", activeSchoolId] })
      toast.success("Fee structure removed")
    },
    onError: () => toast.error("Failed to remove"),
  })

  // Bulk assign state
  const [assignSectionId, setAssignSectionId] = useState("")
  const [assignDueDate, setAssignDueDate] = useState("")
  const [assignDesc, setAssignDesc] = useState("")
  const [bulkGenerating, setBulkGenerating] = useState(false)

  async function handleBulkGenerate() {
    if (!activeSchoolId || !assigning || !assignSectionId || !assignDueDate) {
      toast.error("Select a section and due date")
      return
    }
    setBulkGenerating(true)
    try {
      const count = await generateBulkInvoices(activeSchoolId, assigning, assignSectionId, assignDueDate, assignDesc)
      toast.success(`${count} invoices generated successfully`)
      setAssigning(null)
      setAssignSectionId("")
      setAssignDueDate("")
      setAssignDesc("")
    } catch (err: any) {
      toast.error(err.message || "Failed to generate invoices")
    } finally {
      setBulkGenerating(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 animate-in fade-in duration-500">
        <div><h1 className="text-3xl font-bold tracking-tight">Fee Structures</h1></div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fee Structures</h1>
          <p className="text-muted-foreground mt-1">
            Define fee plans and assign them to classes to auto-generate student invoices.
          </p>
        </div>
        <Button className="gap-2" onClick={() => setCreating(!creating)}>
          <Plus className="h-4 w-4" /> New Fee Structure
        </Button>
      </div>

      {/* Create form */}
      {creating && (
        <Card className="border-primary/30 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Create Fee Structure
            </CardTitle>
            <CardDescription>Define a recurring or one-time fee plan.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="sm:col-span-2 lg:col-span-3 space-y-1.5">
                  <Label>Fee Name</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Tuition Fee, Transport Fee, Lab Fee"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Amount ($)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Frequency</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.frequency}
                    onChange={(e) => setForm({ ...form, frequency: e.target.value })}
                  >
                    {FREQUENCIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Due Day of Month</Label>
                  <Input
                    type="number"
                    min={1}
                    max={28}
                    value={form.due_day || ""}
                    onChange={(e) => setForm({ ...form, due_day: Number(e.target.value) || null })}
                    placeholder="e.g. 5"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Late Fine ($/day)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.late_fine_per_day || ""}
                    onChange={(e) => setForm({ ...form, late_fine_per_day: Number(e.target.value) || null })}
                    placeholder="0"
                  />
                </div>
                <div className="sm:col-span-2 lg:col-span-2 space-y-1.5">
                  <Label>Description</Label>
                  <Input
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Optional notes"
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create
                </Button>
                <Button type="button" variant="outline" onClick={() => setCreating(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Bulk assign modal */}
      {assigning && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setAssigning(null) }}
        >
          <Card className="w-full max-w-md shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5 text-primary" />
                Generate Invoices
              </CardTitle>
              <CardDescription>
                Assign <strong>{structures.find((s) => s.id === assigning)?.name}</strong> to all students in a class/section.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Class / Section</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={assignSectionId}
                  onChange={(e) => setAssignSectionId(e.target.value)}
                >
                  <option value="">Select…</option>
                  {sections.map((s: any) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Due Date</Label>
                <Input type="date" value={assignDueDate} onChange={(e) => setAssignDueDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Description (optional)</Label>
                <Input value={assignDesc} onChange={(e) => setAssignDesc(e.target.value)} placeholder="e.g. Term 1 Tuition" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => setAssigning(null)}>Cancel</Button>
                <Button onClick={handleBulkGenerate} disabled={bulkGenerating || !assignSectionId || !assignDueDate}>
                  {bulkGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Generate Invoices
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Fee structure cards */}
      {structures.length === 0 && !creating ? (
        <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed rounded-xl text-muted-foreground">
          <DollarSign className="h-14 w-14 opacity-30 mb-4" />
          <h3 className="text-lg font-semibold text-foreground">No fee structures</h3>
          <p className="text-sm mt-1 max-w-md text-center">
            Create a fee structure to start generating invoices for students.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {structures.map((fs) => (
            <Card key={fs.id} className="flex flex-col hover:border-primary/40 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start gap-2">
                  <CardTitle className="text-lg">{fs.name}</CardTitle>
                  <Badge variant="outline" className="capitalize text-[10px] shrink-0">{fs.frequency.replace(/_/g, " ")}</Badge>
                </div>
                {fs.description && (
                  <CardDescription className="mt-1">{fs.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="flex-1 space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <DollarSign className="h-3.5 w-3.5" />
                  <span className="font-semibold text-foreground text-lg">${Number(fs.amount).toLocaleString()}</span>
                  <span>per {fs.frequency.replace(/_/g, " ")}</span>
                </div>
                {fs.due_day && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Due: {fs.due_day}th of each period</span>
                  </div>
                )}
                {fs.late_fine_per_day && Number(fs.late_fine_per_day) > 0 && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Late fine: ${Number(fs.late_fine_per_day)}/day</span>
                  </div>
                )}
              </CardContent>
              <CardFooter className="border-t pt-3 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1.5"
                  onClick={() => setAssigning(fs.id)}
                >
                  <Send className="h-3.5 w-3.5" /> Assign to Class
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                  onClick={() => handleDelete(fs.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
