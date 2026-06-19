import { Link, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  Building2, 
  Search, 
  Target, 
  KanbanSquare, 
  ListTodo,
  Settings,
  Activity
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CommandPalette } from "./CommandPalette";

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Discovery', href: '/discovery', icon: Search },
  { name: 'Companies', href: '/companies', icon: Building2 },
  { name: 'Leads', href: '/leads', icon: Target },
  { name: 'Pipeline', href: '/pipeline', icon: KanbanSquare },
  { name: 'Campaigns', href: '/campaigns', icon: Activity },
  { name: 'Tasks', href: '/tasks', icon: ListTodo },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card flex flex-col">
        <div className="p-6 flex items-center gap-2 border-b">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="font-bold text-primary-foreground text-xl">L</span>
          </div>
          <span className="font-bold text-xl tracking-tight">LeadEngine</span>
        </div>
        
        <div className="flex-1 overflow-y-auto py-4">
          <nav className="grid gap-1 px-4">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                    isActive 
                      ? "bg-primary text-primary-foreground shadow-sm" 
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t mt-auto">
          <Link
            to="/settings"
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
              location.pathname === "/settings"
                ? "bg-primary text-primary-foreground shadow-sm" 
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* Header Bar */}
        <header className="h-16 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center justify-between px-6 z-10 shrink-0">
          <div className="flex-1 flex items-center">
            <CommandPalette />
          </div>
          <div className="flex items-center gap-4">
            {/* User Profile Mock */}
            <div className="w-8 h-8 rounded-full bg-muted border border-border flex items-center justify-center text-sm font-medium">
              Y
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-6 relative">
          {children}
        </div>
      </main>
    </div>
  );
}
