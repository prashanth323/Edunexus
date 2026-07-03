import { supabase } from "@/lib/supabase"
import { z } from "zod"

export const loginSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
})

export type LoginCredentials = z.infer<typeof loginSchema>

export const setPasswordSchema = z
  .object({
    newPassword: z.string().min(6, { message: "Password must be at least 6 characters" }),
    confirmPassword: z.string().min(1, { message: "Confirm your password" }),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })

export type SetPasswordFormValues = z.infer<typeof setPasswordSchema>

/** Sets or updates the signed-in user's password (email/password provider). Requires an active session. */
export async function updateAccountPassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
}

export async function loginWithEmail(credentials: LoginCredentials) {
  const email = credentials.email.trim().toLowerCase()
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: credentials.password,
  })

  if (error) throw new Error(mapLoginErrorMessage(error.message))
  return data
}

export function mapLoginErrorMessage(message: string): string {
  const lower = message.toLowerCase()
  if (lower.includes("invalid login credentials")) {
    return (
      "Email or password is incorrect. If you were invited by your school, open the invitation email " +
      "and use the link to set your password first — you cannot sign in here until that is done. " +
      "Use Forgot password below if you already set a password."
    )
  }
  if (lower.includes("email not confirmed")) {
    return "Please confirm your email using the link we sent before signing in."
  }
  return message
}

export async function requestPasswordReset(email: string): Promise<void> {
  const redirectTo = `${window.location.origin}/auth/set-password`
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo,
  })
  if (error) throw error
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

/** Profile picture for the portal header (`profiles.avatar_url`). Path: `{schoolId}/profiles/{profileId}/avatar.{ext}` */
export async function uploadMyProfileAvatar(schoolId: string, profileId: string, file: File) {
  const ext = file.name.split(".").pop() ?? "jpg"
  const path = `${schoolId}/profiles/${profileId}/avatar.${ext}`

  const { error: uploadError } = await supabase.storage
    .from("student-documents")
    .upload(path, file, { upsert: true, contentType: file.type })
  if (uploadError) throw uploadError

  const { data: urlData } = supabase.storage.from("student-documents").getPublicUrl(path)
  const avatarUrl = urlData.publicUrl

  const { error } = await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("id", profileId)
  if (error) throw error

  return avatarUrl
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session
}

export async function getUserProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      *,
      user_roles!user_roles_user_id_fkey (
        role,
        school_id,
        is_active,
        schools (name, logo_url)
      )
    `)
    .eq('id', userId)
    .single()

  if (error) throw error
  return data
}

export type SchoolBrief = { id: string; name: string }

/** Schools visible under RLS (platform admins see all; school users see their school). */
export async function listSchoolsBrief(): Promise<SchoolBrief[]> {
  const { data, error } = await supabase
    .from('schools')
    .select('id, name')
    .is('deleted_at', null)
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) throw error
  return (data ?? []) as SchoolBrief[]
}
