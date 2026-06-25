import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Search, Plus, Mail, Phone, Building, Briefcase, Loader2, MoreVertical, X, FileUp } from "lucide-react"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { StaffDirectorySkeletonGrid } from "@/components/ui/card-skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Label } from "@/components/ui/label"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { getStaffMembers, teachingRoleBadges, type StaffMember } from "../api/staff.api"
import { StaffMemberDetailModal } from "../components/StaffMemberDetailModal"
import { inviteSchoolUsers } from "@/features/invites/api/invites.api"
import { PRINCIPAL_INVITE_STAFF_ROLES, formatSchoolRoleLabel } from "@/config/school-roles"
import { toast } from "sonner"
import { BulkImportDialog, type CSVColumn } from "@/components/common/BulkImportDialog"



export function StaffDirectory() {
  const activeSchoolId = useAuth((s) => s.activeSchoolId)
  const activeRole = useAuth((s) => s.activeRole)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState("")
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteSubmitting, setInviteSubmitting] = useState(false)
  const [singleEmail, setSingleEmail] = useState("")
  const [singleFirst, setSingleFirst] = useState("")
  const [singleLast, setSingleLast] = useState("")
  const [singleRole, setSingleRole] = useState<string>(PRINCIPAL_INVITE_STAFF_ROLES[0] ?? "teacher")
  const [bulkImportOpen, setBulkImportOpen] = useState(false)
  const [detailMember, setDetailMember] = useState<StaffMember | null>(null)

  const canEditStaff =
    activeRole === "vice_principal" ||
    activeRole === "principal" ||
    activeRole === "school_admin" ||
    activeRole === "hr_manager"

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ["staff-directory", activeSchoolId],
    queryFn: () => getStaffMembers(activeSchoolId!),
    enabled: !!activeSchoolId,
  })

  const filteredStaff = staff.filter(
    (s) =>
      `${s.first_name} ${s.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.department && s.department.toLowerCase().includes(searchQuery.toLowerCase())),
  )

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500/10 text-green-500 hover:bg-green-500/20"
      case "on_leave":
        return "bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20"
      case "resigned":
        return "bg-red-500/10 text-red-500 hover:bg-red-500/20"
      default:
        return "bg-gray-500/10 text-gray-500"
    }
  }

  async function submitInvites(invitations: Parameters<typeof inviteSchoolUsers>[0]["invitations"]) {
    if (!activeSchoolId) return
    setInviteSubmitting(true)
    try {
      const res = await inviteSchoolUsers({ schoolId: activeSchoolId, invitations })
      const failed = res.results.filter((r) => !r.ok)
      
      if (failed.length > 0) {
        if (failed.length > 3) {
          toast.error(`${failed.length} invitations failed. Check the console.`)
          console.error("Staff invite failures:", failed)
        } else {
          failed.forEach((f) => toast.error(`${f.email}: ${f.error ?? "Failed"}`))
        }
      }

      const okCount = res.results.filter((r) => r.ok).length
      if (okCount) toast.success(`Sent ${okCount} invitation(s).`)
      
      if (okCount) {
        await queryClient.invalidateQueries({ queryKey: ["staff-directory", activeSchoolId] })
        if (failed.length === 0) {
          setInviteOpen(false)
        }
        setSingleEmail("")
        setSingleFirst("")
        setSingleLast("")
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Invite failed")
    } finally {
      setInviteSubmitting(false)
    }
  }

  async function handleSingleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const email = singleEmail.trim().toLowerCase()
    if (!email) {
      toast.error("Email is required")
      return
    }
    await submitInvites([
      {
        email,
        first_name: singleFirst.trim(),
        last_name: singleLast.trim(),
        role: singleRole,
      },
    ])
  }

  const STAFF_CSV_COLUMNS: CSVColumn[] = [
    { key: "email", label: "Email", required: true },
    { key: "first_name", label: "First Name", required: true },
    { key: "last_name", label: "Last Name", required: true },
    { key: "role", label: "Role", required: true, description: "e.g. teacher, librarian, etc." },
  ]

  const STAFF_TEMPLATE_ROWS = [
    ["jane.smith@school.edu", "Jane", "Smith", "teacher"],
    ["john.doe@school.edu", "John", "Doe", "school_admin"],
  ]

  async function handleBulkImport(data: any[]) {
    await submitInvites(data.map((r) => ({ ...r })))
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 animate-in fade-in duration-500">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Staff & HR Directory</h1>
            <p className="text-muted-foreground mt-1">Manage school employees, roles, and contact information.</p>
          </div>
          <div className="h-10 w-40 rounded-md bg-muted animate-pulse shrink-0" />
        </div>
        <div className="flex items-center gap-2 max-w-sm">
          <div className="h-10 w-full rounded-md bg-muted animate-pulse" />
        </div>
        <StaffDirectorySkeletonGrid />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      {detailMember && <StaffMemberDetailModal member={detailMember} onClose={() => setDetailMember(null)} />}

      {inviteOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-lg border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <h2 className="text-lg font-semibold">Invite employees</h2>
                <p className="text-sm text-muted-foreground">
                  Sends login email per address. One role per invite.
                </p>
              </div>
              <Button variant="ghost" size="icon" type="button" onClick={() => setInviteOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              <form onSubmit={handleSingleSubmit} className="space-y-3">
                <p className="text-sm font-medium">Single invite</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label htmlFor="inv-email">Email</Label>
                    <Input
                      id="inv-email"
                      type="email"
                      value={singleEmail}
                      onChange={(e) => setSingleEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="inv-fn">First name</Label>
                    <Input id="inv-fn" value={singleFirst} onChange={(e) => setSingleFirst(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="inv-ln">Last name</Label>
                    <Input id="inv-ln" value={singleLast} onChange={(e) => setSingleLast(e.target.value)} />
                  </div>
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label htmlFor="inv-role">Role</Label>
                    <select
                      id="inv-role"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={singleRole}
                      onChange={(e) => setSingleRole(e.target.value)}
                    >
                      {PRINCIPAL_INVITE_STAFF_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {formatSchoolRoleLabel(r)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <Button type="submit" disabled={inviteSubmitting} className="w-full sm:w-auto">
                  {inviteSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send invite"}
                </Button>
              </form>

                <div className="pt-4 border-t">
                  <p className="text-sm font-medium mb-2">Bulk import employees</p>
                  <p className="text-xs text-muted-foreground mb-4">
                    Upload a CSV file to invite multiple staff members at once. 
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

            <BulkImportDialog
              open={bulkImportOpen}
              onOpenChange={setBulkImportOpen}
              title="Import Employees"
              description="Bulk invite school staff by uploading a CSV file. We'll send them invitations automatically."
              columns={STAFF_CSV_COLUMNS}
              templateRows={STAFF_TEMPLATE_ROWS}
              onUpload={handleBulkImport}
            />
          </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Staff & HR Directory</h1>
          <p className="text-muted-foreground mt-1">Manage school employees, roles, and contact information.</p>
        </div>
        <Button className="shrink-0 gap-2" type="button" onClick={() => setInviteOpen(true)}>
          <Plus className="h-4 w-4" /> Add employee
        </Button>
      </div>

      <div className="flex items-center gap-2 max-w-sm">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search employees..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mt-4">
        {filteredStaff.map((member: StaffMember) => (
          <Card
            key={member.id}
            role="button"
            tabIndex={0}
            onClick={() => setDetailMember(member)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                setDetailMember(member)
              }
            }}
            className="overflow-hidden hover:border-primary/50 transition-colors group cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <CardHeader className="p-0">
              <div className="h-16 bg-muted/50 w-full relative">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 h-8 w-8 bg-background/50 hover:bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenuItem onSelect={() => setDetailMember(member)}>View full profile</DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={!canEditStaff}
                      onSelect={() => navigate(`/staff/${member.id}/edit`)}
                    >
                      Edit details
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled>Deactivate</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="flex justify-center -mt-10 mb-2">
                <Avatar className="h-20 w-20 border-4 border-background shadow-sm">
                  <AvatarImage
                    src={`https://api.dicebear.com/7.x/initials/svg?seed=${member.first_name} ${member.last_name}`}
                  />
                  <AvatarFallback>
                    {member.first_name?.[0] ?? "?"}
                    {member.last_name?.[0] ?? ""}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div className="text-center px-4 pb-2">
                <h3 className="font-semibold text-lg truncate">
                  {member.first_name} {member.last_name}
                </h3>
                <p className="text-sm text-muted-foreground capitalize">
                  {member.designation || member.role.replace("_", " ")}
                </p>
                {teachingRoleBadges(member.role).length > 0 && (
                  <div className="flex flex-wrap justify-center gap-1 mt-2">
                    {teachingRoleBadges(member.role).map((badge) => (
                      <Badge key={badge} variant="outline" className="text-xs">
                        {badge === "Subject" ? "Subject teacher" : "Class teacher"}
                      </Badge>
                    ))}
                    {teachingRoleBadges(member.role).length === 2 && (
                      <Badge variant="secondary" className="text-xs">
                        Both
                      </Badge>
                    )}
                  </div>
                )}
                <div className="mt-2">
                  <Badge
                    variant="secondary"
                    className={`capitalize text-xs font-normal border-transparent ${getStatusColor(member.status)} `}
                  >
                    {member.status.replace("_", " ")}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-2 bg-muted/10 border-t">
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Mail className="h-4 w-4 shrink-0" />
                  <span className="truncate" title={member.email}>
                    {member.email}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Phone className="h-4 w-4 shrink-0" />
                  <span>{member.phone || "N/A"}</span>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Building className="h-4 w-4 shrink-0" />
                  <span className="truncate">{member.department || "General"}</span>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Briefcase className="h-4 w-4 shrink-0" />
                  <span className="capitalize">{member.role.replace(/_/g, " ")}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {filteredStaff.length === 0 && (
          <div className="col-span-full py-12 text-center border-2 border-dashed rounded-lg">
            <h3 className="text-lg font-medium">{staff.length === 0 ? "No staff yet" : "No staff members found"}</h3>
            <p className="text-muted-foreground mt-1">
              {staff.length === 0
                ? "Invite employees to see them here."
                : "Try adjusting your search query."}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
