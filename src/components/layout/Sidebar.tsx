import { Link, useLocation } from "react-router-dom"
import { cn } from "@/lib/utils"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { navLinksForRole } from "@/config/navigation"

export function Sidebar() {
  const location = useLocation()
  const activeRole = useAuth((state) => state.activeRole)

  const filteredLinks = navLinksForRole(activeRole)

  return (
    <aside className="hidden border-r bg-muted/20 md:block w-64 flex-shrink-0">
      <div className="flex h-full max-h-screen flex-col gap-2">
        <div className="flex-1 overflow-auto py-4">
          <nav className="grid items-start px-4 text-sm font-medium gap-1">
            {filteredLinks.map((link) => {
              const Icon = link.icon
              const isActive =
                location.pathname === link.href ||
                (link.href !== "/" && location.pathname.startsWith(link.href))
              return (
                <Link
                  key={link.href}
                  to={link.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all hover:bg-accent hover:text-accent-foreground",
                    isActive
                      ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {link.title}
                </Link>
              )
            })}
          </nav>
        </div>
      </div>
    </aside>
  )
}
