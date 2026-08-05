import { Link, useLocation } from "react-router-dom"
import { cn } from "@/lib/utils"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { navLinksForRoles } from "@/config/navigation"
import { motion } from "framer-motion"

export function Sidebar() {
  const location = useLocation()
  const schoolRoles = useAuth((state) => state.schoolRoles)
  const platformRole = useAuth((state) => state.platformRole)
  const activeRole = useAuth((state) => state.activeRole)

  const filteredLinks = navLinksForRoles(schoolRoles, platformRole, activeRole)

  return (
    <aside className="hidden border-r border-border/40 bg-card/95 md:block w-64 flex-shrink-0 backdrop-blur-sm shadow-[1px_0_10px_-5px_rgba(6,81,237,0.05)] z-30">
      <div className="flex h-full max-h-screen flex-col gap-2">
        <div className="flex-1 overflow-auto py-6">
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
                    "relative group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors z-10",
                    isActive
                      ? "text-primary font-semibold"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-active"
                      className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-primary rounded-r-full"
                      transition={{ type: "spring", stiffness: 350, damping: 30 }}
                    />
                  )}
                  {!isActive && (
                    <div className="absolute inset-0 bg-accent/40 opacity-0 group-hover:opacity-100 rounded-lg -z-10 transition-opacity duration-300" />
                  )}
                  <Icon 
                    className={cn(
                      "h-4 w-4 transition-transform duration-300", 
                      isActive ? "text-primary scale-110" : "text-muted-foreground group-hover:text-primary/80 group-hover:scale-110"
                    )} 
                  />
                  <span>{link.title}</span>
                </Link>
              )
            })}
          </nav>
        </div>
      </div>
    </aside>
  )
}
