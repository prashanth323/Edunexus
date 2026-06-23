import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import { Check, FileUp, Plus, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/features/auth/hooks/useAuth"
import {
  createApplication,
  createFeeCommitment,
  getApplications,
  updateApplicationStatus,
  uploadApplicationDocument,
  type Application,
} from "../api/admissions.api"
import { getLeads } from "@/features/crm/api/crm.api"
import { approveHalfDayRequest, getHalfDayRequests } from "@/features/attendance/api/halfDay.api"
import { supabase } from "@/lib/supabase"

const DOC_TYPES = ["Aadhaar", "Birth Certificate", "Transfer Certificate", "Photo"] as const

export function AdmissionsWorkspace() {
  const activeSchoolId = useAuth((s) => s.activeSchoolId)
  const activeRole = useAuth((s) => s.activeRole)
  const qc = useQueryClient()
  const [selectedLeadId, setSelectedLeadId] = useState("")
  const [classApplying, setClassApplying] = useState("")
  const [totalFee, setTotalFee] = useState("")
  const [commitmentDate, setCommitmentDate] = useState("")
  const [needsHostel, setNeedsHostel] = useState(false)
  const [needsTransport, setNeedsTransport] = useState(false)

  const canApprove = activeRole === "principal" || activeRole === "vice_principal"
  const isReception = activeRole === "receptionist"

  const { data: applications = [], isLoading } = useQuery({
    queryKey: ["applications", activeSchoolId],
    queryFn: () => getApplications(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const { data: leads = [] } = useQuery({
    queryKey: ["admission-leads", activeSchoolId],
    queryFn: () => getLeads(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const { data: halfDayPending = [] } = useQuery({
    queryKey: ["half-day-pending", activeSchoolId],
    queryFn: () => getHalfDayRequests(activeSchoolId!, "pending"),
    enabled: !!activeSchoolId && canApprove,
  })

  const createAppMutation = useMutation({
    mutationFn: async () => {
      const { data: ay } = await supabase
        .from("academic_years")
        .select("id")
        .eq("school_id", activeSchoolId!)
        .eq("is_current", true)
        .maybeSingle()

      const app = await createApplication({
        schoolId: activeSchoolId!,
        leadId: selectedLeadId,
        classApplying,
        academicYearId: ay?.id,
        needsHostel,
        needsTransport,
        formData: { class: classApplying },
      })

      if (totalFee && ay?.id) {
        await createFeeCommitment({
          schoolId: activeSchoolId!,
          applicationId: app.id,
          academicYearId: ay.id,
          totalFee: Number(totalFee),
          commitmentDate: commitmentDate || undefined,
          schedule: [{
            amount: Number(totalFee),
            due_date: commitmentDate || new Date().toISOString().slice(0, 10),
            label: "Total",
          }],
        })
      }

      return app
    },
    onSuccess: () => {
      toast.success("Application created")
      qc.invalidateQueries({ queryKey: ["applications"] })
      setSelectedLeadId("")
      setClassApplying("")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: Application["status"]; reason?: string }) =>
      updateApplicationStatus(id, status, reason),
    onSuccess: () => {
      toast.success("Status updated")
      qc.invalidateQueries({ queryKey: ["applications"] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const uploadMutation = useMutation({
    mutationFn: ({ appId, file, type }: { appId: string; file: File; type: string }) =>
      uploadApplicationDocument(activeSchoolId!, appId, file, type),
    onSuccess: () => {
      toast.success("Document uploaded")
      qc.invalidateQueries({ queryKey: ["applications"] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const approveHalfDay = useMutation({
    mutationFn: approveHalfDayRequest,
    onSuccess: () => {
      toast.success("Half-day approved")
      qc.invalidateQueries({ queryKey: ["half-day-pending"] })
    },
  })

  if (!activeSchoolId) return null

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admissions</h1>
        <p className="text-muted-foreground mt-1">
          Application forms, documents, fee commitments, and approval workflow.
        </p>
      </div>

      <Tabs defaultValue="queue">
        <TabsList>
          <TabsTrigger value="queue">Applications ({applications.length})</TabsTrigger>
          {(isReception || canApprove) && <TabsTrigger value="new">New application</TabsTrigger>}
          {canApprove && <TabsTrigger value="half-day">Half-day ({halfDayPending.length})</TabsTrigger>}
        </TabsList>

        <TabsContent value="queue" className="space-y-4 mt-4">
          {isLoading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : applications.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No applications yet.</CardContent></Card>
          ) : (
            applications.map((app) => (
              <Card key={app.id}>
                <CardHeader className="flex flex-row items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{app.leads?.student_name ?? app.application_no}</CardTitle>
                    <CardDescription>
                      {app.application_no} · {app.class_applying} · {app.leads?.lead_sources?.name ?? "—"}
                    </CardDescription>
                  </div>
                  <Badge>{app.status.replace(/_/g, " ")}</Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                    <span>Parent: {app.leads?.parent_name}</span>
                    <span>·</span>
                    <span>{app.leads?.parent_phone}</span>
                    {app.needs_hostel && <Badge variant="outline">Hostel</Badge>}
                    {app.needs_transport && <Badge variant="outline">Transport</Badge>}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {DOC_TYPES.map((docType) => {
                      const uploaded = app.documents.find((d) => d.type === docType)
                      return (
                        <label key={docType} className="inline-flex">
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*,.pdf"
                            onChange={(e) => {
                              const f = e.target.files?.[0]
                              if (f) uploadMutation.mutate({ appId: app.id, file: f, type: docType })
                            }}
                          />
                          <Button variant="outline" size="sm" type="button" asChild>
                            <span>
                              <FileUp className="h-3 w-3 mr-1" />
                              {uploaded ? `${docType} ✓` : docType}
                            </span>
                          </Button>
                        </label>
                      )
                    })}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {isReception && app.status === "draft" && (
                      <Button size="sm" onClick={() => statusMutation.mutate({ id: app.id, status: "submitted" })}>
                        Submit for review
                      </Button>
                    )}
                    {canApprove && app.status === "submitted" && (
                      <Button size="sm" onClick={() => statusMutation.mutate({ id: app.id, status: "under_review" })}>
                        Start review
                      </Button>
                    )}
                    {canApprove && ["submitted", "under_review", "documents_pending"].includes(app.status) && (
                      <>
                        <Button size="sm" variant="default" className="gap-1" onClick={() => statusMutation.mutate({ id: app.id, status: "approved" })}>
                          <Check className="h-3 w-3" /> Approve
                        </Button>
                        <Button size="sm" variant="destructive" className="gap-1" onClick={() => statusMutation.mutate({ id: app.id, status: "rejected", reason: "Not eligible" })}>
                          <X className="h-3 w-3" /> Reject
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="new" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>New application</CardTitle>
              <CardDescription>Link a lead and capture admission details</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 max-w-lg">
              <div className="grid gap-1.5">
                <Label>Lead</Label>
                <select
                  className="flex h-10 rounded-md border border-input bg-background px-3 text-sm w-full"
                  value={selectedLeadId}
                  onChange={(e) => setSelectedLeadId(e.target.value)}
                >
                  <option value="">Select lead</option>
                  {leads.map((l) => (
                    <option key={l.id} value={l.id}>{l.student_name} — {l.parent_phone}</option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label>Class applying</Label>
                <Input value={classApplying} onChange={(e) => setClassApplying(e.target.value)} />
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={needsHostel} onChange={(e) => setNeedsHostel(e.target.checked)} />
                  Needs hostel
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={needsTransport} onChange={(e) => setNeedsTransport(e.target.checked)} />
                  Needs transport
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Total fee</Label>
                  <Input type="number" value={totalFee} onChange={(e) => setTotalFee(e.target.value)} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Commitment date</Label>
                  <Input type="date" value={commitmentDate} onChange={(e) => setCommitmentDate(e.target.value)} />
                </div>
              </div>
              <Button
                disabled={!selectedLeadId || !classApplying || createAppMutation.isPending}
                onClick={() => createAppMutation.mutate()}
              >
                <Plus className="h-4 w-4 mr-1" /> Create application
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {canApprove && (
          <TabsContent value="half-day" className="mt-4 space-y-3">
            {halfDayPending.length === 0 ? (
              <p className="text-muted-foreground">No pending half-day requests.</p>
            ) : (
              halfDayPending.map((req) => (
                <Card key={req.id}>
                  <CardContent className="py-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium">{req.students?.profiles?.full_name ?? "Student"}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(req.request_date), "MMM d, yyyy")} — {req.reason}
                      </p>
                    </div>
                    <Button size="sm" onClick={() => approveHalfDay.mutate(req.id)}>Approve</Button>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
