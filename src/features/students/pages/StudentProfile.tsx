import { useState } from "react"
import { useParams, Link } from "react-router-dom"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import {
  ArrowLeft,
  ArrowRightLeft,
  CreditCard,
  Edit2,
  FileText,
  GraduationCap,
  Hash,
  IdCard,
  Loader2,
  Save,
  User,
  Users,
  Bus,
  Home,
  ExternalLink,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useStudentDocumentsDisplayUrl } from "@/features/students/hooks/useStudentDocumentsDisplayUrl"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { invalidateAfterStudentPortraitChange } from "@/lib/invalidateProfilePortraits"
import {
  getSchoolDisplayName,
  getStudentProfile,
  updateStudentProfile,
  assignRollNumber,
  generateRollNumber,
} from "../api/studentProfile.api"
import { PhotoUpload } from "../components/PhotoUpload"
import { DocumentUpload } from "../components/DocumentUpload"
import { TransferSectionDialog } from "../components/TransferSectionDialog"
import { IdCardGenerator } from "../components/IdCardGenerator"
import { buildStudentIdCardData } from "../lib/studentIdCardData"
import { ClassTeacherCard } from "@/components/school/ClassTeacherCard"
import { StudentHostelStatusPanel } from "@/features/hostel/components/StudentHostelStatusPanel"
import { StudentPortalCredentialsPanel } from "@/features/students/components/StudentPortalCredentialsPanel"
import { canViewPortalCredentials } from "@/features/students/api/portalCredentials.api"
import {
  getStudentClassTeacher,
  canEditStudentDetails,
  getStudentServiceDetails,
} from "../api/studentService.api"

const HOSTEL_ACCESS = new Set(["vice_principal"])
const TRANSPORT_ACCESS = new Set(["vice_principal"])

const editSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  gender: z.string().nullable(),
  date_of_birth: z.string().nullable(),
  blood_group: z.string().nullable(),
  nationality: z.string().nullable(),
  religion: z.string().nullable(),
  category: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().email().nullable().or(z.literal("")),
  address_street: z.string().nullable(),
  address_city: z.string().nullable(),
  address_state: z.string().nullable(),
  address_zip: z.string().nullable(),
})

type EditValues = z.infer<typeof editSchema>

const CAN_MANAGE_ACADEMICS = new Set(["principal", "school_admin", "vice_principal", "accountant"])

type StudentProfileProps = {
  portalMode?: boolean
  studentIdOverride?: string | null
}

function PortalPhoto({ photoUrl, name }: { photoUrl: string | null | undefined; name: string }) {
  const displayUrl = useStudentDocumentsDisplayUrl(photoUrl)
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
  return (
    <Avatar className="h-24 w-24 border-2 border-background shadow-md">
      {displayUrl ? <AvatarImage src={displayUrl} alt={name} /> : null}
      <AvatarFallback>{initials || "?"}</AvatarFallback>
    </Avatar>
  )
}

