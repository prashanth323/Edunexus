import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  getStaffMemberForEdit,
  getStaffTeachingRoles,
  setStaffTeachingRoles,
  updateStaffProfileByAdmin,
} from "../api/staff.api"
import { useAuth } from "@/features/auth/hooks/useAuth"

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

export function StaffProfileEdit() {
  const { staffId } = useParams<{ staffId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const initialize = useAuth((s) => s.initialize)

  const { data, isLoading } = useQuery({
    queryKey: ["staff-edit", staffId],
    queryFn: () => getStaffMemberForEdit(staffId!),
    enabled: !!staffId,
  })

  const { data: teachingRoles, isLoading: teachingRolesLoading } = useQuery({
    queryKey: ["staff-teaching-roles", staffId],
    queryFn: () => getStaffTeachingRoles(staffId!),
    enabled: !!staffId && !!data?.profile_id,
  })

  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [phone, setPhone] = useState("")
  const [designation, setDesignation] = useState("")
  const [joiningDate, setJoiningDate] = useState("")
  const [employmentType, setEmploymentType] = useState("full_time")
  const [experienceYears, setExperienceYears] = useState("")
  const [specialization, setSpecialization] = useState("")
  const [biography, setBiography] = useState("")
  const [subjectTeacher, setSubjectTeacher] = useState(false)
  const [classTeacher, setClassTeacher] = useState(false)

  useEffect(() => {
    if (!data) return
    const p = data.profiles
    const profile = Array.isArray(p) ? p[0] : p
    if (!profile) return
    setFirstName(profile.first_name ?? "")
    setLastName(profile.last_name ?? "")
    setPhone(profile.phone ?? "")
    setDesignation(data.designation ?? "")
    setJoiningDate(data.joining_date ?? "")
    setEmploymentType(data.employment_type ?? "full_time")
    setExperienceYears(data.experience_years != null ? String(data.experience_years) : "")
    setSpecialization(data.specialization ?? "")
    setBiography(data.biography ?? "")
  }, [data])

  useEffect(() => {
    if (!teachingRoles) return
    setSubjectTeacher(teachingRoles.subjectTeacher)
    setClassTeacher(teachingRoles.classTeacher)
  }, [teachingRoles])

  const saveMutation = useMutation({
    mutationFn: async () => {
      await updateStaffProfileByAdmin(
        staffId!,
        {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone: phone.trim(),
        },
        {
          designation: designation.trim(),
          joining_date: joiningDate || null,
          employment_type: employmentType,
          experience_years: experienceYears ? Number(experienceYears) : null,
          specialization: specialization.trim() || null,
          biography: biography.trim() || null,
        },
      )
      if (data?.profile_id) {
        await setStaffTeachingRoles(staffId!, subjectTeacher, classTeacher)
      }
    },
    onSuccess: async () => {
      toast.success("Staff profile updated")
      qc.invalidateQueries({ queryKey: ["staff-directory"] })
      qc.invalidateQueries({ queryKey: ["staff-teaching-roles", staffId] })
      await initialize({ refreshProfile: true })
      navigate("/staff")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading…
      </div>
    )
  }

  if (!data) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        Staff member not found.{" "}
        <Link to="/staff" className="text-primary underline">
          Back to directory
        </Link>
      </div>
    )
  }

  const hasLogin = !!data.profile_id

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/staff">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to staff
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Edit staff details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>First name</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Last name</Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
            <div className="grid gap-1.5 sm:col-span-2">
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>

          <div className="border-t pt-4 grid sm:grid-cols-2 gap-3">
            <div className="grid gap-1.5 sm:col-span-2">
              <Label>Designation</Label>
              <Input value={designation} onChange={(e) => setDesignation(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Joining date</Label>
              <Input type="date" value={joiningDate} onChange={(e) => setJoiningDate(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Employment type</Label>
              <select
                className={selectClass}
                value={employmentType}
                onChange={(e) => setEmploymentType(e.target.value)}
              >
                <option value="full_time">Full time</option>
                <option value="part_time">Part time</option>
                <option value="contract">Contract</option>
                <option value="visiting">Visiting</option>
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label>Experience (years)</Label>
              <Input
                type="number"
                min={0}
                value={experienceYears}
                onChange={(e) => setExperienceYears(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5 sm:col-span-2">
              <Label>Specialization</Label>
              <Input value={specialization} onChange={(e) => setSpecialization(e.target.value)} />
            </div>
            <div className="grid gap-1.5 sm:col-span-2">
              <Label>Biography</Label>
              <Textarea value={biography} onChange={(e) => setBiography(e.target.value)} rows={3} />
            </div>
          </div>

          <div className="border-t pt-4 space-y-3">
            <div>
              <p className="text-sm font-medium">Teaching roles</p>
              <p className="text-xs text-muted-foreground mt-1">
                Subject teachers use timetable, LMS, exams, and homework. Class teachers manage homeroom
                students, daily attendance, and student profile updates. Select both for staff who do
                both. Assign homeroom sections under Classes; assign subject periods in Timetable.
              </p>
            </div>
            {!hasLogin ? (
              <p className="text-sm text-muted-foreground">
                This employee has no portal login yet. Invite them before assigning teaching roles.
              </p>
            ) : teachingRolesLoading ? (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading teaching roles…
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-input"
                    checked={subjectTeacher}
                    onChange={(e) => setSubjectTeacher(e.target.checked)}
                  />
                  Subject teacher
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-input"
                    checked={classTeacher}
                    onChange={(e) => setClassTeacher(e.target.checked)}
                  />
                  Class teacher
                </label>
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Save changes
            </Button>
            <Button variant="outline" onClick={() => navigate("/staff")}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
