import { Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  defaultLmsTeacherProfile,
  type LmsTeacherProfile,
  type PreferredContactMethod,
} from "@/features/settings/lib/lmsTeacherProfile"

type SubjectBrief = { id: string; name: string; code?: string | null }

type Props = {
  subjects: SubjectBrief[]
  primarySubjectId: string
  value: LmsTeacherProfile
  onChange: (next: LmsTeacherProfile) => void
}

function patch(prev: LmsTeacherProfile, p: Partial<LmsTeacherProfile>): LmsTeacherProfile {
  return { ...prev, ...p }
}

export function LmsTeacherProfileFields({ subjects, primarySubjectId, value, onChange }: Props) {
  const v = value ?? defaultLmsTeacherProfile()

  const selectable = subjects.filter((s) => !primarySubjectId || s.id !== primarySubjectId)

  function toggleSecondary(id: string, checked: boolean) {
    const set = new Set(v.secondarySubjectIds)
    if (checked) set.add(id)
    else set.delete(id)
    onChange(patch(v, { secondarySubjectIds: [...set] }))
  }

  function addCertRow() {
    onChange(patch(v, { professionalCertifications: [...v.professionalCertifications, { name: "", issuer: "", year: "" }] }))
  }

  function removeCertRow(idx: number) {
    onChange(patch(v, { professionalCertifications: v.professionalCertifications.filter((_, i) => i !== idx) }))
  }

  function updateCert(idx: number, field: keyof (typeof v.professionalCertifications)[0], raw: string) {
    const next = [...v.professionalCertifications]
    next[idx] = { ...next[idx], [field]: raw }
    onChange(patch(v, { professionalCertifications: next }))
  }

  return (
    <div className="space-y-8 border-t pt-6">
      <div className="space-y-2">
        <h4 className="text-sm font-semibold">Teaching scope</h4>
        <p className="text-xs text-muted-foreground">
          Secondary subjects you can teach besides your primary specialization; used for LMS scheduling and substitutions.
        </p>
      </div>

      <div className="space-y-3">
        <span className="text-sm font-medium">Secondary subjects (optional)</span>
        <div className="max-h-40 overflow-y-auto rounded-md border p-3 space-y-2 bg-muted/20">
          {selectable.length === 0 ? (
            <p className="text-xs text-muted-foreground">Load subjects failed or catalog is empty.</p>
          ) : (
            selectable.map((s) => (
              <label key={s.id} className="flex items-start gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1 rounded border-input"
                  checked={v.secondarySubjectIds.includes(s.id)}
                  onChange={(e) => toggleSecondary(s.id, e.target.checked)}
                />
                <span>
                  <span className="font-medium">{s.name}</span>
                  {s.code ? (
                    <span className="text-muted-foreground text-xs ml-1">({s.code})</span>
                  ) : null}
                </span>
              </label>
            ))
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <label htmlFor="grade-levels-taught" className="text-sm font-medium">
            Grade levels / classes taught
          </label>
          <Input
            id="grade-levels-taught"
            value={v.gradeLevelsTaught}
            onChange={(e) => onChange(patch(v, { gradeLevelsTaught: e.target.value }))}
            placeholder="e.g. Grades 6–10, IB Year 1, Form 4"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <label htmlFor="languages-spoken" className="text-sm font-medium">
            Languages of instruction / communication
          </label>
          <Input
            id="languages-spoken"
            value={v.languagesSpoken}
            onChange={(e) => onChange(patch(v, { languagesSpoken: e.target.value }))}
            placeholder="e.g. English, Hindi, Spanish"
          />
        </div>
      </div>

      <div className="space-y-3 border-t pt-6">
        <h4 className="text-sm font-semibold">Teaching license</h4>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1 sm:col-span-3 lg:col-span-1">
            <label className="text-xs font-medium text-muted-foreground">Issuing authority</label>
            <Input
              value={v.teachingLicense.issuingAuthority}
              onChange={(e) =>
                onChange(patch(v, { teachingLicense: { ...v.teachingLicense, issuingAuthority: e.target.value } }))
              }
              placeholder="e.g. SCERT, Dept. of Education"
            />
          </div>
          <div className="space-y-1 lg:col-span-1">
            <label className="text-xs font-medium text-muted-foreground">License / registration ID</label>
            <Input
              value={v.teachingLicense.licenseNumber}
              onChange={(e) =>
                onChange(patch(v, { teachingLicense: { ...v.teachingLicense, licenseNumber: e.target.value } }))
              }
            />
          </div>
          <div className="space-y-1 lg:col-span-1">
            <label className="text-xs font-medium text-muted-foreground">Valid until</label>
            <Input
              type="date"
              value={v.teachingLicense.validUntil}
              onChange={(e) =>
                onChange(patch(v, { teachingLicense: { ...v.teachingLicense, validUntil: e.target.value } }))
              }
            />
          </div>
        </div>
      </div>

      <div className="space-y-3 border-t pt-6">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-semibold">Professional certifications</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Short courses and credentials beyond academic degrees listed above.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addCertRow}>
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </div>
        {v.professionalCertifications.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">None added.</p>
        ) : (
          <div className="space-y-3">
            {v.professionalCertifications.map((c, idx) => (
              <div key={idx} className="relative grid gap-2 sm:grid-cols-3 p-3 border rounded-lg bg-muted/30">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-semibold text-muted-foreground">Name</label>
                  <Input
                    className="h-8 text-xs"
                    value={c.name}
                    onChange={(e) => updateCert(idx, "name", e.target.value)}
                    placeholder="e.g. CBSE Accreditation"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-semibold text-muted-foreground">Issuer</label>
                  <Input
                    className="h-8 text-xs"
                    value={c.issuer}
                    onChange={(e) => updateCert(idx, "issuer", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-semibold text-muted-foreground">Year</label>
                  <Input
                    className="h-8 text-xs"
                    value={c.year}
                    onChange={(e) => updateCert(idx, "year", e.target.value)}
                    placeholder="YYYY"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-background border shadow-sm text-destructive"
                  onClick={() => removeCertRow(idx)}
                  aria-label="Remove certification row"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3 border-t pt-6">
        <h4 className="text-sm font-semibold">Availability and learner support</h4>
        <div className="space-y-2">
          <label htmlFor="office-hours" className="text-sm font-medium">
            Office hours
          </label>
          <textarea
            id="office-hours"
            className="flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={v.officeHours}
            onChange={(e) => onChange(patch(v, { officeHours: e.target.value }))}
            placeholder="e.g. Tue and Thu 3:30–4:30 pm, Room 12 or video link"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="student-support" className="text-sm font-medium">
            Guidance for students and parents
          </label>
          <textarea
            id="student-support"
            className="flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={v.studentSupportNotes}
            onChange={(e) => onChange(patch(v, { studentSupportNotes: e.target.value }))}
            placeholder="How you prefer questions (email window, LMS messages), typical response times, tutoring policy…"
          />
        </div>
        <div className="space-y-2 max-w-xs">
          <label htmlFor="preferred-contact" className="text-sm font-medium">
            Preferred contact for school business
          </label>
          <select
            id="preferred-contact"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={v.preferredContactMethod}
            onChange={(e) =>
              onChange(patch(v, { preferredContactMethod: e.target.value as PreferredContactMethod }))
            }
          >
            <option value="">No preference</option>
            <option value="email">Official school email</option>
            <option value="phone">Phone</option>
            <option value="in_app_message">In-app / LMS messaging</option>
          </select>
        </div>
      </div>

      <div className="space-y-3 border-t pt-6">
        <h4 className="text-sm font-semibold">Public profile links</h4>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <label htmlFor="site-url" className="text-sm font-medium">
              Professional website / portfolio
            </label>
            <Input
              id="site-url"
              type="url"
              inputMode="url"
              value={v.professionalWebsiteUrl}
              onChange={(e) => onChange(patch(v, { professionalWebsiteUrl: e.target.value }))}
              placeholder="https://…"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <label htmlFor="li-url" className="text-sm font-medium">
              LinkedIn
            </label>
            <Input
              id="li-url"
              type="url"
              inputMode="url"
              value={v.linkedinUrl}
              onChange={(e) => onChange(patch(v, { linkedinUrl: e.target.value }))}
              placeholder="https://linkedin.com/in/…"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
