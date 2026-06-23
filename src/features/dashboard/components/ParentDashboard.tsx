import { Link } from "react-router-dom"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  GraduationCap,
  CalendarCheck,
  CreditCard,
  Loader2,
  Edit2,
  X,
  BookOpen,
  ClipboardList,
  Megaphone,
  ChevronRight,
  BarChart3,
  IdCard,
} from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell
} from "recharts"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { getParentChildren, updateStudentDetails, getChildrenAttendance, getChildrenExamResults, getChildrenInvoices } from "../api/dashboard.api"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { useStudentDocumentsDisplayUrl } from "@/features/students/hooks/useStudentDocumentsDisplayUrl"
import { ReportCardModal } from "./ReportCardModal"

const editChildSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  gender: z.enum(["male", "female", "other", "prefer_not_to_say"]),
  date_of_birth: z.string().nullable().optional(),
  blood_group: z.string().nullable().optional(),
  nationality: z.string().nullable().optional(),
  religion: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email("Invalid email").nullable().optional().or(z.literal("")),
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
  }).optional().nullable(),
  medical_info: z.object({
    allergies: z.string().optional(),
    conditions: z.string().optional(),
    medications: z.string().optional(),
    blood_group: z.string().optional(),
  }).optional().nullable(),
})

type EditChildFormValues = z.infer<typeof editChildSchema>

type ParentChildRow = {
  student_id: string
  student_name: string
  photo_url?: string | null
  first_name: string
  last_name: string
  gender: string | null
  date_of_birth: string | null
  blood_group: string | null
  nationality: string | null
  religion: string | null
  category: string | null
  phone: string | null
  email: string | null
  address: any
  medical_info: any
  class_name: string | null
  section_name: string | null
  attendance_pct_this_month: number | null
  pending_fees: number | null
}

function initials(name: string) {
  const p = name.trim().split(/\s+/).filter(Boolean)
  if (p.length === 0) return "?"
  if (p.length === 1) return p[0]!.slice(0, 2).toUpperCase()
  return `${p[0]![0]}${p[p.length - 1]![0]}`.toUpperCase()
}

function LinkedChildAvatar({
  photoUrl,
  studentName,
}: {
  photoUrl: string | null | undefined
  studentName: string
}) {
  const resolved = useStudentDocumentsDisplayUrl(photoUrl ?? undefined)
  return (
    <>
      <AvatarImage src={resolved ?? ""} alt={studentName} />
      <AvatarFallback className="bg-gradient-to-br from-primary/10 to-primary/5 text-primary font-bold text-lg">
        {initials(studentName)}
      </AvatarFallback>
    </>
  )
}

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"

