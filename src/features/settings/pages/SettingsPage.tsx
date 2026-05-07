import { Building2, KeyRound, Loader2, Mail, User, Plus, Trash2, GraduationCap } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { useAuth } from "@/features/auth/hooks/useAuth"
import {
  listSchoolsBrief,
  setPasswordSchema,
  type SetPasswordFormValues,
  updateAccountPassword,
} from "@/features/auth/api/auth.api"
import {
  profileSettingsSchema,
  type ProfileSettingsFormValues,
} from "@/features/auth/lib/profileEssentials"
import { SchoolSettingsSection } from "@/features/settings/components/SchoolSettingsSection"
import { canEditSchoolSettings } from "@/features/settings/api/school-settings.api"
import { fetchMyStaffProfessionalDetails, updateMyStaffProfessionalDetails, type Qualification } from "@/features/settings/api/teacher-subject.api"
import { LmsTeacherProfileFields } from "@/features/settings/components/LmsTeacherProfileFields"
import { defaultLmsTeacherProfile, type LmsTeacherProfile } from "@/features/settings/lib/lmsTeacherProfile"
import { getSubjects } from "@/features/lms/api/lms.api"
import { supabase } from "@/lib/supabase"

const TEACHING_SUBJECT_ROLES = new Set(["teacher", "class_teacher", "librarian"])

