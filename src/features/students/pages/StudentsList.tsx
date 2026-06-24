import { useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import type { ColumnDef, SortingState, ColumnFiltersState } from "@tanstack/react-table"
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
} from "@tanstack/react-table"
import { Plus, Search, MoreHorizontal, ArrowUpDown, Loader2, X, GraduationCap, FileUp } from "lucide-react"
import { useNavigate, useSearchParams } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { flattenSectionOptionsForCurrentYear, getCurrentAcademicYearMeta } from "../api/academics.api"
import {
  getStudents,
  getStudentsPendingPortalLogin,
  type Student,
  type StudentPendingPortalLogin,
} from "../api/students.api"
import { AssignSectionDropdownItems } from "../components/AssignSectionDropdown"
import { ManageClassesPanel } from "../components/ManageClassesDialog"
import { PendingStudentLoginPanel } from "../components/PendingStudentLoginPanel"
import { AdmissionNumberLoginPanel } from "@/features/admissions/components/AdmissionNumberLoginPanel"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { inviteSchoolUsers, type SchoolInviteRow, type ParentInvitePayload } from "@/features/invites/api/invites.api"
import { toast } from "sonner"
import { BulkImportDialog, type CSVColumn } from "@/components/common/BulkImportDialog"
import { supabase } from "@/lib/supabase"

/** Stable when the query has no `data` yet — a fresh `[]` each render makes `useReactTable` think data changed every time (infinite re-renders). */
const EMPTY_STUDENTS: Student[] = []

/** Matches RLS: `principal`, `school_admin`, `vice_principal`, and `accountant` may manage students. */
const CAN_MANAGE_ACADEMICS = new Set(["principal", "school_admin", "vice_principal", "accountant"])

function baseStudentColumns(): ColumnDef<Student>[] {
  return [
    {
      accessorKey: "admission_no",
      header: "Adm. No",
    },
    {
      accessorFn: (row) => `${row.first_name} ${row.last_name}`,
      id: "name",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Student Name
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => <div className="font-medium px-4">{row.getValue("name")}</div>,
    },
    {
      id: "class_section",
      header: "Class & Section",
      cell: ({ row }) => {
        const student = row.original
        const className = student.classes?.name || "N/A"
        const sectionName = student.sections?.name || "N/A"
        return (
          <div>
            {className} - {sectionName}
          </div>
        )
      },
    },
    {
      accessorKey: "gender",
      header: "Gender",
      cell: ({ row }) => (
        <div className="capitalize">{(row.getValue("gender") as string | null) ?? "—"}</div>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("status") as string
        return (
          <Badge variant={status === "active" ? "default" : "secondary"} className="capitalize">
            {status}
          </Badge>
        )
      },
    },
  ]
}

function StudentRowActions({
  student,
  assignProps,
}: {
  student: Student
  assignProps: { enabled: boolean; schoolId: string | undefined }
}) {
  const navigate = useNavigate()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <span className="sr-only">Open menu</span>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => navigator.clipboard.writeText(student.id)}>
          Copy Student ID
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate(`/students/${student.id}`)}>
          View Profile
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate(`/students/${student.id}`)}>
          Edit Details
        </DropdownMenuItem>
        <DropdownMenuItem className="text-destructive" disabled>
          Archive Student
        </DropdownMenuItem>
        <AssignSectionDropdownItems student={student} dropdownProps={assignProps} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}