function EditChildModal({ 
  child, 
  onClose, 
  onSuccess 
}: { 
  child: ParentChildRow, 
  onClose: () => void, 
  onSuccess: () => void 
}) {
  const [submitting, setSubmitting] = useState(false)
  
  const form = useForm<EditChildFormValues>({
    resolver: zodResolver(editChildSchema),
    defaultValues: {
      first_name: child.first_name || "",
      last_name: child.last_name || "",
      gender: (child.gender as any) || "prefer_not_to_say",
      date_of_birth: child.date_of_birth || "",
      blood_group: child.blood_group || "",
      nationality: child.nationality || "",
      religion: child.religion || "",
      category: child.category || "",
      phone: child.phone || "",
      email: child.email || "",
      address: child.address || { street: "", city: "", state: "", zip: "" },
      medical_info: child.medical_info || { allergies: "", conditions: "", medications: "" },
    },
  })

  async function onSubmit(values: EditChildFormValues) {
    try {
      setSubmitting(true)
      // Clean up empty strings for nullable fields
      const updates: any = { ...values }
      if (updates.email === "") updates.email = null
      
      await updateStudentDetails(child.student_id, updates)
      toast.success("Student details updated successfully")
      onSuccess()
      onClose()
    } catch (e: any) {
      toast.error(e.message || "Failed to update details")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <Card className="w-full max-w-2xl shadow-lg max-h-[90vh] overflow-hidden flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 shrink-0">
          <div>
            <CardTitle>Edit Child Details</CardTitle>
            <CardDescription>Update comprehensive profile information for {child.student_name}.</CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="overflow-y-auto">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <Tabs defaultValue="personal" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="personal">Personal</TabsTrigger>
                  <TabsTrigger value="contact">Contact</TabsTrigger>
                  <TabsTrigger value="medical">Medical</TabsTrigger>
                </TabsList>
                
                <TabsContent value="personal" className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="first_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="last_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last Name</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="gender"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Gender</FormLabel>
                          <select
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            {...field}
                          >
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                            <option value="other">Other</option>
                            <option value="prefer_not_to_say">Prefer not to say</option>
                          </select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="date_of_birth"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date of Birth</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} value={field.value || ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="blood_group"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Blood Group</FormLabel>
                          <select
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            {...field}
                            value={field.value || ""}
                          >
                            <option value="">Select</option>
                            <option value="A+">A+</option>
                            <option value="A-">A-</option>
                            <option value="B+">B+</option>
                            <option value="B-">B-</option>
                            <option value="AB+">AB+</option>
                            <option value="AB-">AB-</option>
                            <option value="O+">O+</option>
                            <option value="O-">O-</option>
                          </select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="nationality"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nationality</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="religion"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Religion</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Category</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} placeholder="e.g. General, OBC, etc." />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="contact" className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type="email" {...field} value={field.value || ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="space-y-4">
                    <Label>Address</Label>
                    <FormField
                      control={form.control}
                      name="address.street"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Street</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <FormField
                        control={form.control}
                        name="address.city"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">City</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="address.state"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">State</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="address.zip"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">ZIP</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="medical" className="space-y-4 pt-4">
                  <FormField
                    control={form.control}
                    name="medical_info.allergies"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Allergies</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} placeholder="List any known allergies" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="medical_info.conditions"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Medical Conditions</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} placeholder="List any chronic conditions" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="medical_info.medications"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Current Medications</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} placeholder="List any regular medications" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>
              </Tabs>

              <div className="flex justify-end gap-3 pt-4 border-t shrink-0">
                <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save All Changes
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}

