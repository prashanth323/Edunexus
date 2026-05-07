import { z } from "zod"
import { supabase } from "@/lib/supabase"
import type { SchoolRow } from "@/features/dashboard/api/platform.api"

export const SCHOOL_SETTINGS_ROLES = new Set([
  "principal",
  "school_admin",
  "vice_principal",
])

export function canEditSchoolSettings(role: string | null | undefined): boolean {
  return !!role && SCHOOL_SETTINGS_ROLES.has(role)
}

function emptyToNullUrl(s: string): string | null {
  const t = s.trim()
  return t === "" ? null : t
}

export const schoolSettingsFormSchema = z
  .object({
    name: z.string().min(1, "School name is required").max(200),
    code: z.string().max(40).optional(),
    logo_url: z.string().max(2048),
    cover_url: z.string().max(2048),
    contact_email: z.string().max(320),
    contact_phone: z.string().max(40).optional(),
    board: z.string().max(120).optional(),
    established_year: z.preprocess(
      (val) => (val === "" || val === undefined || val === null ? "" : val),
      z.union([z.literal(""), z.coerce.number().int().min(1800).max(2100)]),
    ),
    affiliation_no: z.string().max(120).optional(),
    timezone: z.string().min(1).max(80),
    currency: z.string().min(1).max(10),
    academic_start_month: z.coerce.number().int().min(1).max(12),
    address_street: z.string().max(200).optional(),
    address_city: z.string().max(120).optional(),
    address_state: z.string().max(120).optional(),
    address_zip: z.string().max(40).optional(),
    address_country: z.string().max(120).optional(),
  })
  .superRefine((data, ctx) => {
    const logo = emptyToNullUrl(data.logo_url)
    if (logo && !/^https?:\/\//i.test(logo)) {
      ctx.addIssue({ code: "custom", message: "Must be a valid http(s) URL", path: ["logo_url"] })
    }
    const cover = emptyToNullUrl(data.cover_url)
    if (cover && !/^https?:\/\//i.test(cover)) {
      ctx.addIssue({ code: "custom", message: "Must be a valid http(s) URL", path: ["cover_url"] })
    }
    const em = data.contact_email.trim()
    if (em !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      ctx.addIssue({ code: "custom", message: "Invalid email", path: ["contact_email"] })
    }
  })

export type SchoolSettingsFormValues = z.infer<typeof schoolSettingsFormSchema>

function optionalTrim(s: string | undefined): string | null {
  const t = s?.trim()
  return t ? t : null
}

export async function fetchSchoolForSettings(schoolId: string): Promise<SchoolRow> {
  const { data, error } = await supabase
    .from("schools")
    .select("*")
    .eq("id", schoolId)
    .is("deleted_at", null)
    .single()

  if (error) throw error
  return data as SchoolRow
}

export function schoolRowToFormValues(row: SchoolRow): SchoolSettingsFormValues {
  const addr =
    row.address && typeof row.address === "object" && !Array.isArray(row.address)
      ? (row.address as Record<string, unknown>)
      : {}

  const ey = row.established_year
  return {
    name: row.name ?? "",
    code: row.code ?? "",
    logo_url: row.logo_url ?? "",
    cover_url: row.cover_url ?? "",
    contact_email: row.contact_email ?? "",
    contact_phone: row.contact_phone ?? "",
    board: row.board ?? "",
    established_year: ey == null ? "" : ey,
    affiliation_no: row.affiliation_no ?? "",
    timezone: row.timezone ?? "Asia/Kolkata",
    currency: row.currency ?? "INR",
    academic_start_month: row.academic_start_month ?? 6,
    address_street: String(addr.street ?? ""),
    address_city: String(addr.city ?? ""),
    address_state: String(addr.state ?? ""),
    address_zip: String(addr.zip ?? ""),
    address_country: String(addr.country ?? ""),
  }
}

export async function updateSchoolFromSettingsForm(
  schoolId: string,
  values: SchoolSettingsFormValues,
): Promise<void> {
  const address = {
    street: optionalTrim(values.address_street),
    city: optionalTrim(values.address_city),
    state: optionalTrim(values.address_state),
    zip: optionalTrim(values.address_zip),
    country: optionalTrim(values.address_country),
  }

  const hasAddr = Object.values(address).some(Boolean)

  const payload = {
    name: values.name.trim(),
    code: optionalTrim(values.code ?? undefined),
    logo_url: emptyToNullUrl(values.logo_url),
    cover_url: emptyToNullUrl(values.cover_url),
    contact_email: optionalTrim(values.contact_email ?? undefined),
    contact_phone: optionalTrim(values.contact_phone ?? undefined),
    board: optionalTrim(values.board ?? undefined),
    established_year: values.established_year === "" ? null : values.established_year,
    affiliation_no: optionalTrim(values.affiliation_no ?? undefined),
    timezone: values.timezone.trim(),
    currency: values.currency.trim(),
    academic_start_month: values.academic_start_month,
    address: hasAddr ? address : null,
  }

  const { error } = await supabase.from("schools").update(payload).eq("id", schoolId)

  if (error) throw error
}

const BRANDING_BUCKET = "school-branding"

export async function uploadSchoolBrandingImage(schoolId: string, file: File, prefix: "logo" | "cover"): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase()
  const safeExt =
    ext && ["jpg", "jpeg", "png", "webp", "svg"].includes(ext) ? ext : file.type.includes("svg") ? "svg" : "png"

  const path = `${schoolId}/${prefix}-${Date.now()}.${safeExt}`
  const { error } = await supabase.storage.from(BRANDING_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  })

  if (error) throw error

  const { data } = supabase.storage.from(BRANDING_BUCKET).getPublicUrl(path)
  return data.publicUrl
}
