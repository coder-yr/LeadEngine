import { Link, useLocation } from "react-router-dom"
import { cn } from "@/lib/utils"
import { useThemeStore } from "@/store/themeStore"
import { 
  LayoutDashboard, 
  Users, 
  Building2, 
  Target, 
  Activity, 
  Settings,
  ChevronLeft
} from "lucide-react"

const navItems = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Leads", href: "/leads", icon: Users },
  { name: "Companies", href: "/companies", icon: Building2 },
  { name: "Campaigns", href: "/campaigns", icon: Target },
  { name: "Activities", href: "/activities", icon: Activity },
]

export function Sidebar() {
  const { sidebarOpen, toggleSidebar } = useThemeStore()
  const location = useLocation()

  return (
    <div
      className={cn(
        "relative flex flex-col border-r border-border bg-card transition-all duration-300",
        sidebarOpen ? "w-64" : "w-16"
      )}
    >
      {/* Brand */}
      <div className="flex h-14 items-center justify-between px-4 border-b border-border">
        {sidebarOpen && <span className="font-bold text-lg text-primary truncate">LeadEngine</span>}
        {!sidebarOpen && <div className="w-8 h-8 rounded bg-primary text-primary-foreground flex items-center justify-center font-bold mx-auto">LE</div>}
      </div>

      {/* Toggle Button */}
      <button 
        onClick={toggleSidebar}
        className="absolute -right-3 top-16 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background shadow-sm hover:bg-accent transition-transform"
      >
        <ChevronLeft className={cn("h-4 w-4 transition-transform", !sidebarOpen && "rotate-180")} />
      </button>

      {/* Nav Links */}
      <div className="flex-1 overflow-y-auto py-4 flex flex-col gap-1 px-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href || (item.href !== "/" && location.pathname.startsWith(item.href))
          return (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive 
                  ? "bg-primary/10 text-primary" 
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                !sidebarOpen && "justify-center px-0"
              )}
              title={!sidebarOpen ? item.name : undefined}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {sidebarOpen && <span>{item.name}</span>}
            </Link>
          )
        })}
      </div>

      {/* Bottom Settings */}
      <div className="p-2 border-t border-border">
        <Link
          to="/settings"
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            location.pathname.startsWith("/settings") 
              ? "bg-primary/10 text-primary" 
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            !sidebarOpen && "justify-center px-0"
          )}
          title={!sidebarOpen ? "Settings" : undefined}
        >
          <Settings className="h-5 w-5 shrink-0" />
          {sidebarOpen && <span>Settings</span>}
        </Link>
      </div>
    </div>
  )
}
