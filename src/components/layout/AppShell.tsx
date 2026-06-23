import { useEffect, useMemo } from "react"
import { Outlet, useLocation, useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { Moon, Sun, GraduationCap, LogOut, User as UserIcon, Building2, Menu } from "lucide-react"
import { toast } from "sonner"

import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

import { Sidebar } from "./Sidebar"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { listSchoolsBrief, signOut, type SchoolBrief } from "@/features/auth/api/auth.api"
import { needsProfileOnboarding } from "@/features/auth/lib/onboarding"
import { navLinksForRole } from "@/config/navigation"
import { cn } from "@/lib/utils"
import { useStudentDocumentsDisplayUrl } from "@/features/students/hooks/useStudentDocumentsDisplayUrl"

type SchoolOption = { id: string; name: string }

export function AppShell() {
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const { profile, user, activeRole, platformRole, activeSchoolId, setActiveSchool } = useAuth()

  const needsOnboarding = needsProfileOnboarding({
    platformRole,
    activeRole,
    profile,
  })

  useEffect(() => {
    if (needsOnboarding && location.pathname !== "/complete-profile") {
      navigate("/complete-profile", { replace: true })
    }
  }, [needsOnboarding, location.pathname, navigate])

  const { data: platformSchools } = useQuery({
    queryKey: ["schools-brief"],
    queryFn: listSchoolsBrief,
    enabled: !!platformRole,
  })

  const schoolOptions = useMemo((): SchoolOption[] => {
    if (platformRole && platformSchools?.length) {
      return platformSchools.map((s: SchoolBrief) => ({ id: s.id, name: s.name }))
    }
    const rows = profile?.user_roles?.filter((r: { school_id: string | null }) => r.school_id) ?? []
    if (rows.length <= 1) return []
    return rows.map((r: { school_id: string; schools?: { name?: string } }) => ({
      id: r.school_id,
      name: r.schools?.name ?? "School",
    }))
  }, [platformRole, platformSchools, profile?.user_roles])

  const activeSchoolLabel = useMemo(() => {
    if (!activeSchoolId) return null
    const fromRoles = profile?.user_roles?.find(
      (r: { school_id: string }) => r.school_id === activeSchoolId,
    )?.schools?.name
    if (fromRoles) return fromRoles as string
    return platformSchools?.find((s) => s.id === activeSchoolId)?.name ?? "School"
  }, [activeSchoolId, profile?.user_roles, platformSchools])

  const handleSignOut = async () => {
    try {
      await signOut()
      navigate("/login")
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to sign out"
      toast.error(message)
    }
  }

  const displayRole = activeRole
    ? activeRole
        .split("_")
        .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
    : "User"

  const initials =
    profile?.first_name && profile?.last_name
      ? `${profile.first_name[0]}${profile.last_name[0]}`
      : user?.email?.substring(0, 2).toUpperCase() || "U"

  const showSchoolSwitcher = !!activeRole && activeRole !== "super_admin" && schoolOptions.length > 1

  const mobileNavLinks = navLinksForRole(activeRole)

  const headerAvatarUrl = useStudentDocumentsDisplayUrl(profile?.avatar_url)

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between px-4 md:px-8 max-w-full gap-2">
          <div className="flex items-center gap-2 font-bold text-primary min-w-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="md:hidden shrink-0" aria-label="Open navigation menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>Navigate</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {mobileNavLinks.map((link) => {
                  const Icon = link.icon
                  return (
                    <DropdownMenuItem
                      key={link.href}
                      className="cursor-pointer gap-2"
                      onClick={() => navigate(link.href)}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {link.title}
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>
            <GraduationCap className="h-6 w-6 shrink-0" />
            <span className="text-xl hidden md:inline-block">EduNexus</span>
          </div>

          <div className="flex items-center gap-2 md:gap-4 min-w-0 justify-end">
            {showSchoolSwitcher && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 max-w-[200px] lg:max-w-none">
                    <Building2 className="h-4 w-4 shrink-0" />
                    <span className="truncate hidden sm:inline">{activeSchoolLabel ?? "School"}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>School</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {schoolOptions.map((s: SchoolOption) => (
                    <DropdownMenuItem
                      key={s.id}
                      className="cursor-pointer"
                      onClick={() => setActiveSchool(s.id)}
                    >
                      {s.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {!showSchoolSwitcher &&
              activeSchoolLabel &&
              activeRole !== "super_admin" && (
                <span className="text-xs text-muted-foreground truncate max-w-[140px] hidden lg:inline py-0.5">
                  {activeSchoolLabel}
                </span>
              )}

            <div className="hidden md:flex flex-col items-end mr-2 min-w-0">
              <span className="text-sm font-medium leading-tight truncate max-w-[200px] py-0.5">
                {profile?.first_name} {profile?.last_name}
              </span>
              <span className="text-xs text-muted-foreground">{displayRole}</span>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full shrink-0">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={headerAvatarUrl ?? ""} alt="Avatar" />
                    <AvatarFallback className="bg-primary/10 text-primary">{initials}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-tight">
                      {profile?.first_name} {profile?.last_name}
                    </p>
                    <p className="text-xs leading-tight text-muted-foreground">{user?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-pointer" onClick={() => navigate("/settings")}>
                  <UserIcon className="mr-2 h-4 w-4" />
                  <span>Profile Settings</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => setTheme(theme === "light" ? "dark" : "light")}
                >
                  {theme === "light" ? (
                    <Moon className="mr-2 h-4 w-4" />
                  ) : (
                    <Sun className="mr-2 h-4 w-4" />
                  )}
                  <span>Toggle Theme</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer text-destructive focus:text-destructive"
                  onClick={handleSignOut}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main
          className={cn(
            "flex-1 overflow-y-auto p-4 md:p-8",
            activeRole === "student" && "student-surface bg-background text-foreground",
          )}
        >
          <Outlet />
        </main>
      </div>
    </div>
  )
}
