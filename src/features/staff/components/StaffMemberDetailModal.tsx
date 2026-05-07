import {
  Briefcase,
  Building2,
  Calendar,
  GraduationCap,
  Mail,
  MapPin,
  Phone,
  UserCircle,
  VenusAndMars,
  X,
  Globe,
} from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { StaffMember } from "../api/staff.api"
import type { LmsTeacherProfile } from "@/features/settings/lib/lmsTeacherProfile"

function formatGender(g: string | null | undefined) {
  if (!g) return "—"
  return g.replace(/_/g, " ")
}

function formatDate(raw: string | null | undefined) {
  if (!raw) return "—"
  const d = raw.slice(0, 10)
  if (!d) return "—"
  try {
    return new Date(`${d}T12:00:00`).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  } catch {
    return d
  }
}

function formatAddress(addr: StaffMember["address"]): string | null {
  if (!addr) return null
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = addr[k]
      if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim()
    }
    return ""
  }
  const line1 = pick("street", "address_street", "line1")
  const parts = [
    line1,
    [pick("city", "address_city"), pick("state", "address_state"), pick("zip", "address_zip")]
      .filter(Boolean)
      .join(", "),
    pick("country", "address_country"),
  ].filter(Boolean)
  return parts.length ? parts.join(" · ") : null
}

function lmsProfileHasContent(lms: LmsTeacherProfile) {
  const lic = lms.teachingLicense
  return (
    (lms.secondarySubjectIds?.length ?? 0) > 0 ||
    lms.languagesSpoken.trim() !== "" ||
    lms.gradeLevelsTaught.trim() !== "" ||
    lms.officeHours.trim() !== "" ||
    lms.studentSupportNotes.trim() !== "" ||
    lms.professionalWebsiteUrl.trim() !== "" ||
    lms.linkedinUrl.trim() !== "" ||
    lms.preferredContactMethod !== "" ||
    lic.issuingAuthority.trim() !== "" ||
    lic.licenseNumber.trim() !== "" ||
    lic.validUntil.trim() !== "" ||
    (lms.professionalCertifications?.some((c) => c.name.trim() || c.issuer.trim() || c.year.trim()) ?? false)
  )
}

function safeExternalHref(raw: string) {
  const u = raw.trim()
  if (!u) return null
  return u.startsWith("http://") || u.startsWith("https://") ? u : `https://${u}`
}

function preferredContactLabel(m: string) {
  if (m === "email") return "Official school email"
  if (m === "phone") return "Phone"
  if (m === "in_app_message") return "In-app / LMS messaging"
  return "—"
}

type Props = {
  member: StaffMember | null
  onClose: () => void
}

