import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Check, ClipboardList, FileUp, Plus, Send } from "lucide-react"
import { Link } from "react-router-dom"
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
  createLead,
  ensureDefaultLeadSources,
  getApplications,
  getApprovedApplicationsWithAdmission,
  getClassesForSchool,
  getFeeStructuresForClass,
  getPendingApprovalApplications,
  getSectionsForClass,
  updateApplicationStatus,
  uploadApplicationDocument,
  type Application,
  type FeeBreakdownLine,
} from "../api/admissions.api"
import { AdmissionsFeeCatalog } from "../components/AdmissionsFeeCatalog"
import { AdmissionNumberLoginPanel } from "../components/AdmissionNumberLoginPanel"
import { AdmissionReviewDialog } from "../components/AdmissionReviewDialog"
import { ApplicationVerificationDetails } from "../components/ApplicationVerificationDetails"
import { supabase } from "@/lib/supabase"

const DOC_TYPES = ["Aadhaar", "Birth Certificate", "Transfer Certificate", "Photo"] as const

/** Stable fallback — `= []` in useQuery destructuring creates a new array every render. */
const EMPTY_FEE_STRUCTURES: { id: string; name: string; amount: number }[] = []

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

function splitName(full: string) {
  const parts = full.trim().split(/\s+/)
  if (parts.length <= 1) return { first: parts[0] ?? "", last: "—" }
  return { first: parts[0], last: parts.slice(1).join(" ") }
}