export function StudentProfile({ portalMode = false, studentIdOverride }: StudentProfileProps = {}) {
  const { studentId: routeStudentId } = useParams<{ studentId: string }>()
  const effectiveStudentId = studentIdOverride ?? routeStudentId
  const activeRole = useAuth((s) => s.activeRole)
  const qc = useQueryClient()

  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const [generatingRoll, setGeneratingRoll] = useState(false)

  const { data: student, isLoading } = useQuery({
    queryKey: ["student-profile", effectiveStudentId],
    queryFn: () => getStudentProfile(effectiveStudentId!),
    enabled: !!effectiveStudentId,
  })

  const { data: schoolDisplayName } = useQuery({
    queryKey: ["school-display-name", student?.school_id],
    queryFn: () => getSchoolDisplayName(student!.school_id),
    enabled: !!student?.school_id,
  })

  const { data: classTeacher } = useQuery({
    queryKey: ["student-class-teacher", effectiveStudentId],
    queryFn: () => getStudentClassTeacher(effectiveStudentId!),
    enabled: !!effectiveStudentId,
  })

  const { data: editAccess } = useQuery({
    queryKey: ["can-edit-student", effectiveStudentId],
    queryFn: () => canEditStudentDetails(effectiveStudentId!),
    enabled: !!effectiveStudentId && !portalMode,
  })

  const { data: serviceDetails } = useQuery({
    queryKey: ["student-service-details", effectiveStudentId],
    queryFn: () => getStudentServiceDetails(effectiveStudentId!),
    enabled: !!effectiveStudentId,
  })

  const canEdit = !portalMode && (editAccess?.allowed ?? false)
  const canManageAcademics = CAN_MANAGE_ACADEMICS.has(activeRole ?? "")
  const showPortalCredentials = !portalMode && canViewPortalCredentials(activeRole)
  const canManageHostel = HOSTEL_ACCESS.has(activeRole ?? "")
  const canManageTransport = TRANSPORT_ACCESS.has(activeRole ?? "")

  function hostelStatusLabel() {
    if (!serviceDetails || serviceDetails.transport_mode !== "hostel") return "—"
    if (serviceDetails.has_hostel_allocation && serviceDetails.hostel_room) {
      return serviceDetails.hostel_room
    }
    return "Pending allocation"
  }

  function transportStatusLabel() {
    if (!serviceDetails || serviceDetails.transport_mode !== "school_bus") return "—"
    if (serviceDetails.has_route_assignment && serviceDetails.route_name) {
      return serviceDetails.route_name
    }
    return "Pending allocation"
  }

  const form = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      gender: null,
      date_of_birth: null,
      blood_group: null,
      nationality: null,
      religion: null,
      category: null,
      phone: null,
      email: null,
      address_street: null,
      address_city: null,
      address_state: null,
      address_zip: null,
    },
  })

  function startEditing() {
    if (!student) return
    const addr = student.address ?? {}
    form.reset({
      first_name: student.first_name,
      last_name: student.last_name,
      gender: student.gender,
      date_of_birth: student.date_of_birth,
      blood_group: student.blood_group,
      nationality: student.nationality,
      religion: student.religion,
      category: student.category,
      phone: student.phone,
      email: student.email,
      address_street: addr.street ?? null,
      address_city: addr.city ?? null,
      address_state: addr.state ?? null,
      address_zip: addr.zip ?? null,
    })
    setEditing(true)
  }

  async function onSave(values: EditValues) {
    if (!student) return
    setSaving(true)
    try {
      const {
        address_street,
        address_city,
        address_state,
        address_zip,
        ...rest
      } = values
      const updates: Record<string, unknown> = { ...rest }
      if (updates.email === "") updates.email = null
      updates.address = {
        street: address_street?.trim() || "",
        city: address_city?.trim() || "",
        state: address_state?.trim() || "",
        zip: address_zip?.trim() || "",
      }
      await updateStudentProfile(student.id, updates)
      toast.success("Student details updated")
      qc.invalidateQueries({ queryKey: ["student-profile", effectiveStudentId] })
      setEditing(false)
    } catch (err: any) {
      toast.error(err.message || "Update failed")
    } finally {
      setSaving(false)
    }
  }

  async function handleGenerateRollNo() {
    if (!student?.enrollment) return
    setGeneratingRoll(true)
    try {
      const rollNo = await generateRollNumber(student.enrollment.section_id)
      await assignRollNumber(student.enrollment.id, rollNo)
      toast.success(`Roll number assigned: ${rollNo}`)
      qc.invalidateQueries({ queryKey: ["student-profile", effectiveStudentId] })
    } catch (err: any) {
      toast.error(err.message || "Failed to generate roll number")
    } finally {
      setGeneratingRoll(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 animate-in fade-in duration-500 max-w-5xl mx-auto">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-[200px] rounded-xl" />
          <Skeleton className="h-[200px] rounded-xl md:col-span-2" />
        </div>
        <Skeleton className="h-[400px] rounded-xl" />
      </div>
    )
  }

  if (!student) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <User className="h-16 w-16 text-muted-foreground/40" />
        <h2 className="text-xl font-semibold">Student not found</h2>
        <Button asChild variant="outline">
          <Link to={portalMode ? "/" : "/students"}>← Back</Link>
        </Button>
      </div>
    )
  }

  const fullName = `${student.first_name} ${student.last_name}`
  const enrollment = student.enrollment
  const totalPending = student.invoices.reduce((sum, inv) => sum + Number(inv.due_amount ?? 0), 0)

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 max-w-5xl mx-auto">
      {transferOpen && enrollment && (
        <TransferSectionDialog
          studentId={student.id}
          studentName={fullName}
          schoolId={student.school_id}
          currentEnrollmentId={enrollment.id}
          currentSectionName={enrollment.section.name}
          currentClassName={enrollment.section.class.name}
          academicYearId={enrollment.academic_year_id}
          onClose={() => setTransferOpen(false)}
          onSuccess={() => qc.invalidateQueries({ queryKey: ["student-profile", effectiveStudentId] })}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link to={portalMode ? "/" : "/students"}><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              {portalMode ? "Student profile" : fullName}
            </h1>
            <p className="text-muted-foreground flex items-center gap-2 mt-0.5 flex-wrap">
              {portalMode && <span className="text-sm font-medium text-foreground">{fullName}</span>}
              <Badge variant="outline" className="text-xs">{student.admission_no}</Badge>
              {enrollment && (
                <span className="text-sm">
                  {enrollment.section.class.name} — Section {enrollment.section.name}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {canEdit && !editing && (
            <Button variant="outline" size="sm" className="gap-2" onClick={startEditing}>
              <Edit2 className="h-4 w-4" /> Edit Details
            </Button>
          )}
          {canManageAcademics && !portalMode && enrollment && (
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setTransferOpen(true)}>
              <ArrowRightLeft className="h-4 w-4" /> Transfer Section
            </Button>
          )}
        </div>
      </div>

      {/* Summary cards — admission, fees, documents first */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Admission no.</CardTitle>
            <Hash className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{student.admission_no}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Fees</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-xl font-bold ${totalPending > 0 ? "text-destructive" : "text-green-600"}`}>
              ${totalPending.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {student.invoices.length} invoice(s)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Documents</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              {Array.isArray(student.documents) ? student.documents.length : 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Uploaded files</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Class</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              {enrollment
                ? `${enrollment.section.class.name} - ${enrollment.section.name}`
                : "Not enrolled"}
            </div>
            {enrollment?.academic_year && (
              <p className="text-xs text-muted-foreground mt-1">{enrollment.academic_year.name}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Roll Number</CardTitle>
            <Hash className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{enrollment?.roll_no || "Not assigned"}</div>
            {canManageAcademics && enrollment && !enrollment.roll_no && (
              <Button
                variant="link"
                size="sm"
                className="p-0 h-auto text-xs mt-1"
                onClick={handleGenerateRollNo}
                disabled={generatingRoll}
              >
                {generatingRoll && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                Auto-generate
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Parents Linked</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{student.parents.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {student.parents.length === 0 ? "No parents linked" : student.parents.map((p) => p.relation).join(", ")}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ClassTeacherCard
          classTeacherName={classTeacher?.class_teacher_name}
          classTeacherPhone={classTeacher?.class_teacher_phone}
          classTeacherEmail={classTeacher?.class_teacher_email}
        />
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Service & boarding</CardTitle>
            <CardDescription>
              Preference set by parents; VP allocates hostel rooms and bus routes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground">Preference</span>
              <Badge variant="outline" className="capitalize">
                {(serviceDetails?.transport_mode ?? "self").replace(/_/g, " ")}
              </Badge>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wide">Hostel</p>
                <p className="font-medium mt-0.5">{hostelStatusLabel()}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wide">Transport</p>
                <p className="font-medium mt-0.5">{transportStatusLabel()}</p>
              </div>
            </div>
            {(serviceDetails?.parent_phone || serviceDetails?.parent_email) && (
              <div className="pt-1 border-t text-xs text-muted-foreground space-y-0.5">
                {serviceDetails.parent_phone && <p>Parent phone: {serviceDetails.parent_phone}</p>}
                {serviceDetails.parent_email && <p>Parent email: {serviceDetails.parent_email}</p>}
              </div>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              {canManageHostel && serviceDetails?.transport_mode === "hostel" && (
                <Button variant="outline" size="sm" className="gap-1.5 h-8" asChild>
                  <Link
                    to={`/hostel?tab=allocate&admissionNo=${encodeURIComponent(serviceDetails.admission_no)}`}
                  >
                    <Home className="h-3.5 w-3.5" />
                    Manage hostel
                    <ExternalLink className="h-3 w-3 opacity-60" />
                  </Link>
                </Button>
              )}
              {canManageTransport && serviceDetails?.transport_mode === "school_bus" && (
                <Button variant="outline" size="sm" className="gap-1.5 h-8" asChild>
                  <Link
                    to={`/transport?tab=allocate&admissionNo=${encodeURIComponent(serviceDetails.admission_no)}`}
                  >
                    <Bus className="h-3.5 w-3.5" />
                    Manage transport
                    <ExternalLink className="h-3 w-3 opacity-60" />
                  </Link>
                </Button>
              )}
            </div>
            <StudentHostelStatusPanel
              studentId={student.id}
              transportMode={serviceDetails?.transport_mode}
            />
          </CardContent>
        </Card>
      </div>

      {showPortalCredentials && (
        <StudentPortalCredentialsPanel studentId={student.id} />
      )}

      {/* Tabs */}
      <Tabs defaultValue="personal" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5 max-w-xl">
          <TabsTrigger value="personal"><User className="h-3.5 w-3.5 mr-1.5" />Personal</TabsTrigger>
          <TabsTrigger value="documents"><FileText className="h-3.5 w-3.5 mr-1.5" />Docs</TabsTrigger>
          <TabsTrigger value="parents"><Users className="h-3.5 w-3.5 mr-1.5" />Parents</TabsTrigger>
          <TabsTrigger value="fees"><CreditCard className="h-3.5 w-3.5 mr-1.5" />Fees</TabsTrigger>
          <TabsTrigger value="idcard"><IdCard className="h-3.5 w-3.5 mr-1.5" />ID Card</TabsTrigger>
        </TabsList>

        {/* Personal Tab */}
        <TabsContent value="personal">
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>Student demographic and contact details.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-6">
                {portalMode ? (
                  <PortalPhoto photoUrl={student.photo_url} name={fullName} />
                ) : (
                  <PhotoUpload
                    schoolId={student.school_id}
                    studentId={student.id}
                    currentPhotoUrl={student.photo_url}
                    studentName={fullName}
                    onUploaded={() =>
                      invalidateAfterStudentPortraitChange(qc, {
                        schoolId: student.school_id,
                        studentId: student.id,
                      })
                    }
                  />
                )}
                <div className="flex-1">
                  {editing ? (
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSave)} className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <FormField control={form.control} name="first_name" render={({ field }) => (
                            <FormItem><FormLabel>First Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField control={form.control} name="last_name" render={({ field }) => (
                            <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField control={form.control} name="gender" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Gender</FormLabel>
                              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...field} value={field.value || ""}>
                                <option value="">Select</option>
                                <option value="male">Male</option>
                                <option value="female">Female</option>
                                <option value="other">Other</option>
                              </select>
                            </FormItem>
                          )} />
                          <FormField control={form.control} name="date_of_birth" render={({ field }) => (
                            <FormItem><FormLabel>Date of Birth</FormLabel><FormControl><Input type="date" {...field} value={field.value || ""} /></FormControl></FormItem>
                          )} />
                          <FormField control={form.control} name="blood_group" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Blood Group</FormLabel>
                              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...field} value={field.value || ""}>
                                <option value="">Select</option>
                                {["A+","A-","B+","B-","AB+","AB-","O+","O-"].map((bg) => <option key={bg} value={bg}>{bg}</option>)}
                              </select>
                            </FormItem>
                          )} />
                          <FormField control={form.control} name="nationality" render={({ field }) => (
                            <FormItem><FormLabel>Nationality</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl></FormItem>
                          )} />
                          <FormField control={form.control} name="religion" render={({ field }) => (
                            <FormItem><FormLabel>Religion</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl></FormItem>
                          )} />
                          <FormField control={form.control} name="category" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Category</FormLabel>
                              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...field} value={field.value || ""}>
                                <option value="">Select</option>
                                <option value="general">General</option>
                                <option value="obc">OBC</option>
                                <option value="sc">SC</option>
                                <option value="st">ST</option>
                                <option value="ews">EWS</option>
                                <option value="other">Other</option>
                              </select>
                            </FormItem>
                          )} />
                          <FormField control={form.control} name="phone" render={({ field }) => (
                            <FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl></FormItem>
                          )} />
                          <FormField control={form.control} name="email" render={({ field }) => (
                            <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} value={field.value || ""} /></FormControl></FormItem>
                          )} />
                          <FormField control={form.control} name="address_street" render={({ field }) => (
                            <FormItem className="sm:col-span-2">
                              <FormLabel>Street / locality</FormLabel>
                              <FormControl><Input {...field} value={field.value || ""} /></FormControl>
                            </FormItem>
                          )} />
                          <FormField control={form.control} name="address_city" render={({ field }) => (
                            <FormItem><FormLabel>City</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl></FormItem>
                          )} />
                          <FormField control={form.control} name="address_state" render={({ field }) => (
                            <FormItem><FormLabel>State</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl></FormItem>
                          )} />
                          <FormField control={form.control} name="address_zip" render={({ field }) => (
                            <FormItem><FormLabel>PIN / ZIP</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl></FormItem>
                          )} />
                        </div>
                        <div className="flex gap-3 pt-2">
                          <Button type="submit" disabled={saving}>
                            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            <Save className="mr-2 h-4 w-4" /> Save Changes
                          </Button>
                          <Button type="button" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
                        </div>
                      </form>
                    </Form>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <InfoRow label="Gender" value={student.gender} />
                      <InfoRow label="Date of Birth" value={student.date_of_birth} />
                      <InfoRow label="Blood Group" value={student.blood_group} />
                      <InfoRow label="Nationality" value={student.nationality} />
                      <InfoRow label="Religion" value={student.religion} />
                      <InfoRow label="Category" value={student.category} />
                      <InfoRow label="Phone" value={student.phone} />
                      <InfoRow label="Email" value={student.email} />
                      <InfoRow
                        label="Address"
                        value={student.address ? [student.address.street, student.address.city, student.address.state, student.address.zip].filter(Boolean).join(", ") : null}
                        className="sm:col-span-2"
                      />
                      {student.medical_info && Object.keys(student.medical_info).length > 0 && (
                        <InfoRow
                          label="Medical notes"
                          value={Object.entries(student.medical_info)
                            .filter(([, v]) => v)
                            .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`)
                            .join(" · ")}
                          className="sm:col-span-2"
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
              <CardDescription>
                {portalMode
                  ? "Documents on file for this student."
                  : "Upload and manage student documents — birth certificates, transfer certificates, previous marksheets, etc."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {portalMode ? (
                student.documents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No documents on file.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {student.documents.map((doc, i) => (
                      <li key={`${doc.filename}-${i}`} className="flex items-center justify-between gap-2 border rounded-md px-3 py-2">
                        <span className="font-medium">{doc.label || doc.filename}</span>
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary text-xs underline shrink-0"
                        >
                          View
                        </a>
                      </li>
                    ))}
                  </ul>
                )
              ) : (
                <DocumentUpload
                  schoolId={student.school_id}
                  studentId={student.id}
                  documents={student.documents}
                  onUpdate={() => qc.invalidateQueries({ queryKey: ["student-profile", effectiveStudentId] })}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Parents Tab */}
        <TabsContent value="parents">
          <Card>
            <CardHeader>
              <CardTitle>Linked Parents / Guardians</CardTitle>
              <CardDescription>Parents linked to this student via the invite system or manual linking.</CardDescription>
            </CardHeader>
            <CardContent>
              {student.parents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed rounded-lg text-muted-foreground">
                  <Users className="h-10 w-10 opacity-40 mb-3" />
                  <p className="font-medium text-foreground">No parents linked</p>
                  <p className="text-sm mt-1">Invite parents through the Students list "Add Student" flow with guardian details.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {student.parents.map((link) => (
                    <div key={link.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
                          {link.parent?.first_name?.[0]?.toUpperCase() || "?"}
                          {link.parent?.last_name?.[0]?.toUpperCase() || ""}
                        </div>
                        <div>
                          <p className="font-medium">
                            {link.parent?.first_name} {link.parent?.last_name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {link.relation} {link.is_primary && <Badge variant="outline" className="ml-1 text-[10px]">Primary</Badge>}
                          </p>
                        </div>
                      </div>
                      <div className="text-right text-sm text-muted-foreground">
                        <p>{link.parent?.phone || "No phone"}</p>
                        <p className="text-xs">{link.parent?.email || "No email"}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Fees Tab */}
        <TabsContent value="fees">
          <Card>
            <CardHeader>
              <CardTitle>Fee & Invoice History</CardTitle>
              <CardDescription>All invoices and payment status for this student.</CardDescription>
            </CardHeader>
            <CardContent>
              {student.invoices.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed rounded-lg text-muted-foreground">
                  <CreditCard className="h-10 w-10 opacity-40 mb-3" />
                  <p className="font-medium text-foreground">No invoices yet</p>
                  <p className="text-sm mt-1">Create a fee structure and assign it to generate invoices.</p>
                </div>
              ) : (
                <div className="border rounded-md overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40 text-left">
                        <th className="p-3 font-medium">Invoice</th>
                        <th className="p-3 font-medium">Due Date</th>
                        <th className="p-3 font-medium text-right">Amount</th>
                        <th className="p-3 font-medium text-right">Paid</th>
                        <th className="p-3 font-medium text-right">Due</th>
                        <th className="p-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {student.invoices.map((inv) => (
                        <tr key={inv.id} className="border-b last:border-0">
                          <td className="p-3 font-mono text-xs">{inv.invoice_no}</td>
                          <td className="p-3 whitespace-nowrap">{new Date(inv.due_date).toLocaleDateString()}</td>
                          <td className="p-3 text-right">${Number(inv.amount).toLocaleString()}</td>
                          <td className="p-3 text-right text-green-600">${Number(inv.paid_amount).toLocaleString()}</td>
                          <td className="p-3 text-right font-semibold text-destructive">${Number(inv.due_amount).toLocaleString()}</td>
                          <td className="p-3">
                            <Badge
                              variant={inv.status === "paid" ? "default" : inv.status === "overdue" ? "destructive" : "secondary"}
                              className="capitalize text-[10px]"
                            >
                              {inv.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ID Card Tab */}
        <TabsContent value="idcard">
          <Card>
            <CardHeader>
              <CardTitle>Student ID Card</CardTitle>
              <CardDescription>Generate and print a student identity card.</CardDescription>
            </CardHeader>
            <CardContent>
              <IdCardGenerator data={buildStudentIdCardData(student, schoolDisplayName ?? "School")} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function InfoRow({ label, value, className }: { label: string; value: string | null | undefined; className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-sm font-medium mt-0.5">{value || "—"}</p>
    </div>
  )
}