export function ParentDashboard() {
  const user = useAuth((s) => s.user)
  const qc = useQueryClient()
  const [editingChild, setEditingChild] = useState<ParentChildRow | null>(null)
  const [selectedReportChild, setSelectedReportChild] = useState<ParentChildRow | null>(null)

  const { data: children, isLoading } = useQuery({
    queryKey: ["parent-children", user?.id],
    queryFn: () => getParentChildren(user!.id),
    enabled: !!user?.id,
  })

  const rows = (children ?? []) as ParentChildRow[]
  const studentIds = rows.map((c) => c.student_id)

  const { data: attendanceData, isLoading: isAttendanceLoading } = useQuery({
    queryKey: ["children-attendance", studentIds],
    queryFn: () => getChildrenAttendance(studentIds),
    enabled: studentIds.length > 0,
  })

  const { data: examResultsData, isLoading: isExamsLoading } = useQuery({
    queryKey: ["children-exams", studentIds],
    queryFn: () => getChildrenExamResults(studentIds),
    enabled: studentIds.length > 0,
  })

  const { data: invoicesData, isLoading: isInvoicesLoading } = useQuery({
    queryKey: ["children-invoices", studentIds],
    queryFn: () => getChildrenInvoices(studentIds),
    enabled: studentIds.length > 0,
  })

  if (isLoading || isAttendanceLoading || isExamsLoading || isInvoicesLoading) {
    return (
      <div className="flex flex-col gap-6 animate-in fade-in duration-500 max-w-7xl mx-auto">
        <div className="space-y-2">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-48 rounded-2xl" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-80 md:col-span-2 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </div>
    )
  }

  // Dynamic stats
  const activeChildrenCount = rows.length
  
  // Calculate true average attendance from raw database attendance records
  const avgAttendance = (() => {
    if (!attendanceData || attendanceData.length === 0) return 0
    const presentOrLate = attendanceData.filter(
      (r) => r.status?.toLowerCase() === "present" || r.status?.toLowerCase() === "late"
    ).length
    return (presentOrLate / attendanceData.length) * 100
  })()

  // Calculate true fee aggregates from student_invoices table
  const totalPaidFees = invoicesData ? invoicesData.reduce((acc, inv) => acc + Number(inv.paid_amount ?? 0), 0) : 0
  const totalDueFees = invoicesData ? invoicesData.reduce((acc, inv) => acc + Number(inv.due_amount ?? 0), 0) : 0
  const totalPendingFees = totalDueFees

  // Format dynamic attendance monthly trend
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  const attendanceTrendData = (() => {
    if (!attendanceData || attendanceData.length === 0) return []
    const grouped: Record<string, { total: number; present: number }> = {}
    attendanceData.forEach((row) => {
      if (!row.date) return
      const dateObj = new Date(row.date)
      const monthIndex = dateObj.getMonth()
      if (isNaN(monthIndex)) return
      const monthName = monthNames[monthIndex]
      if (!grouped[monthName]) {
        grouped[monthName] = { total: 0, present: 0 }
      }
      grouped[monthName].total += 1
      if (row.status?.toLowerCase() === "present" || row.status?.toLowerCase() === "late") {
        grouped[monthName].present += 1
      }
    })
    return monthNames
      .filter((m) => grouped[m] !== undefined)
      .map((m) => {
        const { total, present } = grouped[m]!
        return {
          name: m,
          Attendance: total > 0 ? Math.round((present / total) * 100) : 0,
          Target: 85,
        }
      })
  })()

  // Format dynamic subject-wise scores from exam_results table
  const subjectPerformanceData = (() => {
    if (!examResultsData || examResultsData.length === 0) return []
    const grouped: Record<string, { obtained: number; max: number }> = {}
    examResultsData.forEach((row: any) => {
      const subName = row.exams?.subjects?.name || "Other"
      const marks = Number(row.marks_obtained ?? 0)
      const max = Number(row.exams?.max_marks ?? 100)
      if (!grouped[subName]) {
        grouped[subName] = { obtained: 0, max: 0 }
      }
      grouped[subName].obtained += marks
      grouped[subName].max += max
    })
    return Object.entries(grouped).map(([name, val]) => ({
      name,
      Score: val.max > 0 ? Math.round((val.obtained / val.max) * 100) : 0,
    }))
  })()

  // Format dynamic PieChart data
  const feeDonutData = [
    { name: "Paid Fees", value: totalPaidFees, color: "#10b981" },
    { name: "Outstanding Dues", value: totalDueFees, color: "#f43f5e" },
  ]

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 max-w-7xl mx-auto pb-12">
      {editingChild && (
        <EditChildModal 
          child={editingChild} 
          onClose={() => setEditingChild(null)}
          onSuccess={() => qc.invalidateQueries({ queryKey: ["parent-children", user?.id] })}
        />
      )}

      {selectedReportChild && (
        <ReportCardModal child={selectedReportChild} onClose={() => setSelectedReportChild(null)} />
      )}

      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/10 p-6 sm:p-8">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -left-10 -bottom-10 h-44 w-44 rounded-full bg-purple-500/10 blur-3xl" />
        <div className="relative space-y-4">
          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Parent Portal</h1>
            <p className="text-muted-foreground text-sm sm:text-base max-w-xl">
              Welcome back! Real-time academic tracking, performance insights, and administrative updates for your linked children.
            </p>
          </div>
          <Button variant="secondary" size="sm" className="gap-2 rounded-xl w-fit shadow-sm border border-primary/10" asChild>
            <Link to="/student-id-card">
              <IdCard className="h-4 w-4" />
              Student ID cards
            </Link>
          </Button>
        </div>
      </div>

      {/* Visual Analytics Hub Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-card to-primary/5 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="uppercase tracking-wider font-semibold text-[10px] text-primary">Connected Family</CardDescription>
            <CardTitle className="text-3xl font-extrabold">{activeChildrenCount}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
            <GraduationCap className="h-4 w-4 text-primary shrink-0" />
            <span>Active Student profile(s) linked</span>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-card to-purple-500/5 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="uppercase tracking-wider font-semibold text-[10px] text-purple-500">Average Attendance</CardDescription>
            <CardTitle className="text-3xl font-extrabold">{avgAttendance > 0 ? `${avgAttendance.toFixed(1)}%` : "—"}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
            <CalendarCheck className="h-4 w-4 text-purple-500 shrink-0" />
            <span>Across current term classes</span>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-card to-rose-500/5 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="uppercase tracking-wider font-semibold text-[10px] text-rose-500">Pending Financials</CardDescription>
            <CardTitle className={`text-3xl font-extrabold ${totalPendingFees > 0 ? "text-rose-500" : "text-emerald-500"}`}>
              ${totalPendingFees.toLocaleString()}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
            <CreditCard className="h-4 w-4 text-rose-500 shrink-0" />
            <span>{totalPendingFees > 0 ? "Action required for outstanding balances" : "All balances fully clear"}</span>
          </CardContent>
        </Card>
      </div>

      {/* Children list */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-primary" />
          Linked Children Profiles
        </h2>
        
        {rows.length === 0 ? (
          <div className="py-16 text-center border-2 border-dashed rounded-3xl text-muted-foreground bg-card/40">
            <GraduationCap className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <p className="font-semibold text-foreground text-lg">No Linked Student Profiles</p>
            <p className="text-sm mt-1 max-w-sm mx-auto">
              Please contact the school administration to link your parent account to your child's student profile.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {rows.map((child) => (
              <Card key={child.student_id} className="relative overflow-hidden border hover:border-primary/40 transition-all hover:shadow-md rounded-2xl">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary to-purple-600" />
                <CardHeader className="pb-4 flex flex-row items-center gap-4 pt-6">
                  <Avatar className="h-14 w-14 border-2 border-background shadow-md shrink-0">
                    <LinkedChildAvatar photoUrl={child.photo_url} studentName={child.student_name} />
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <CardTitle className="text-lg font-bold truncate leading-tight">{child.student_name}</CardTitle>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full shrink-0"
                        onClick={() => setEditingChild(child)}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <CardDescription className="truncate text-xs mt-1">
                      {[child.class_name, child.section_name ? `Section ${child.section_name}` : null]
                        .filter(Boolean)
                        .join(" · ") || "Class Assignment Pending"}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 pb-5">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1 p-3 border rounded-xl bg-muted/30">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Attendance</span>
                      <span className="text-base font-extrabold mt-0.5">
                        {child.attendance_pct_this_month != null
                          ? `${Number(child.attendance_pct_this_month).toFixed(1)}%`
                          : "—"}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 p-3 border rounded-xl bg-muted/30">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Pending Fees</span>
                      <span className="text-base font-extrabold mt-0.5 text-rose-500">
                        ${Number(child.pending_fees ?? 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full mt-3 gap-2 rounded-xl text-xs hover:bg-primary/5 border-primary/20 hover:border-primary/40 text-primary"
                    onClick={() => setSelectedReportChild(child)}
                  >
                    <ClipboardList className="h-3.5 w-3.5" /> Download Report Card
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions Panel */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold tracking-tight">Quick Navigation</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { to: "/attendance", title: "Attendance Tracking", desc: "View detailed calendars", icon: CalendarCheck, color: "bg-blue-500/10 text-blue-600 border-blue-500/10 hover:bg-blue-500/[0.02]" },
            { to: "/exams", title: "Exams & Rankings", desc: "Report cards & grades", icon: ClipboardList, color: "bg-purple-500/10 text-purple-600 border-purple-500/10 hover:bg-purple-500/[0.02]" },
            { to: "/finance", title: "Fee Portal", desc: "Pay dues & save receipts", icon: CreditCard, color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/10 hover:bg-emerald-500/[0.02]" },
            { to: "/lms", title: "Learning Hub", desc: "Homework assignments", icon: BookOpen, color: "bg-amber-500/10 text-amber-600 border-amber-500/10 hover:bg-amber-500/[0.02]" },
            { to: "/notices", title: "Announcements", desc: "School notice board", icon: Megaphone, color: "bg-rose-500/10 text-rose-600 border-rose-500/10 hover:bg-rose-500/[0.02]" },
          ].map(({ to, title, desc, icon: Icon, color }) => (
            <Link
              key={to}
              to={to}
              className={`group flex items-start gap-3 rounded-2xl border bg-card p-4 shadow-sm transition-all hover:border-primary/40 hover:shadow-md ${color}`}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-background shadow-sm">
                <Icon className="h-4.5 w-4.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 font-bold text-sm text-foreground">
                  {title}
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-4px] group-hover:translate-x-0" />
                </span>
                <span className="block text-xs text-muted-foreground mt-0.5 leading-normal">{desc}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* Advanced Recharts Interactive Panels */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Attendance Area Trend */}
        <Card className="md:col-span-2 rounded-3xl border shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarCheck className="h-5 w-5 text-blue-500" />
              Attendance Performance Trend
            </CardTitle>
            <CardDescription>Monthly student attendance percentage versus threshold target (85%)</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] pt-4">
            {attendanceTrendData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <CalendarCheck className="h-12 w-12 text-muted-foreground opacity-20 mb-3" />
                <p className="text-sm font-semibold text-foreground">No Attendance Data Logged</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                  Daily attendance logs are updated in real-time once classes begin.
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={attendanceTrendData} margin={{ left: -10, right: 10, top: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorAttendance" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="rgb(59, 130, 246)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="rgb(59, 130, 246)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis domain={[70, 100]} tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "12px",
                      border: "1px solid hsl(var(--border))",
                      background: "hsl(var(--card))",
                    }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="Attendance" stroke="rgb(59, 130, 246)" strokeWidth={2.5} fillOpacity={1} fill="url(#colorAttendance)" />
                  <Area type="monotone" dataKey="Target" stroke="rgb(239, 68, 68)" strokeDasharray="5 5" strokeWidth={1.5} fill="none" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Fees Distribution Pie */}
        <Card className="rounded-3xl border shadow-sm flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CreditCard className="h-5 w-5 text-emerald-500" />
              Financial Distribution
            </CardTitle>
            <CardDescription>Paid fees versus outstanding dues ratio</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 h-[220px] flex flex-col justify-center pb-2">
            {totalPaidFees === 0 && totalDueFees === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-6">
                <CreditCard className="h-12 w-12 text-muted-foreground opacity-20 mb-3" />
                <p className="text-sm font-semibold text-foreground">No Pending Invoices</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  All dues are clear or no invoices have been generated for this academic year.
                </p>
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={feeDonutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {feeDonutData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: "12px",
                        border: "1px solid hsl(var(--border))",
                        background: "hsl(var(--card))",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex justify-center gap-6 text-xs mt-2 shrink-0 border-t pt-4">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#10b981]" />
                    <span className="text-muted-foreground">Paid: ${totalPaidFees.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#f43f5e]" />
                    <span className="text-muted-foreground">Pending: ${totalDueFees.toLocaleString()}</span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Academic Performance + Communication Hub */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Subject wise score chart */}
        <Card className="md:col-span-2 rounded-3xl border shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BarChart3 className="h-5 w-5 text-purple-500" />
              Academic Performance Analysis
            </CardTitle>
            <CardDescription>Student subject score compared with the overall class average</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] pt-4">
            {subjectPerformanceData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <BarChart3 className="h-12 w-12 text-muted-foreground opacity-20 mb-3" />
                <p className="text-sm font-semibold text-foreground">No Exam Results Published Yet</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                  Academic performance reports and analytics will display here once midterm/final exams are completed and graded.
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={subjectPerformanceData} margin={{ left: -10, right: 10, top: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "12px",
                      border: "1px solid hsl(var(--border))",
                      background: "hsl(var(--card))",
                    }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Score" fill="rgb(168, 85, 247)" radius={[4, 4, 0, 0]} name="Student Score" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Notices Board & Quick Updates */}
        <Card className="rounded-3xl border shadow-sm flex flex-col bg-gradient-to-br from-card to-rose-500/[0.01]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Megaphone className="h-5 w-5 text-rose-500" />
              School Notice Hub
            </CardTitle>
            <CardDescription>Stay aligned with circulars & events</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-between pt-2">
            <div className="space-y-4">
              <div className="flex gap-3 items-start p-3 border rounded-xl bg-card hover:shadow-sm transition-shadow">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/10 text-rose-500 shrink-0">
                  <Megaphone className="h-4 w-4" />
                </span>
                <div>
                  <h4 className="text-xs font-bold leading-normal">Final Term Exam Schedule Released</h4>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Please review the exam schedule and passing thresholds.</p>
                </div>
              </div>
              <div className="flex gap-3 items-start p-3 border rounded-xl bg-card hover:shadow-sm transition-shadow">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 shrink-0">
                  <CreditCard className="h-4 w-4" />
                </span>
                <div>
                  <h4 className="text-xs font-bold leading-normal">Online Fee Portal Live</h4>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Parents can now view outstanding invoices and pay securely.</p>
                </div>
              </div>
            </div>
            <Button variant="outline" className="w-full mt-6 gap-2 shrink-0 rounded-xl" asChild>
              <Link to="/notices">
                View All Circulars <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