function ApplicationCard({
  app,
  canSubmit,
  canReview,
  onSubmit,
  onReview,
  onUpload,
}: {
  app: Application
  canSubmit?: boolean
  canReview?: boolean
  onSubmit?: () => void
  onReview?: () => void
  onUpload: (appId: string, file: File, type: string) => void
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle className="text-lg">{app.leads?.student_name ?? app.application_no}</CardTitle>
          <CardDescription>
            {app.application_no} · {app.class_applying}
            {app.leads?.lead_sources?.name ? ` · ${app.leads.lead_sources.name}` : ""}
          </CardDescription>
        </div>
        <Badge>{app.status.replace(/_/g, " ")}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <ApplicationVerificationDetails app={app} />

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
                    if (f) onUpload(app.id, f, docType)
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
          {canSubmit && app.status === "draft" && (
            <Button size="sm" onClick={onSubmit}>
              Submit to VP
            </Button>
          )}
          {canReview && (
            <Button size="sm" variant="default" className="gap-1" onClick={onReview}>
              <ClipboardList className="h-3 w-3" /> Review & approve
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function AdmissionsWorkspace() {
  const activeSchoolId = useAuth((s) => s.activeSchoolId)
  const activeRole = useAuth((s) => s.activeRole)
  const qc = useQueryClient()

  const canApprove = activeRole === "principal" || activeRole === "vice_principal"
  const canCreate =
    activeRole === "receptionist" ||
    activeRole === "admission_manager" ||
    activeRole === "principal" ||
    activeRole === "vice_principal"
  const canViewFeeCatalog =
    activeRole === "admission_manager" ||
    activeRole === "counselor" ||
    activeRole === "receptionist" ||
    canApprove
  const isReception = activeRole === "receptionist"
  const isAdmissionManager = activeRole === "admission_manager"

  const [activeTab, setActiveTab] = useState("queue")
  const [reviewApp, setReviewApp] = useState<Application | null>(null)

  // New application form state
  const [studentName, setStudentName] = useState("")
  const [studentEmail, setStudentEmail] = useState("")
  const [dob, setDob] = useState("")
  const [gender, setGender] = useState("")
  const [address, setAddress] = useState("")
  const [previousSchool, setPreviousSchool] = useState("")
  const [identityNumber, setIdentityNumber] = useState("")
  const [parentName, setParentName] = useState("")
  const [parentPhone, setParentPhone] = useState("")
  const [parentEmail, setParentEmail] = useState("")
  const [classId, setClassId] = useState("")
  const [sectionId, setSectionId] = useState("")
  const [needsHostel, setNeedsHostel] = useState(false)
  const [needsTransport, setNeedsTransport] = useState(false)
  const [feeBreakdown, setFeeBreakdown] = useState<FeeBreakdownLine[]>([])
  const [commitmentDate, setCommitmentDate] = useState("")

  const { data: academicYear } = useQuery({
    queryKey: ["current-ay", activeSchoolId],
    queryFn: async () => {
      const { data } = await supabase
        .from("academic_years")
        .select("id")
        .eq("school_id", activeSchoolId!)
        .eq("is_current", true)
        .maybeSingle()
      return data
    },
    enabled: !!activeSchoolId,
  })

  const { data: queueApps = [], isLoading: queueLoading } = useQuery({
    queryKey: ["applications-queue", activeSchoolId],
    queryFn: () => getApplications(activeSchoolId!, { excludeApproved: true }),
    enabled: !!activeSchoolId,
  })

  const { data: pendingApps = [], isLoading: pendingLoading } = useQuery({
    queryKey: ["applications-pending", activeSchoolId],
    queryFn: () => getPendingApprovalApplications(activeSchoolId!),
    enabled: !!activeSchoolId && canApprove,
  })

  useEffect(() => {
    if (canApprove && pendingApps.length > 0) {
      setActiveTab((tab) => (tab === "queue" ? "approvals" : tab))
    }
  }, [canApprove, pendingApps.length])

  const { data: approvedApps = [], isLoading: approvedLoading } = useQuery({
    queryKey: ["applications-approved", activeSchoolId],
    queryFn: () => getApprovedApplicationsWithAdmission(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const { data: classes = [] } = useQuery({
    queryKey: ["admission-classes", activeSchoolId],
    queryFn: () => getClassesForSchool(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const { data: sections = [] } = useQuery({
    queryKey: ["admission-sections", activeSchoolId, classId, academicYear?.id],
    queryFn: () => getSectionsForClass(activeSchoolId!, academicYear!.id, classId),
    enabled: !!activeSchoolId && !!academicYear?.id && !!classId,
  })

  const { data: feeStructuresRaw } = useQuery({
    queryKey: ["admission-fees", activeSchoolId, classId, academicYear?.id],
    queryFn: () => getFeeStructuresForClass(activeSchoolId!, academicYear!.id, classId),
    enabled: !!activeSchoolId && !!academicYear?.id && !!classId,
  })
  const feeStructures = feeStructuresRaw ?? EMPTY_FEE_STRUCTURES

  useEffect(() => {
    if (feeStructures.length === 0) {
      setFeeBreakdown((prev) => (prev.length === 0 ? prev : []))
      return
    }
    setFeeBreakdown(
      feeStructures.map((fs) => ({
        fee_structure_id: fs.id,
        name: fs.name,
        amount: Number(fs.amount),
        concession: 0,
      })),
    )
  }, [feeStructures, classId])

  const classApplying = useMemo(() => {
    const cls = classes.find((c) => c.id === classId)
    const sec = sections.find((s) => s.id === sectionId)
    if (cls && sec) return `${cls.name} - ${sec.name}`
    if (cls) return cls.name
    return ""
  }, [classes, sections, classId, sectionId])

  const feeTotal = feeBreakdown.reduce(
    (sum, line) => sum + line.amount - (line.concession ?? 0),
    0,
  )

  const formValid =
    studentName.trim() &&
    parentName.trim() &&
    parentPhone.trim() &&
    classId &&
    sectionId &&
    classApplying

  function resetForm() {
    setStudentName("")
    setStudentEmail("")
    setDob("")
    setGender("")
    setAddress("")
    setPreviousSchool("")
    setIdentityNumber("")
    setParentName("")
    setParentPhone("")
    setParentEmail("")
    setClassId("")
    setSectionId("")
    setNeedsHostel(false)
    setNeedsTransport(false)
    setFeeBreakdown([])
    setCommitmentDate("")
  }

  const createAppMutation = useMutation({
    mutationFn: async (submitToVp: boolean) => {
      const sources = await ensureDefaultLeadSources(activeSchoolId!)
      const walkIn = sources.find((s) => s.name.toLowerCase().includes("walk"))

      const lead = await createLead({
        schoolId: activeSchoolId!,
        studentName: studentName.trim(),
        parentName: parentName.trim(),
        parentPhone: parentPhone.trim(),
        parentEmail: parentEmail.trim() || undefined,
        leadSourceId: walkIn?.id,
        classInterested: classApplying,
      })

      const { first, last } = splitName(studentName.trim())
      const { first: pFirst, last: pLast } = splitName(parentName.trim())

      const app = await createApplication({
        schoolId: activeSchoolId!,
        leadId: lead.id,
        classApplying,
        academicYearId: academicYear?.id,
        classId,
        sectionId,
        needsHostel,
        needsTransport,
        identityType: identityNumber ? "Aadhaar" : undefined,
        identityNumber: identityNumber.trim() || undefined,
        formData: {
          first_name: first,
          last_name: last,
          student_email: studentEmail.trim(),
          parent_first_name: pFirst,
          parent_last_name: pLast,
          parent_email: parentEmail.trim(),
          date_of_birth: dob || undefined,
          gender: gender || undefined,
          address: address.trim() || undefined,
          previous_school: previousSchool.trim() || undefined,
        },
      })

      if (academicYear?.id && feeBreakdown.length > 0) {
        await createFeeCommitment({
          schoolId: activeSchoolId!,
          applicationId: app.id,
          academicYearId: academicYear.id,
          totalFee: feeTotal,
          commitmentDate: commitmentDate || undefined,
          feeBreakdown,
          schedule: [
            {
              amount: feeTotal,
              due_date: commitmentDate || new Date().toISOString().slice(0, 10),
              label: "Total",
            },
          ],
        })
      }

      if (submitToVp) {
        await updateApplicationStatus(app.id, "submitted")
      }

      return app
    },
    onSuccess: (_, submitToVp) => {
      toast.success(submitToVp ? "Submitted to VP for approval" : "Application saved as draft")
      qc.invalidateQueries({ queryKey: ["applications"] })
      resetForm()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const statusMutation = useMutation({
    mutationFn: (id: string) => updateApplicationStatus(id, "submitted"),
    onSuccess: () => {
      toast.success("Submitted to VP")
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

  function invalidateAll() {
    qc.invalidateQueries({ queryKey: ["applications"] })
    qc.invalidateQueries({ queryKey: ["students"] })
    qc.invalidateQueries({ queryKey: ["students-pending-login"] })
  }

  const handleUpload = (appId: string, file: File, type: string) => {
    uploadMutation.mutate({ appId, file, type })
  }

  if (!activeSchoolId) return null

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admissions</h1>
        <p className="text-muted-foreground mt-1">
          Application forms, documents, fee commitments, and VP approval workflow.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="queue">Queue ({queueApps.length})</TabsTrigger>
          {canApprove && (
            <TabsTrigger value="approvals">Approvals ({pendingApps.length})</TabsTrigger>
          )}
          <TabsTrigger value="approved">Approved ({approvedApps.length})</TabsTrigger>
          {canViewFeeCatalog && <TabsTrigger value="fee-guide">Fee catalog</TabsTrigger>}
          {canCreate && <TabsTrigger value="new">New application</TabsTrigger>}
        </TabsList>

        <TabsContent value="queue" className="space-y-4 mt-4">
          {queueLoading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : queueApps.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No pending applications.
              </CardContent>
            </Card>
          ) : (
            queueApps.map((app) => (
              <ApplicationCard
                key={app.id}
                app={app}
                canSubmit={isReception || isAdmissionManager || canCreate}
                onSubmit={() => statusMutation.mutate(app.id)}
                onUpload={handleUpload}
              />
            ))
          )}
        </TabsContent>

        {canApprove && (
          <TabsContent value="approvals" className="space-y-4 mt-4">
            {pendingLoading ? (
              <p className="text-muted-foreground">Loading…</p>
            ) : pendingApps.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No applications awaiting VP approval.
                </CardContent>
              </Card>
            ) : (
              pendingApps.map((app) => (
                <ApplicationCard
                  key={app.id}
                  app={app}
                  canReview
                  onReview={() => setReviewApp(app)}
                  onUpload={handleUpload}
                />
              ))
            )}
          </TabsContent>
        )}

        <TabsContent value="approved" className="space-y-4 mt-4">
          <AdmissionNumberLoginPanel schoolId={activeSchoolId} />

          {approvedLoading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : approvedApps.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No approved admissions yet.
              </CardContent>
            </Card>
          ) : (
            approvedApps.map((app) => {
              const student = app.admissions?.students
              const admissionNo = student?.admission_no
              const hasLogin = !!student?.profile_id
              return (
                <Card key={app.id}>
                  <CardHeader className="flex flex-row items-start justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-600" />
                        {app.leads?.student_name ?? app.application_no}
                      </CardTitle>
                      <CardDescription>
                        {app.application_no} · {app.class_applying}
                      </CardDescription>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {admissionNo && (
                        <Badge variant="default" className="text-sm">
                          Adm. {admissionNo}
                        </Badge>
                      )}
                      {student && (
                        <Badge variant={hasLogin ? "secondary" : "outline"}>
                          {hasLogin ? "Login sent" : "Login pending"}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <ApplicationVerificationDetails app={app} />
                    {admissionNo && !hasLogin && (
                      <Button size="sm" variant="outline" asChild>
                        <Link
                          to={`/students?admissionNo=${encodeURIComponent(admissionNo)}`}
                        >
                          <Send className="h-3.5 w-3.5 mr-1.5" />
                          Send portal login
                        </Link>
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )
            })
          )}
        </TabsContent>

        {canViewFeeCatalog && (
          <TabsContent value="fee-guide" className="mt-4">
            <AdmissionsFeeCatalog />
          </TabsContent>
        )}

        {canCreate && (
          <TabsContent value="new" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>New application</CardTitle>
                <CardDescription>
                  Enter student and parent details — a lead is created automatically. Submit to VP when
                  ready.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 max-w-2xl">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="grid gap-1.5 sm:col-span-2">
                    <Label>Student name *</Label>
                    <Input value={studentName} onChange={(e) => setStudentName(e.target.value)} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Student email</Label>
                    <Input
                      type="email"
                      value={studentEmail}
                      onChange={(e) => setStudentEmail(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Date of birth</Label>
                    <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Gender</Label>
                    <select
                      className={selectClass}
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                    >
                      <option value="">Select</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Aadhaar / ID number</Label>
                    <Input
                      value={identityNumber}
                      onChange={(e) => setIdentityNumber(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1.5 sm:col-span-2">
                    <Label>Address</Label>
                    <Input value={address} onChange={(e) => setAddress(e.target.value)} />
                  </div>
                  <div className="grid gap-1.5 sm:col-span-2">
                    <Label>Previous school</Label>
                    <Input
                      value={previousSchool}
                      onChange={(e) => setPreviousSchool(e.target.value)}
                    />
                  </div>
                </div>

                <div className="border-t pt-4 grid sm:grid-cols-2 gap-3">
                  <div className="grid gap-1.5 sm:col-span-2 font-medium text-sm">Parent / guardian</div>
                  <div className="grid gap-1.5 sm:col-span-2">
                    <Label>Parent name *</Label>
                    <Input value={parentName} onChange={(e) => setParentName(e.target.value)} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Parent phone *</Label>
                    <Input value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Parent email</Label>
                    <Input
                      type="email"
                      value={parentEmail}
                      onChange={(e) => setParentEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="border-t pt-4 grid sm:grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label>Class *</Label>
                    <select
                      className={selectClass}
                      value={classId}
                      onChange={(e) => {
                        setClassId(e.target.value)
                        setSectionId("")
                      }}
                    >
                      <option value="">Select class</option>
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Section *</Label>
                    <select
                      className={selectClass}
                      value={sectionId}
                      onChange={(e) => setSectionId(e.target.value)}
                      disabled={!classId}
                    >
                      <option value="">Select section</option>
                      {sections.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2 flex gap-4">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={needsHostel}
                        onChange={(e) => setNeedsHostel(e.target.checked)}
                      />
                      Needs hostel
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={needsTransport}
                        onChange={(e) => setNeedsTransport(e.target.checked)}
                      />
                      Needs transport
                    </label>
                  </div>
                </div>

                {feeBreakdown.length > 0 && (
                  <div className="border-t pt-4 space-y-2">
                    <Label>Fee breakdown</Label>
                    {feeBreakdown.map((line) => (
                      <div key={line.fee_structure_id} className="flex justify-between text-sm">
                        <span>{line.name}</span>
                        <span>₹{line.amount.toLocaleString("en-IN")}</span>
                      </div>
                    ))}
                    <p className="font-medium text-sm">Total: ₹{feeTotal.toLocaleString("en-IN")}</p>
                  </div>
                )}

                <div className="grid gap-1.5 max-w-xs">
                  <Label>Fee commitment date</Label>
                  <Input
                    type="date"
                    value={commitmentDate}
                    onChange={(e) => setCommitmentDate(e.target.value)}
                  />
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <Button
                    variant="outline"
                    disabled={!formValid || createAppMutation.isPending}
                    onClick={() => createAppMutation.mutate(false)}
                  >
                    Save draft
                  </Button>
                  <Button
                    disabled={!formValid || createAppMutation.isPending}
                    onClick={() => createAppMutation.mutate(true)}
                  >
                    <Plus className="h-4 w-4 mr-1" /> Submit to VP
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {reviewApp && (
        <AdmissionReviewDialog
          app={reviewApp}
          open={!!reviewApp}
          onClose={() => setReviewApp(null)}
          onDone={invalidateAll}
        />
      )}
    </div>
  )
}
