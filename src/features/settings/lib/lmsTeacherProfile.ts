export type TeachingLicense = {
  issuingAuthority: string
  licenseNumber: string
  validUntil: string
}

export type ProfessionalCertification = {
  name: string
  issuer: string
  year: string
}

export type PreferredContactMethod = "email" | "phone" | "in_app_message" | ""

export type SecondarySubjectRef = {
  id: string
  name: string
}

export type LmsTeacherProfile = {
  secondarySubjectIds: string[]
  /** Cached labels from last save — shown in Staff directory without reloading subject catalog */
  secondarySubjectRefs?: SecondarySubjectRef[]
  languagesSpoken: string
  gradeLevelsTaught: string
  officeHours: string
  studentSupportNotes: string
  teachingLicense: TeachingLicense
  professionalCertifications: ProfessionalCertification[]
  professionalWebsiteUrl: string
  linkedinUrl: string
  preferredContactMethod: PreferredContactMethod
}

export function defaultLmsTeacherProfile(): LmsTeacherProfile {
  return {
    secondarySubjectIds: [],
    languagesSpoken: "",
    gradeLevelsTaught: "",
    officeHours: "",
    studentSupportNotes: "",
    teachingLicense: { issuingAuthority: "", licenseNumber: "", validUntil: "" },
    professionalCertifications: [],
    professionalWebsiteUrl: "",
    linkedinUrl: "",
    preferredContactMethod: "",
  }
}

function normalizeSecondaryRefs(raw: unknown): SecondarySubjectRef[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: SecondarySubjectRef[] = []
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue
    const r = item as Record<string, unknown>
    const id = typeof r.id === "string" ? r.id : ""
    const name = typeof r.name === "string" ? r.name : ""
    if (!id) continue
    out.push({ id, name: name || id })
  }
  return out.length ? out : undefined
}

/** Accepts loosely-shaped JSON from the database or API. */
export function normalizeLmsTeacherProfile(raw: unknown): LmsTeacherProfile {
  const base = defaultLmsTeacherProfile()
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base
  const o = raw as Record<string, unknown>

  const sec = o.secondarySubjectIds
  const secondarySubjectIds = Array.isArray(sec)
    ? sec.filter((x): x is string => typeof x === "string" && x.length > 0)
    : []

  const lic = o.teachingLicense
  let teachingLicense = { ...base.teachingLicense }
  if (lic && typeof lic === "object" && !Array.isArray(lic)) {
    const L = lic as Record<string, unknown>
    teachingLicense = {
      issuingAuthority: typeof L.issuingAuthority === "string" ? L.issuingAuthority : "",
      licenseNumber: typeof L.licenseNumber === "string" ? L.licenseNumber : "",
      validUntil: typeof L.validUntil === "string" ? L.validUntil : "",
    }
  }

  const certsRaw = o.professionalCertifications
  const professionalCertifications: ProfessionalCertification[] = Array.isArray(certsRaw)
    ? certsRaw.map((row) => {
        if (!row || typeof row !== "object" || Array.isArray(row)) {
          return { name: "", issuer: "", year: "" }
        }
        const r = row as Record<string, unknown>
        return {
          name: typeof r.name === "string" ? r.name : "",
          issuer: typeof r.issuer === "string" ? r.issuer : "",
          year: typeof r.year === "string" ? r.year : "",
        }
      })
    : []

  const pcm = o.preferredContactMethod
  const preferredContactMethod: PreferredContactMethod =
    pcm === "email" || pcm === "phone" || pcm === "in_app_message" || pcm === "" ? pcm : ""

  return {
    secondarySubjectIds,
    secondarySubjectRefs: normalizeSecondaryRefs(o.secondarySubjectRefs),
    languagesSpoken: typeof o.languagesSpoken === "string" ? o.languagesSpoken : "",
    gradeLevelsTaught: typeof o.gradeLevelsTaught === "string" ? o.gradeLevelsTaught : "",
    officeHours: typeof o.officeHours === "string" ? o.officeHours : "",
    studentSupportNotes: typeof o.studentSupportNotes === "string" ? o.studentSupportNotes : "",
    teachingLicense,
    professionalCertifications,
    professionalWebsiteUrl:
      typeof o.professionalWebsiteUrl === "string" ? o.professionalWebsiteUrl : "",
    linkedinUrl: typeof o.linkedinUrl === "string" ? o.linkedinUrl : "",
    preferredContactMethod,
  }
}
