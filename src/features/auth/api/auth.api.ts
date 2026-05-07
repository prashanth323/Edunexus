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
  const { data, error } = await supabase.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.password,
  })

  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
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