export function StudentsList() {
  const activeSchoolId = useAuth((state) => state.activeSchoolId)
  const activeRole = useAuth((state) => state.activeRole)
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const admissionNoFromUrl = searchParams.get("admissionNo") ?? ""
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState("")
  const [inviteOpen, setInviteOpen] = useState(false)
  const [manageClassesOpen, setManageClassesOpen] = useState(false)
  const [inviteSubmitting, setInviteSubmitting] = useState(false)
  const [inviteSectionId, setInviteSectionId] = useState("")
  const [singleEmail, setSingleEmail] = useState("")
  const [singleFirst, setSingleFirst] = useState("")
  const [singleLast, setSingleLast] = useState("")
  const [admissionNo, setAdmissionNo] = useState("")
  const [autoAdmission, setAutoAdmission] = useState(true)
  const [bulkImportOpen, setBulkImportOpen] = useState(false)
  const [selectedFeeStructures, setSelectedFeeStructures] = useState<string[]>([])

  const [g1Email, setG1Email] = useState("")
  const [g1First, setG1First] = useState("")
  const [g1Last, setG1Last] = useState("")
  const [g1Phone, setG1Phone] = useState("")
  const [g1Relation, setG1Relation] = useState("father")
  const [g1Primary, setG1Primary] = useState(true)

  const [g2Email, setG2Email] = useState("")
  const [g2First, setG2First] = useState("")
  const [g2Last, setG2Last] = useState("")
  const [g2Phone, setG2Phone] = useState("")
  const [g2Relation, setG2Relation] = useState("mother")
  const [g2Primary, setG2Primary] = useState(false)
  const [linkStudentId, setLinkStudentId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["students", activeSchoolId],
    queryFn: () => getStudents(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const students = data ?? EMPTY_STUDENTS

  const canManageAcademics = CAN_MANAGE_ACADEMICS.has(activeRole ?? "")

  const { data: pendingLogins = [] } = useQuery({
    queryKey: ["students-pending-login", activeSchoolId],
    queryFn: () => getStudentsPendingPortalLogin(activeSchoolId!),
    enabled: !!activeSchoolId && canManageAcademics,
  })

  const assignSectionProps = useMemo(
    () => ({
      enabled: canManageAcademics,
      schoolId: activeSchoolId ?? undefined,
    }),
    [canManageAcademics, activeSchoolId],
  )

  const columns = useMemo(
    (): ColumnDef<Student>[] => [
      ...baseStudentColumns(),
      {
        id: "actions",
        cell: ({ row }) => (
          <StudentRowActions student={row.original} assignProps={assignSectionProps} />
        ),
      },
    ],
    [assignSectionProps],
  )

  const { data: ayMetaForManage } = useQuery({
    queryKey: ["academic-year-meta-manage-classes", activeSchoolId, manageClassesOpen],
    queryFn: () => getCurrentAcademicYearMeta(activeSchoolId!),
    enabled: !!activeSchoolId && canManageAcademics && manageClassesOpen,
  })

  const { data: inviteSectionOptions = [], isFetching: inviteSectionsLoading } = useQuery({
    queryKey: ["section-options", activeSchoolId],
    queryFn: () => flattenSectionOptionsForCurrentYear(activeSchoolId!),
    enabled: !!activeSchoolId && inviteOpen && canManageAcademics,
    staleTime: 15_000,
  })

  // Fee structures for current academic year
  const { data: feeStructures = [], isFetching: feeStructuresLoading } = useQuery({
    queryKey: ["fee-structures-for-invite", activeSchoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fee_structures")
        .select("id, name, amount, frequency")
        .eq("school_id", activeSchoolId!)
        .eq("is_active", true)
        .order("name")
      if (error) throw error
      return data as { id: string; name: string; amount: number; frequency: string }[]
    },
    enabled: !!activeSchoolId && inviteOpen,
    staleTime: 30_000,
  })

  const table = useReactTable({
    data: students,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
    onGlobalFilterChange: setGlobalFilter,
  })

  const openStudentInvite = () => {
    setLinkStudentId(null)
    setInviteOpen(true)
  }

  function openInviteForPending(row: StudentPendingPortalLogin) {
    setSingleEmail(row.email ?? "")
    setSingleFirst(row.first_name)
    setSingleLast(row.last_name)
    setAdmissionNo(row.admission_no)
    setAutoAdmission(false)
    setLinkStudentId(row.id)
    if (row.parentNeedsLogin && row.parentEmail) {
      setG1Email(row.parentEmail)
      setG1First(row.parentFirstName ?? "")
      setG1Last(row.parentLastName ?? "")
      setG1Phone(row.parentPhone ?? "")
      setG1Relation("guardian")
      setG1Primary(true)
    }
    setInviteOpen(true)
  }

  async function submitStudentInvites(invitations: SchoolInviteRow[]) {
    if (!activeSchoolId) return
    setInviteSubmitting(true)
    try {
      const res = await inviteSchoolUsers({ schoolId: activeSchoolId, invitations })
      const failed = res.results.filter((r) => !r.ok)
      
      if (failed.length > 0) {
        if (failed.length > 3) {
          toast.error(`${failed.length} invitations failed. Check the console for details.`)
          console.error("Bulk invite failures:", failed)
        } else {
          failed.forEach((f) => toast.error(`${f.email}: ${f.error ?? "Failed"}`))
        }
      }

      const okCount = res.results.filter((r) => r.ok).length
      if (okCount) toast.success(`Sent ${okCount} invitation(s).`)
      
      if (okCount) {
        await queryClient.invalidateQueries({ queryKey: ["students", activeSchoolId] })
        await queryClient.invalidateQueries({ queryKey: ["students-pending-login", activeSchoolId] })
        if (failed.length === 0) {
          setInviteOpen(false)
        }

        setLinkStudentId(null)
        
        // Clear single invite fields
        setSingleEmail("")
        setSingleFirst("")
        setSingleLast("")
        setAdmissionNo("")
        setAutoAdmission(true)
        // Reset guardian fields
        setG1Email(""); setG1First(""); setG1Last(""); setG1Phone(""); setG1Relation("father"); setG1Primary(true);
        setG2Email(""); setG2First(""); setG2Last(""); setG2Phone(""); setG2Relation("mother"); setG2Primary(false);
        setSelectedFeeStructures([]);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Invite failed")
    } finally {
      setInviteSubmitting(false)
    }
  }

  async function handleSingleStudent(e: React.FormEvent) {
    e.preventDefault()
    const email = singleEmail.trim().toLowerCase()
    if (!email) {
      toast.error("Email is required")
      return
    }
    if (!autoAdmission && !admissionNo.trim()) {
      toast.error("Admission number is required when auto-generate is off")
      return
    }

    const parents: ParentInvitePayload[] = []

    const addGuardian = (
      gEmail: string,
      gFirst: string,
      gLast: string,
      gPhone: string,
      relation: string,
      isPrimary: boolean,
    ) => {
      const em = gEmail.trim().toLowerCase()
      if (!em) return
      if (em === email) {
        toast.error("Guardian email cannot match the student email")
        throw new Error("validation")
      }
      if (!gPhone.trim()) {
        toast.error(`Phone is required for guardian ${em}`)
        throw new Error("validation")
      }
      parents.push({
        email: em,
        first_name: gFirst.trim() || undefined,
        last_name: gLast.trim() || undefined,
        phone: gPhone.trim(),
        relation: relation.trim() || "guardian",
        is_primary: isPrimary,
      })
    }

    try {
      addGuardian(g1Email, g1First, g1Last, g1Phone, g1Relation, g1Primary)
      addGuardian(g2Email, g2First, g2Last, g2Phone, g2Relation, g2Primary)
    } catch (e) {
      if (e instanceof Error && e.message === "validation") return
      throw e
    }

    const guardianEmails = parents.map((p) => p.email)
    if (new Set(guardianEmails).size !== guardianEmails.length) {
      toast.error("Guardian emails must be different from each other")
      return
    }

    const primaryCount = parents.filter((p) => p.is_primary).length
    if (primaryCount > 1) {
      toast.error("Mark only one guardian as primary contact")
      return
    }

    await submitStudentInvites([
      {
        email,
        first_name: singleFirst.trim(),
        last_name: singleLast.trim(),
        role: "student",
        admission_no: autoAdmission ? undefined : admissionNo.trim(),
        auto_admission_no: autoAdmission,
        student_id: linkStudentId ?? undefined,
        skip_enrollment: !!linkStudentId,
        skip_fee_invoices: !!linkStudentId,
        parents: parents.length ? parents : undefined,
        ...(inviteSectionId && !linkStudentId ? { section_id: inviteSectionId } : {}),
        ...(selectedFeeStructures.length && !linkStudentId
          ? { fee_structure_ids: selectedFeeStructures }
          : {}),
      },
    ])
  }

  const STUDENT_CSV_COLUMNS: CSVColumn[] = [
    { key: "email", label: "Email", required: true },
    { key: "first_name", label: "First Name", required: true },
    { key: "last_name", label: "Last Name", required: true },
    { key: "admission_no", label: "Admission No", required: false, description: "Omit to auto-generate" },
  ]

  const STUDENT_TEMPLATE_ROWS = [
    ["amy.lee@school.edu", "Amy", "Lee", ""],
    ["bo.chan@school.edu", "Bo", "Chan", "2500001"],
  ]

  async function handleBulkImport(data: any[]) {
    await submitStudentInvites(
      data.map((r) => {
        const adm = r.admission_no?.toString().trim()
        return {
          email: r.email,
          first_name: r.first_name,
          last_name: r.last_name,
          role: "student" as const,
          admission_no: adm || undefined,
          auto_admission_no: !adm,
          section_id: inviteSectionId || undefined,
        }
      }),
    )
  }
  const inviteModal =
    inviteOpen &&
    createPortal(
      <div
        className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
        role="presentation"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) setInviteOpen(false)
        }}
      >
        <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-lg border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <h2 className="text-lg font-semibold">Invite students</h2>
              <p className="text-sm text-muted-foreground">
                Sends login emails for the student and optional guardians (parent accounts linked in the directory).
              </p>
            </div>
            <Button variant="ghost" size="icon" type="button" onClick={() => setInviteOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            {linkStudentId && (
              <p className="text-xs text-muted-foreground rounded-md border bg-muted/40 p-3">
                Linking portal login to an existing admitted student record. Class and fees from
                admission are kept as-is.
              </p>
            )}
            <form onSubmit={handleSingleStudent} className="space-y-3">
              <p className="text-sm font-medium">Single student</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label htmlFor="stu-email">Email</Label>
                  <Input
                    id="stu-email"
                    type="email"
                    value={singleEmail}
                    onChange={(e) => setSingleEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="stu-fn">First name</Label>
                  <Input
                    id="stu-fn"
                    value={singleFirst}
                    onChange={(e) => setSingleFirst(e.target.value)}
                    readOnly={!!linkStudentId}
                    className={linkStudentId ? "bg-muted/50" : undefined}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="stu-ln">Last name</Label>
                  <Input
                    id="stu-ln"
                    value={singleLast}
                    onChange={(e) => setSingleLast(e.target.value)}
                    readOnly={!!linkStudentId}
                    className={linkStudentId ? "bg-muted/50" : undefined}
                  />
                </div>
                <div className="sm:col-span-2 flex items-center gap-2">
                  <input
                    id="stu-auto"
                    type="checkbox"
                    checked={autoAdmission}
                    onChange={(e) => setAutoAdmission(e.target.checked)}
                    disabled={!!linkStudentId}
                  />
                  <Label htmlFor="stu-auto" className="font-normal cursor-pointer">
                    Auto-generate admission number
                  </Label>
                </div>
                {!autoAdmission && (
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label htmlFor="stu-adm">Admission number</Label>
                    <Input
                      id="stu-adm"
                      value={admissionNo}
                      onChange={(e) => setAdmissionNo(e.target.value)}
                      readOnly={!!linkStudentId}
                      className={linkStudentId ? "bg-muted/50" : undefined}
                    />
                  </div>
                )}
              </div>

              {canManageAcademics && !linkStudentId ? (
                <div className="space-y-2">
                  <Label htmlFor="invite-section">Assign to section (optional, current academic year)</Label>
                  <select
                    id="invite-section"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={inviteSectionId}
                    onChange={(e) => setInviteSectionId(e.target.value)}
                    disabled={inviteSectionsLoading}
                  >
                    <option value="">Not enrolled yet</option>
                    {[...inviteSectionOptions]
                      .sort((a, b) => a.label.localeCompare(b.label))
                      .map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Create grades and sections with “Manage classes” on this page header.
                  </p>
                </div>
              ) : null}

              {/* Fee structure selection */}
              {!linkStudentId && (
              <div className="space-y-2">
                <Label>Assign fee structures (optional)</Label>
                {feeStructuresLoading ? (
                  <p className="text-sm text-muted-foreground">Loading fee structures…</p>
                ) : feeStructures.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No fee structures configured. Create them in ERP → Fee Structures.
                  </p>
                ) : (
                  <div className="rounded-lg border p-3 space-y-2 bg-muted/30 max-h-48 overflow-y-auto">
                    {feeStructures.map((fs) => (
                      <label
                        key={fs.id}
                        className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5"
                      >
                        <input
                          type="checkbox"
                          checked={selectedFeeStructures.includes(fs.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedFeeStructures((prev) => [...prev, fs.id])
                            } else {
                              setSelectedFeeStructures((prev) => prev.filter((id) => id !== fs.id))
                            }
                          }}
                        />
                        <span className="flex-1">{fs.name}</span>
                        <span className="text-muted-foreground text-xs">
                          ₹{fs.amount.toLocaleString("en-IN")} / {fs.frequency.replace(/_/g, " ")}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Selected fee structures will auto-generate invoices for this student.
                </p>
              </div>
              )}

              <div className="border-t pt-4 space-y-4">
                <p className="text-sm font-medium">Guardians (optional)</p>
                <p className="text-xs text-muted-foreground">
                  Add up to two parents or guardians. Each needs a unique email and phone; they receive a parent login
                  invite.
                </p>

                <div className="rounded-lg border p-3 space-y-3 bg-muted/30">
                  <p className="text-xs font-medium text-muted-foreground">Guardian 1</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="sm:col-span-2 space-y-1.5">
                      <Label htmlFor="g1-email">Email</Label>
                      <Input
                        id="g1-email"
                        type="email"
                        value={g1Email}
                        onChange={(e) => setG1Email(e.target.value)}
                        autoComplete="off"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="g1-fn">First name</Label>
                      <Input id="g1-fn" value={g1First} onChange={(e) => setG1First(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="g1-ln">Last name</Label>
                      <Input id="g1-ln" value={g1Last} onChange={(e) => setG1Last(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="g1-phone">Phone</Label>
                      <Input id="g1-phone" value={g1Phone} onChange={(e) => setG1Phone(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="g1-rel">Relation</Label>
                      <select
                        id="g1-rel"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={g1Relation}
                        onChange={(e) => setG1Relation(e.target.value)}
                      >
                        <option value="father">Father</option>
                        <option value="mother">Mother</option>
                        <option value="guardian">Guardian</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2 flex items-center gap-2">
                      <input
                        id="g1-primary"
                        type="checkbox"
                        checked={g1Primary}
                        onChange={(e) => {
                          setG1Primary(e.target.checked)
                          if (e.target.checked) setG2Primary(false)
                        }}
                      />
                      <Label htmlFor="g1-primary" className="font-normal cursor-pointer">
                        Primary contact
                      </Label>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border p-3 space-y-3 bg-muted/30">
                  <p className="text-xs font-medium text-muted-foreground">Guardian 2</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="sm:col-span-2 space-y-1.5">
                      <Label htmlFor="g2-email">Email</Label>
                      <Input
                        id="g2-email"
                        type="email"
                        value={g2Email}
                        onChange={(e) => setG2Email(e.target.value)}
                        autoComplete="off"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="g2-fn">First name</Label>
                      <Input id="g2-fn" value={g2First} onChange={(e) => setG2First(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="g2-ln">Last name</Label>
                      <Input id="g2-ln" value={g2Last} onChange={(e) => setG2Last(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="g2-phone">Phone</Label>
                      <Input id="g2-phone" value={g2Phone} onChange={(e) => setG2Phone(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="g2-rel">Relation</Label>
                      <select
                        id="g2-rel"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={g2Relation}
                        onChange={(e) => setG2Relation(e.target.value)}
                      >
                        <option value="father">Father</option>
                        <option value="mother">Mother</option>
                        <option value="guardian">Guardian</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2 flex items-center gap-2">
                      <input
                        id="g2-primary"
                        type="checkbox"
                        checked={g2Primary}
                        onChange={(e) => {
                          setG2Primary(e.target.checked)
                          if (e.target.checked) setG1Primary(false)
                        }}
                      />
                      <Label htmlFor="g2-primary" className="font-normal cursor-pointer">
                        Primary contact
                      </Label>
                    </div>
                  </div>
                </div>
              </div>

              <Button type="submit" disabled={inviteSubmitting}>
                {inviteSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send invite"}
              </Button>
            </form>

            <div className="pt-4 border-t">
              <p className="text-sm font-medium mb-2">Bulk import students</p>
              <p className="text-xs text-muted-foreground mb-4">
                Upload a CSV file to invite multiple students at once. 
              </p>
              <Button 
                type="button" 
                variant="outline" 
                className="w-full gap-2" 
                onClick={() => setBulkImportOpen(true)}
              >
                <FileUp className="h-4 w-4" />
                Upload CSV File
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>,
      document.body,
    )

  const manageClassesModal =
    manageClassesOpen &&
    canManageAcademics &&
    activeSchoolId &&
    createPortal(
      <div
        className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
        role="presentation"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) setManageClassesOpen(false)
        }}
      >
        <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-lg border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <GraduationCap className="h-5 w-5" /> Manage classes &amp; sections
              </h2>
              <p className="text-sm text-muted-foreground">
                Principals define grade levels (classes), then sections (A/B/…) within the academic year.
              </p>
            </div>
            <Button variant="ghost" size="icon" type="button" onClick={() => setManageClassesOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <ManageClassesPanel
              schoolId={activeSchoolId}
              academicYearId={ayMetaForManage?.id ?? null}
              academicYearLabel={ayMetaForManage?.label ?? "Loading…"}
            />
          </CardContent>
        </Card>
      </div>,
      document.body,
    )

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      {inviteModal}
      {manageClassesModal}

      <BulkImportDialog
        open={bulkImportOpen}
        onOpenChange={setBulkImportOpen}
        title="Import Students"
        description="Bulk invite students by uploading a CSV file. We'll send them invitations automatically."
        columns={STUDENT_CSV_COLUMNS}
        templateRows={STUDENT_TEMPLATE_ROWS}
        onUpload={handleBulkImport}
      />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Students</h1>
          <p className="text-muted-foreground mt-1">Manage student directory, admissions, and profiles.</p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0 justify-end">
          {canManageAcademics ? (
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={() => setManageClassesOpen(true)}
              title="Add classes and sections"
            >
              <GraduationCap className="h-4 w-4" /> Manage classes
            </Button>
          ) : null}
          <Button
            className="shrink-0 gap-2"
            type="button"
            disabled={isLoading}
            onClick={openStudentInvite}
            title={isLoading ? "Loading students…" : undefined}
          >
            <Plus className="h-4 w-4" /> Add student
          </Button>
        </div>
      </div>

      {canManageAcademics && activeSchoolId && (
        <AdmissionNumberLoginPanel
          key={admissionNoFromUrl || "lookup"}
          schoolId={activeSchoolId}
          initialAdmissionNo={admissionNoFromUrl}
          onInvite={openInviteForPending}
        />
      )}

      {canManageAcademics && (
        <PendingStudentLoginPanel
          pending={pendingLogins}
          onInvite={openInviteForPending}
        />
      )}

      <div className="rounded-md border bg-card text-card-foreground shadow-sm">
        <div className="p-4 flex items-center justify-between">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search students..."
              value={globalFilter ?? ""}
              onChange={(event) => setGlobalFilter(String(event.target.value))}
              className="pl-9"
            />
          </div>
        </div>

        <div className="border-t">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    )
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 8 }, (_, i) => (
                  <TableRow key={`sk-${i}`}>
                    {columns.map((_, ci) => (
                      <TableCell key={ci}>
                        <Skeleton className="h-4 w-full min-w-[3rem]" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-48 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <p>No students found.</p>
                      <Button variant="link" className="mt-2" type="button" onClick={openStudentInvite}>
                        Invite your first student
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-end space-x-2 p-4 border-t">
          <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
            Previous
          </Button>
          <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