export function SettingsPage() {
  const { profile, user, activeSchoolId, activeRole } = useAuth()
  const canSetTeachingSubject = TEACHING_SUBJECT_ROLES.has(activeRole ?? "")
  const requiresTeacherTeachingProfile = activeRole === "teacher" || activeRole === "class_teacher"
  const qc = useQueryClient()
  const [passwordSubmitting, setPasswordSubmitting] = useState(false)
  const [profileSubmitting, setProfileSubmitting] = useState(false)

  const [teachingSubjectId, setTeachingSubjectId] = useState("")
  const [experienceYears, setExperienceYears] = useState<number | "">("")
  const [specialization, setSpecialization] = useState("")
  const [biography, setBiography] = useState("")
  const [qualifications, setQualifications] = useState<Qualification[]>([])
  const [lmsTeacherProfile, setLmsTeacherProfile] = useState<LmsTeacherProfile>(() => defaultLmsTeacherProfile())

  const profDetailsQuery = useQuery({
    queryKey: ["my-staff-professional-details", activeSchoolId, user?.id],
    queryFn: () => fetchMyStaffProfessionalDetails(activeSchoolId!, user!.id),
    enabled: canSetTeachingSubject && !!activeSchoolId && !!user?.id,
  })

  const teachingSubjectsQuery = useQuery({
    queryKey: ["lms-subjects", activeSchoolId],
    queryFn: () => getSubjects(activeSchoolId!),
    enabled: canSetTeachingSubject && !!activeSchoolId,
  })

  useEffect(() => {
    if (!profDetailsQuery.isFetched || !profDetailsQuery.data) return
    const d = profDetailsQuery.data
    setTeachingSubjectId(d.primarySubjectId ?? "")
    setExperienceYears(d.experienceYears ?? "")
    setSpecialization(d.specialization ?? "")
    setBiography(d.biography ?? "")
    setQualifications(d.qualifications ?? [])
    setLmsTeacherProfile(d.lmsTeacherProfile ?? defaultLmsTeacherProfile())
  }, [profDetailsQuery.isFetched, profDetailsQuery.data])

  const hasStaffRow = profDetailsQuery.isSuccess && !!profDetailsQuery.data?.staffId

  const saveProfDetailsMut = useMutation({
    mutationFn: async () => {
      if (!activeSchoolId || !user?.id) throw new Error("Missing context.")
      if (requiresTeacherTeachingProfile) {
        if (!teachingSubjectId.trim()) throw new Error("Select your primary teaching subject.")
        if (experienceYears === "" || typeof experienceYears !== "number" || experienceYears < 0) {
          throw new Error("Enter your years of experience (0 or more).")
        }
        const spec = specialization.trim()
        if (spec.length < 2) throw new Error("Enter your area of specialization.")
        if (biography.trim().length < 30) {
          throw new Error("Write a professional bio (at least 30 characters).")
        }
        if (!qualifications.length) {
          throw new Error("Add at least one qualification with degree, institute, and year.")
        }
        for (let i = 0; i < qualifications.length; i++) {
          const q = qualifications[i]
          if (!q.degree.trim() || !q.institute.trim() || !q.year.trim()) {
            throw new Error(`Complete qualification ${i + 1}: degree, institute, and year are required.`)
          }
        }
        if (teachingSubjectId && lmsTeacherProfile.secondarySubjectIds.includes(teachingSubjectId)) {
          throw new Error("Remove your primary subject from secondary subjects.")
        }
        const lang = lmsTeacherProfile.languagesSpoken.trim()
        const grades = lmsTeacherProfile.gradeLevelsTaught.trim()
        if (lang.length < 3) {
          throw new Error("List languages of instruction or communication you use.")
        }
        if (grades.length < 3) {
          throw new Error("Specify grade levels or classes you teach.")
        }
        for (let i = 0; i < lmsTeacherProfile.professionalCertifications.length; i++) {
          const c = lmsTeacherProfile.professionalCertifications[i]
          const nonempty = !!(c.name.trim() || c.issuer.trim() || c.year.trim())
          if (!nonempty) continue
          if (!c.name.trim() || !c.issuer.trim() || !c.year.trim()) {
            throw new Error(`Complete certification ${i + 1} or clear all three fields for that row.`)
          }
        }
      }

      const subjectCatalog = teachingSubjectsQuery.data ?? []
      const secondarySubjectRefs = lmsTeacherProfile.secondarySubjectIds.map((id) => ({
        id,
        name: subjectCatalog.find((s) => s.id === id)?.name ?? id,
      }))
      const professionalCertificationsFiltered = lmsTeacherProfile.professionalCertifications.filter(
        (c) => (c.name + c.issuer + c.year).trim() !== "",
      )

      await updateMyStaffProfessionalDetails(activeSchoolId, user.id, {
        primarySubjectId: teachingSubjectId || null,
        experienceYears: typeof experienceYears === "number" ? experienceYears : null,
        specialization: specialization.trim() || null,
        biography: biography.trim() || null,
        qualifications,
        lmsTeacherProfile: {
          ...lmsTeacherProfile,
          secondarySubjectRefs,
          professionalCertifications: professionalCertificationsFiltered,
        },
      })
    },
    onSuccess: () => {
      toast.success("Professional details saved.")
      qc.invalidateQueries({ queryKey: ["my-staff-professional-details"] })
      if (activeSchoolId) qc.invalidateQueries({ queryKey: ["staff-directory", activeSchoolId] })
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not save details"),
  })

  const addQualification = () => {
    setQualifications([...qualifications, { degree: "", institute: "", year: "" }])
  }

  const removeQualification = (index: number) => {
    setQualifications(qualifications.filter((_, i) => i !== index))
  }

  const updateQualification = (index: number, field: keyof Qualification, value: string) => {
    const next = [...qualifications]
    next[index] = { ...next[index], [field]: value }
    setQualifications(next)
  }

  const profileForm = useForm<ProfileSettingsFormValues>({
    resolver: zodResolver(profileSettingsSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      phone: "",
      gender: "prefer_not_to_say",
      date_of_birth: "",
    },
  })

  useEffect(() => {
    if (!profile) return
    profileForm.reset({
      first_name: profile.first_name ?? "",
      last_name: profile.last_name ?? "",
      phone: profile.phone ?? "",
      gender: (profile.gender as ProfileSettingsFormValues["gender"]) ?? "prefer_not_to_say",
      date_of_birth: profile.date_of_birth?.slice(0, 10) ?? "",
    })
  }, [profile, profileForm])

  async function onProfileSubmit(values: ProfileSettingsFormValues) {
    if (!user?.id) return
    try {
      setProfileSubmitting(true)
      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: values.first_name.trim(),
          last_name: values.last_name.trim(),
          phone: values.phone.trim(),
          gender: values.gender,
          date_of_birth: values.date_of_birth,
        })
        .eq("id", user.id)

      if (error) throw error
      await useAuth.getState().initialize({ refreshProfile: true })
      toast.success("Profile saved.")
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not save profile"
      toast.error(msg)
    } finally {
      setProfileSubmitting(false)
    }
  }

  const passwordForm = useForm<SetPasswordFormValues>({
    resolver: zodResolver(setPasswordSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  })

  async function onPasswordSubmit(values: SetPasswordFormValues) {
    try {
      setPasswordSubmitting(true)
      await updateAccountPassword(values.newPassword)
      toast.success("Password updated. Use it next time you sign in.")
      passwordForm.reset({ newPassword: "", confirmPassword: "" })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not update password"
      toast.error(msg)
    } finally {
      setPasswordSubmitting(false)
    }
  }

  const { data: schoolsBrief = [] } = useQuery({
    queryKey: ["settings-schools-brief"],
    queryFn: listSchoolsBrief,
    enabled: !!activeSchoolId,
  })

  const schoolName = useMemo(() => {
    const hit = profile?.user_roles?.find(
      (r: { school_id: string; schools?: { name?: string } }) => r.school_id === activeSchoolId,
    )
    if (hit?.schools?.name) return hit.schools.name as string
    if (activeSchoolId && schoolsBrief.length) {
      return schoolsBrief.find((s) => s.id === activeSchoolId)?.name
    }
    return undefined
  }, [profile?.user_roles, activeSchoolId, schoolsBrief])

  const showSchoolEditor = canEditSchoolSettings(activeRole) && !!activeSchoolId

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">
          {activeRole === "super_admin" ? "Your platform profile settings." : "Your profile and active school context."}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <User className="h-5 w-5" />
            Profile
          </CardTitle>
          <CardDescription>
            Update your display name and contact details. Email is tied to your login — contact an admin to change it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-start gap-2 text-sm">
            <Mail className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
            <div>
              <span className="text-muted-foreground">Email</span>
              <p className="font-medium">{user?.email ?? profile?.email ?? "—"}</p>
            </div>
          </div>

          <Form {...profileForm}>
            <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={profileForm.control}
                  name="first_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First name</FormLabel>
                      <FormControl>
                        <Input autoComplete="given-name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={profileForm.control}
                  name="last_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last name</FormLabel>
                      <FormControl>
                        <Input autoComplete="family-name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={profileForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input autoComplete="tel" placeholder="+1 …" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={profileForm.control}
                name="gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gender</FormLabel>
                    <FormControl>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        {...field}
                      >
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                        <option value="prefer_not_to_say">Prefer not to say</option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={profileForm.control}
                name="date_of_birth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date of birth</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="text-sm">
                <span className="text-muted-foreground">Effective role</span>
                <p className="font-medium capitalize">{activeRole?.replace(/_/g, " ") ?? "—"}</p>
              </div>
              <Button type="submit" disabled={profileSubmitting}>
                {profileSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save profile"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {canSetTeachingSubject && activeSchoolId && user?.id ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <GraduationCap className="h-5 w-5" />
              {"Teaching profile & qualifications"}
            </CardTitle>
          <CardDescription>
            Academic qualifications, LMS scope (subjects you cover, grades, languages), license and PD certifications,
            availability and guidance for families, plus optional public links. Principals open this from Staff
            Directory.
            {requiresTeacherTeachingProfile ? (
              <span className="block mt-1 text-amber-700 dark:text-amber-500/90">
                Teachers must fill every required field—including languages and grade levels taught—before saving.
              </span>
            ) : null}
          </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {profDetailsQuery.isLoading || teachingSubjectsQuery.isLoading ? (
              <div className="grid gap-4 sm:grid-cols-2 py-2">
                {Array.from({ length: 8 }, (_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ))}
              </div>
            ) : teachingSubjectsQuery.isError ? (
              <p className="text-sm text-muted-foreground">Could not load subjects. Try refreshing the page.</p>
            ) : profDetailsQuery.isError ? (
              <p className="text-sm text-muted-foreground">Could not load your staff record. Try again later.</p>
            ) : !hasStaffRow ? (
              <p className="text-sm text-muted-foreground">
                Your account is not linked to a staff record for this school. Ask an administrator to add you as staff before you can save professional details.
              </p>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor="teaching-subject" className="text-sm font-medium">
                      Primary teaching subject
                      {requiresTeacherTeachingProfile ? (
                        <span className="text-destructive font-normal"> *</span>
                      ) : null}
                    </label>
                    <select
                      id="teaching-subject"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={teachingSubjectId}
                      onChange={(e) => setTeachingSubjectId(e.target.value)}
                    >
                      <option value="">
                        {requiresTeacherTeachingProfile ? "Select a subject…" : "None — optional for this role"}
                      </option>
                      {(teachingSubjectsQuery.data ?? []).map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                          {s.code ? ` (${s.code})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="experience" className="text-sm font-medium">
                      Years of Experience
                    </label>
                    <Input
                      id="experience"
                      type="number"
                      min={0}
                      value={experienceYears}
                      onChange={(e) => setExperienceYears(e.target.value === "" ? "" : parseInt(e.target.value))}
                      placeholder="e.g. 5"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="specialization" className="text-sm font-medium">
                    Area of Specialization
                  </label>
                  <Input
                    id="specialization"
                    value={specialization}
                    onChange={(e) => setSpecialization(e.target.value)}
                    placeholder="e.g. Organic Chemistry, Modern Literature"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="biography" className="text-sm font-medium">
                    Professional Bio
                  </label>
                  <textarea
                    id="biography"
                    className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={biography}
                    onChange={(e) => setBiography(e.target.value)}
                    placeholder="Briefly describe your professional background and teaching philosophy..."
                  />
                </div>

                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold">Qualifications</h4>
                    <Button type="button" variant="outline" size="sm" onClick={addQualification}>
                      <Plus className="h-4 w-4 mr-1" /> Add
                    </Button>
                  </div>

                  {qualifications.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No qualifications added yet.</p>
                  ) : (
                    <div className="space-y-4">
                      {qualifications.map((q, idx) => (
                        <div key={idx} className="grid gap-3 p-3 border rounded-lg bg-muted/30 relative group">
                          <div className="grid gap-2 sm:grid-cols-3">
                            <div className="space-y-1">
                              <label className="text-[10px] uppercase font-bold text-muted-foreground">Degree</label>
                              <Input
                                size={1}
                                className="h-8 text-xs"
                                value={q.degree}
                                onChange={(e) => updateQualification(idx, "degree", e.target.value)}
                                placeholder="B.Ed, M.Sc, etc."
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] uppercase font-bold text-muted-foreground">Institute</label>
                              <Input
                                size={1}
                                className="h-8 text-xs"
                                value={q.institute}
                                onChange={(e) => updateQualification(idx, "institute", e.target.value)}
                                placeholder="University name"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] uppercase font-bold text-muted-foreground">Year</label>
                              <Input
                                size={1}
                                className="h-8 text-xs"
                                value={q.year}
                                onChange={(e) => updateQualification(idx, "year", e.target.value)}
                                placeholder="YYYY"
                              />
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-background border shadow-sm opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                            onClick={() => removeQualification(idx)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <LmsTeacherProfileFields
                  subjects={teachingSubjectsQuery.data ?? []}
                  primarySubjectId={teachingSubjectId}
                  value={lmsTeacherProfile}
                  onChange={setLmsTeacherProfile}
                />

                <div className="pt-4 border-t">
                  <Button 
                    type="button" 
                    onClick={() => saveProfDetailsMut.mutate()} 
                    disabled={saveProfDetailsMut.isPending}
                  >
                    {saveProfDetailsMut.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving…
                      </>
                    ) : (
                      "Save professional details"
                    )}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ) : null}

      {showSchoolEditor && activeSchoolId ? (
        <SchoolSettingsSection schoolId={activeSchoolId} />
      ) : activeRole !== "super_admin" ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building2 className="h-5 w-5" />
              Active school
            </CardTitle>
            <CardDescription>
              Data across the app is scoped to this school when applicable.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm">
            <p className="font-medium">{schoolName ?? (activeSchoolId ? "School selected" : "None")}</p>
            {activeSchoolId && (
              <p className="text-xs text-muted-foreground mt-1 font-mono break-all">{activeSchoolId}</p>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <KeyRound className="h-5 w-5" />
            Password
          </CardTitle>
          <CardDescription>
            Set or change the password for this account. You must be signed in; all roles use the same flow.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...passwordForm}>
            <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4 max-w-md">
              <FormField
                control={passwordForm.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New password</FormLabel>
                    <FormControl>
                      <PasswordInput autoComplete="new-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={passwordForm.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm new password</FormLabel>
                    <FormControl>
                      <PasswordInput autoComplete="new-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={passwordSubmitting}>
                {passwordSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating…
                  </>
                ) : (
                  "Update password"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
