import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { getUserProfile, listSchoolsBrief } from '../api/auth.api'
import {
  getActiveSchoolRoles,
  pickPrimarySchoolRole,
  type UserRoleRow,
} from '../lib/schoolRoles'

const ACTIVE_SCHOOL_STORAGE_KEY = 'edunexus_active_school_id'

/** Coalesce overlapping initialize() calls (INITIAL_SESSION + AuthGuard + login). */
let initializeMutex: Promise<void> | null = null

/** Pass `{ authSession }` from auth callbacks / sign-in response — never call `getSession()` inside `onAuthStateChange` (deadlocks). */
export type InitializeAuthArg =
  | undefined
  | { authSession: Session | null }
  /** Re-fetch profile + re-resolve school/role after DB updates (e.g. complete-profile). Bypasses hydrate short-circuit. */
  | { refreshProfile: true }

function resolveSchoolAuth(
  profile: { user_roles?: UserRoleRow[] } | null,
  platformRole: string | null,
  activeSchoolId: string | null,
) {
  const userRoles = (profile?.user_roles ?? []).filter(
    (r: UserRoleRow) => r.school_id,
  ) as UserRoleRow[]
  const schoolRoles = platformRole ? [] : getActiveSchoolRoles(userRoles, activeSchoolId)
  const primarySchoolRole = pickPrimarySchoolRole(schoolRoles)
  const activeRole = platformRole ?? primarySchoolRole
  return { schoolRoles, activeRole }
}

interface AuthState {
  session: Session | null
  user: User | null
  profile: any | null
  /** From profiles.platform_role — platform ops roles only. */
  platformRole: string | null
  activeSchoolId: string | null
  /** All active school roles for the active school (union for RBAC). */
  schoolRoles: string[]
  /** Primary role for display: platform_role ?? highest-priority school role. */
  activeRole: string | null
  isLoading: boolean
  setSession: (session: Session | null) => void
  initialize: (arg?: InitializeAuthArg) => Promise<void>
  setActiveSchool: (schoolId: string) => void
}

export const useAuth = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  platformRole: null,
  activeSchoolId: null,
  schoolRoles: [],
  activeRole: null,
  isLoading: true,
  
  setSession: (session) => set({ session, user: session?.user || null }),
  
  setActiveSchool: (schoolId: string) => {
    const profile = get().profile
    const platformRole = get().platformRole
    if (!profile) return

    try {
      localStorage.setItem(ACTIVE_SCHOOL_STORAGE_KEY, schoolId)
    } catch {
      /* ignore */
    }

    const { schoolRoles, activeRole } = resolveSchoolAuth(profile, platformRole, schoolId)

    set({
      activeSchoolId: schoolId,
      schoolRoles,
      activeRole,
    })
  },
  
  initialize: async (arg?: InitializeAuthArg) => {
    const wantsRefresh = !!arg && "refreshProfile" in arg && arg.refreshProfile

    // Second bootstrap via `getSession()` after login often hangs in supabase-js; skip if already hydrated.
    if (arg === undefined) {
      const { session, profile } = get()
      if (session?.user && profile != null) return
    }

    if (initializeMutex) {
      await initializeMutex
      if (arg === undefined) {
        const { session, profile } = get()
        if (session?.user && profile != null) return
      }
      // refreshProfile / authSession: prior run may have stale profile — run again
    }

    initializeMutex = (async () => {
      // Only show global loader if we don't already have a profile/session
      const currentProfile = get().profile
      if (!currentProfile) {
        set({ isLoading: true })
      }

      try {
        let session: Session | null = null
        if (wantsRefresh) {
          session = get().session
          if (!session?.user) {
            const { data } = await supabase.auth.getSession()
            session = data.session ?? null
          }
        } else if (arg !== undefined && "authSession" in arg) {
          session = arg.authSession ?? null
        } else {
          const { data } = await supabase.auth.getSession()
          session = data.session ?? null
        }

        if (session?.user) {
          try {
            const profile = await getUserProfile(session.user.id)
            const platformRole = profile?.platform_role ?? null

            const userRoles = (profile?.user_roles ?? []).filter(
              (r: UserRoleRow) => r.school_id,
            ) as UserRoleRow[]
            let activeSchoolId: string | null = userRoles[0]?.school_id ?? null

            if (!activeSchoolId && platformRole) {
              try {
                const schools = await listSchoolsBrief()
                activeSchoolId = schools[0]?.id ?? null
              } catch (e) {
                console.error('Could not load schools for platform user:', e)
              }
            }

            try {
              const saved = localStorage.getItem(ACTIVE_SCHOOL_STORAGE_KEY)
              if (saved) {
                const allowedFromRoles = new Set(
                  userRoles.map((r) => r.school_id!),
                )
                if (platformRole) {
                  const schools = await listSchoolsBrief().catch(() => [] as { id: string }[])
                  const allowedIds = new Set(schools.map((s) => s.id))
                  if (allowedIds.has(saved)) {
                    activeSchoolId = saved
                  }
                } else if (allowedFromRoles.has(saved)) {
                  activeSchoolId = saved
                }
              }
            } catch {
              /* ignore */
            }

            const { schoolRoles, activeRole } = resolveSchoolAuth(profile, platformRole, activeSchoolId)

            set({
              session,
              user: session.user,
              profile,
              platformRole,
              activeSchoolId,
              schoolRoles,
              activeRole,
            })
          } catch (error) {
            console.error("Failed to load user profile:", error)
            set({
              session,
              user: session.user,
              profile: null,
              platformRole: null,
              activeSchoolId: null,
              schoolRoles: [],
              activeRole: null,
            })
          }
        } else {
          set({
            session: null,
            user: null,
            profile: null,
            platformRole: null,
            activeSchoolId: null,
            schoolRoles: [],
            activeRole: null,
          })
        }
      } catch (error) {
        console.error("Auth initialization error:", error)
      } finally {
        set({ isLoading: false })
      }
    })()

    try {
      await initializeMutex
    } finally {
      initializeMutex = null
    }
  },
}))

// Setup auth listener — use `session` from the callback for bootstrap (calling `getSession()` here deadlocks).
supabase.auth.onAuthStateChange((event, session) => {
  const { setSession, initialize } = useAuth.getState()

  if (event === 'SIGNED_OUT') {
    try {
      localStorage.removeItem(ACTIVE_SCHOOL_STORAGE_KEY)
    } catch {
      /* ignore */
    }
    useAuth.setState({
      session: null,
      user: null,
      profile: null,
      platformRole: null,
      activeSchoolId: null,
      schoolRoles: [],
      activeRole: null,
      isLoading: false,
    })
    return
  }

  if (event === 'TOKEN_REFRESHED') {
    setSession(session)
    return
  }

  // Prevent deadlock: DB queries inside the listener implicitly call getSession() 
  // which blocks on the internal auth lock still held by the event emitter.
  setTimeout(() => {
    initialize({ authSession: session ?? null }).catch(console.error)
  }, 0)
})
