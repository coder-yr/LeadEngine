import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import { 
  LayoutDashboard, 
  Building2, 
  Search, 
  Target, 
  KanbanSquare, 
  ListTodo,
  Settings,
  Activity,
  TestTubes,
  Menu,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CommandPalette } from "./CommandPalette";
import { Button } from "@/components/ui/button";

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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

  const SidebarContent = () => (
    <>
      <div className="p-6 flex items-center justify-between border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center premium-shadow">
            <span className="font-bold text-primary-foreground text-lg">L</span>
          </div>
          <span className="font-bold text-xl tracking-tight text-foreground">LeadEngine</span>
        </div>
        <Button variant="ghost" size="icon" className="md:hidden" onClick={toggleMobileMenu}>
          <X className="w-5 h-5" />
        </Button>
      </div>
      
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="grid gap-1 px-4">
          <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 mt-2 px-3">
            Core
          </div>
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200",
                  isActive 
                    ? "bg-primary text-primary-foreground premium-shadow" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            );
          })}
          
          <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 mt-8 px-3">
            Tools
          </div>
          <Link
            to="/tools/audit-tester"
            onClick={() => setIsMobileMenuOpen(false)}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200",
              location.pathname === "/tools/audit-tester" 
                ? "bg-primary text-primary-foreground premium-shadow" 
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <TestTubes className="h-4 w-4" />
            Audit Tester
          </Link>
        </nav>
      </div>

      <div className="p-4 border-t border-border/50 mt-auto">
        <Link
          to="/settings"
          onClick={() => setIsMobileMenuOpen(false)}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200",
            location.pathname === "/settings"
              ? "bg-primary text-primary-foreground premium-shadow" 
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <Settings className="h-4 w-4" />
          Settings
        </Link>
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 border-r border-border/50 bg-card flex-col z-20">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden" onClick={toggleMobileMenu} />
      )}

      {/* Mobile Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 w-72 bg-card flex flex-col z-50 transform transition-transform duration-300 ease-in-out md:hidden border-r border-border/50 premium-shadow",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <SidebarContent />
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* Header Bar */}
        <header className="h-16 glass-header flex items-center justify-between px-4 md:px-6 z-10 shrink-0">
          <div className="flex flex-1 items-center gap-4">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={toggleMobileMenu}>
              <Menu className="w-5 h-5" />
            </Button>
            <div className="flex-1 max-w-xl hidden sm:block">
              <CommandPalette />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="sm:hidden">
               <CommandPalette />
            </div>
            {/* User Profile Mock */}
            <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-sm font-medium text-primary">
              Y
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 relative bg-background/50">
          {children}
        </div>
      </main>
    </div>
  );
}