export function StaffMemberDetailModal({ member, onClose }: Props) {
  if (!member) return null

  const addressLine = formatAddress(member.address ?? null)
  const lms = member.lmsTeacherProfile
  const hasTeachingBlock =
    member.primary_subject_name ||
    member.experience_years != null ||
    member.specialization ||
    member.biography ||
    (member.qualifications?.length ?? 0) > 0 ||
    lmsProfileHasContent(lms)

  const getStatusTone = () => {
    switch (member.status) {
      case "active":
        return "bg-green-500/10 text-green-700 dark:text-green-400 border-transparent"
      case "on_leave":
        return "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-transparent"
      case "resigned":
        return "bg-red-500/10 text-red-700 dark:text-red-400 border-transparent"
      default:
        return "bg-muted border-transparent"
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
      role="presentation"
      onClick={onClose}
    >
      <Card
        role="dialog"
        aria-labelledby="staff-detail-title"
        className="w-full max-w-3xl max-h-[92vh] overflow-y-auto shadow-lg border relative"
        onClick={(e) => e.stopPropagation()}
      >
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-2 sticky top-0 bg-card z-10 border-b">
          <div className="flex gap-4 min-w-0 items-start">
            <Avatar className="h-14 w-14 border shrink-0">
              <AvatarImage
                src={
                  member.avatar_url?.trim() ||
                  `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(`${member.first_name} ${member.last_name}`)}`
                }
                alt=""
              />
              <AvatarFallback>
                {member.first_name?.[0] ?? "?"}
                {member.last_name?.[0] ?? ""}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 space-y-1">
              <h2 id="staff-detail-title" className="text-xl font-semibold tracking-tight truncate">
                {member.first_name} {member.last_name}
              </h2>
              <p className="text-sm text-muted-foreground capitalize">
                {member.designation || member.role.replace(/_/g, " ")}
              </p>
              <Badge variant="secondary" className={`text-xs font-normal capitalize mt-1 ${getStatusTone()}`}>
                {member.status.replace(/_/g, " ")}
              </Badge>
            </div>
          </div>
          <Button variant="ghost" size="icon" type="button" className="shrink-0" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-8 pt-6">
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Contact
            </h3>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div className="flex gap-2 min-w-0">
                <dt className="text-muted-foreground shrink-0 w-20">Email</dt>
                <dd className="font-medium truncate" title={member.email}>
                  {member.email}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-muted-foreground shrink-0 w-20 flex items-start gap-1">
                  <Phone className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  Phone
                </dt>
                <dd className="font-medium">{member.phone?.trim() || "—"}</dd>
              </div>
              {lms.preferredContactMethod ? (
                <div className="flex gap-2">
                  <dt className="text-muted-foreground shrink-0 w-20">Reach via</dt>
                  <dd className="font-medium">{preferredContactLabel(lms.preferredContactMethod)}</dd>
                </div>
              ) : null}
            </dl>
          </section>

          <section className="space-y-3 border-t pt-6">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
              <UserCircle className="h-4 w-4" />
              Personal profile
            </h3>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div className="flex gap-2">
                <dt className="text-muted-foreground shrink-0 w-28 flex items-center gap-1">
                  <VenusAndMars className="h-3.5 w-3.5" />
                  Gender
                </dt>
                <dd className="font-medium capitalize">{formatGender(member.gender)}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-muted-foreground shrink-0 w-28 flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  Birth date
                </dt>
                <dd className="font-medium">{formatDate(member.date_of_birth)}</dd>
              </div>
              {addressLine ? (
                <div className="sm:col-span-2 flex gap-2">
                  <dt className="text-muted-foreground shrink-0 w-28 flex items-start gap-1">
                    <MapPin className="h-3.5 w-3.5 mt-0.5" />
                    Address
                  </dt>
                  <dd className="font-medium">{addressLine}</dd>
                </div>
              ) : (
                <div className="sm:col-span-2 flex gap-2">
                  <dt className="text-muted-foreground shrink-0 w-28">Address</dt>
                  <dd className="text-muted-foreground">Not on file — staff can add this in Profile settings.</dd>
                </div>
              )}
            </dl>
          </section>

          <section className="space-y-3 border-t pt-6">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              Employment
            </h3>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div className="flex gap-2">
                <dt className="text-muted-foreground shrink-0 w-28">Roles</dt>
                <dd className="font-medium capitalize">{member.role.replace(/_/g, " ")}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-muted-foreground shrink-0 w-28 flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" />
                  Department
                </dt>
                <dd className="font-medium">{member.department || "—"}</dd>
              </div>
              <div className="flex gap-2 sm:col-span-2">
                <dt className="text-muted-foreground shrink-0 w-28">Joining date</dt>
                <dd className="font-medium">{formatDate(member.joining_date)}</dd>
              </div>
            </dl>
          </section>

          <section className="space-y-3 border-t pt-6">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
              <GraduationCap className="h-4 w-4" />
              Qualifications and teaching profile
            </h3>
            {!hasTeachingBlock ? (
              <p className="text-sm text-muted-foreground">
                This staff member has not submitted teaching qualifications or primary subject yet (Settings →
                Teaching profile).
              </p>
            ) : (
              <>
                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  <div className="flex gap-2 sm:col-span-2">
                    <dt className="text-muted-foreground shrink-0 w-40">Primary subject</dt>
                    <dd className="font-medium">{member.primary_subject_name || "—"}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground shrink-0 w-40">Years of experience</dt>
                    <dd className="font-medium">
                      {member.experience_years != null ? `${member.experience_years}` : "—"}
                    </dd>
                  </div>
                  <div className="flex gap-2 sm:col-span-2">
                    <dt className="text-muted-foreground shrink-0 w-40">Specialization</dt>
                    <dd className="font-medium">{member.specialization?.trim() || "—"}</dd>
                  </div>
                  <div className="flex flex-col gap-1 sm:col-span-2">
                    <dt className="text-muted-foreground shrink-0 w-40">Professional bio</dt>
                    <dd className="font-medium whitespace-pre-wrap text-[15px] leading-relaxed">
                      {member.biography?.trim() || "—"}
                    </dd>
                  </div>
                </dl>

                {member.qualifications?.length ? (
                  <div className="rounded-md border mt-4 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[28%]">Degree / certification</TableHead>
                          <TableHead>Institute</TableHead>
                          <TableHead className="w-24 text-right">Year</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {member.qualifications.map((q, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium align-top">{q.degree?.trim() || "—"}</TableCell>
                            <TableCell className="align-top">{q.institute?.trim() || "—"}</TableCell>
                            <TableCell className="text-right align-top tabular-nums">{q.year?.trim() || "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground mt-2">No qualification rows recorded.</p>
                )}

                {lmsProfileHasContent(lms) ? (
                  <div className="space-y-6 mt-8 border-t pt-8">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <h4 className="text-sm font-semibold">Scope, scheduling, and public presence</h4>
                    </div>
                    <dl className="grid gap-3 text-sm sm:grid-cols-2">
                      <div className="flex flex-col gap-0.5 sm:col-span-2">
                        <dt className="text-muted-foreground">Secondary subjects</dt>
                        <dd className="font-medium">
                          {lms.secondarySubjectRefs?.length
                            ? lms.secondarySubjectRefs.map((r) => r.name).join(", ")
                            : lms.secondarySubjectIds.length > 0
                              ? `${lms.secondarySubjectIds.length} configured (subject names appear after teachers save)`
                              : "—"}
                        </dd>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <dt className="text-muted-foreground">Grade levels taught</dt>
                        <dd className="font-medium">{lms.gradeLevelsTaught.trim() || "—"}</dd>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <dt className="text-muted-foreground">Languages</dt>
                        <dd className="font-medium">{lms.languagesSpoken.trim() || "—"}</dd>
                      </div>
                      <div className="flex flex-col gap-1 sm:col-span-2">
                        <dt className="text-muted-foreground">Office hours</dt>
                        <dd className="font-medium whitespace-pre-wrap">{lms.officeHours.trim() || "—"}</dd>
                      </div>
                      <div className="flex flex-col gap-1 sm:col-span-2">
                        <dt className="text-muted-foreground">Guidance for students and parents</dt>
                        <dd className="font-medium whitespace-pre-wrap">{lms.studentSupportNotes.trim() || "—"}</dd>
                      </div>
                    </dl>

                    {(lms.teachingLicense.issuingAuthority.trim() ||
                      lms.teachingLicense.licenseNumber.trim() ||
                      lms.teachingLicense.validUntil.trim()) ? (
                      <dl className="grid gap-2 text-sm sm:grid-cols-3 border rounded-lg p-3 bg-muted/20">
                        <div className="sm:col-span-3 font-medium text-xs uppercase tracking-wide text-muted-foreground">
                          Teaching license
                        </div>
                        <div>
                          <dt className="text-muted-foreground text-xs">Authority</dt>
                          <dd className="font-medium">{lms.teachingLicense.issuingAuthority.trim() || "—"}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground text-xs">Registration ID</dt>
                          <dd className="font-medium">{lms.teachingLicense.licenseNumber.trim() || "—"}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground text-xs">Valid until</dt>
                          <dd className="font-medium">{formatDate(lms.teachingLicense.validUntil.trim() || undefined)}</dd>
                        </div>
                      </dl>
                    ) : null}

                    {lms.professionalCertifications.some((c) => c.name.trim() || c.issuer.trim() || c.year.trim()) ? (
                      <div className="rounded-md border overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[32%]">Certification</TableHead>
                              <TableHead>Issuer</TableHead>
                              <TableHead className="w-24 text-right">Year</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {lms.professionalCertifications
                              .filter((c) => c.name.trim() || c.issuer.trim() || c.year.trim())
                              .map((c, i) => (
                                <TableRow key={i}>
                                  <TableCell className="font-medium align-top">{c.name.trim() || "—"}</TableCell>
                                  <TableCell className="align-top">{c.issuer.trim() || "—"}</TableCell>
                                  <TableCell className="text-right tabular-nums align-top">{c.year.trim() || "—"}</TableCell>
                                </TableRow>
                              ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : null}

                    {(lms.professionalWebsiteUrl.trim() || lms.linkedinUrl.trim()) ? (
                      <dl className="grid gap-2 text-sm">
                        {lms.professionalWebsiteUrl.trim() ? (
                          <div className="flex flex-col gap-0.5">
                            <dt className="text-muted-foreground">Website</dt>
                            <dd>
                              {(() => {
                                const href = safeExternalHref(lms.professionalWebsiteUrl)
                                if (!href) return <span>{lms.professionalWebsiteUrl.trim()}</span>
                                return (
                                  <a
                                    href={href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary font-medium underline break-all"
                                  >
                                    {lms.professionalWebsiteUrl.trim()}
                                  </a>
                                )
                              })()}
                            </dd>
                          </div>
                        ) : null}
                        {lms.linkedinUrl.trim() ? (
                          <div className="flex flex-col gap-0.5">
                            <dt className="text-muted-foreground">LinkedIn</dt>
                            <dd>
                              {(() => {
                                const href = safeExternalHref(lms.linkedinUrl)
                                if (!href) return <span>{lms.linkedinUrl.trim()}</span>
                                return (
                                  <a
                                    href={href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary font-medium underline break-all"
                                  >
                                    {lms.linkedinUrl.trim()}
                                  </a>
                                )
                              })()}
                            </dd>
                          </div>
                        ) : null}
                      </dl>
                    ) : null}
                  </div>
                ) : null}
              </>
            )}
          </section>

          <div className="flex justify-end pt-2 border-t">
            <Button type="button" variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
