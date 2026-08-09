import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import { 
  LayoutDashboard, 
  Building2, 
  Search, 
  BarChart3,
  ListChecks,
  FileText,
  Megaphone,
  Activity,
  Settings,
  TestTubes,
  Menu,
  X,
  Contact,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CommandPalette } from "./CommandPalette";
import { UserMenu } from "./UserMenu";
import { Button } from "@/components/ui/button";

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Discover', href: '/discovery', icon: Search },
  { name: 'Companies', href: '/companies', icon: Building2 },
  { name: 'Contacts', href: '/leads', icon: Contact },
  { name: 'Lists', href: '/leads', icon: ListChecks },
  { name: 'Analysis', href: '/pipeline', icon: BarChart3 },
  { name: 'Proposals', href: '/pipeline', icon: FileText },
  { name: 'Campaigns', href: '/campaigns', icon: Megaphone },
  { name: 'Activity', href: '/activities', icon: Activity },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

  // Match active route — use startsWith for sub-routes but exact for "/"
  const isActive = (href: string) => {
    if (href === '/') return location.pathname === '/';
    return location.pathname.startsWith(href);
  };

  const SidebarContent = () => (
    <>
      <div className="p-5 flex items-center justify-between border-b border-border/50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-lg flex items-center justify-center shadow-sm">
            <span className="font-bold text-white text-sm">L</span>
          </div>
          <span className="font-bold text-lg tracking-tight text-foreground">LeadEngine</span>
        </div>
        <Button variant="ghost" size="icon" className="md:hidden" onClick={toggleMobileMenu}>
          <X className="w-5 h-5" />
        </Button>
      </div>
      
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="grid gap-0.5 px-3">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 mt-2 px-2">
            Workspace
          </div>
          {navigation.map((item) => (
            <Link
              key={item.name}
              to={item.href}
              onClick={() => setIsMobileMenuOpen(false)}
              className={cn(
                "flex items-center gap-3 px-2.5 py-2 rounded-md text-sm font-medium transition-all duration-150",
                isActive(item.href)
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.name}
            </Link>
          ))}
          
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 mt-6 px-2">
            Tools
          </div>
          <Link
            to="/tools/audit-tester"
            onClick={() => setIsMobileMenuOpen(false)}
            className={cn(
              "flex items-center gap-3 px-2.5 py-2 rounded-md text-sm font-medium transition-all duration-150",
              location.pathname === "/tools/audit-tester"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <TestTubes className="h-4 w-4 shrink-0" />
            Audit Tester
          </Link>
        </nav>
      </div>

      <div className="p-3 border-t border-border/50 mt-auto">
        <Link
          to="/settings"
          onClick={() => setIsMobileMenuOpen(false)}
          className={cn(
            "flex items-center gap-3 px-2.5 py-2 rounded-md text-sm font-medium transition-all duration-150",
            location.pathname === "/settings"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <Settings className="h-4 w-4 shrink-0" />
          Settings
        </Link>
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-60 border-r border-border/50 bg-card flex-col z-20 shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden" onClick={toggleMobileMenu} />
      )}

      {/* Mobile Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 w-72 bg-card flex flex-col z-50 transform transition-transform duration-300 ease-in-out md:hidden border-r border-border/50 shadow-xl",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <SidebarContent />
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* Header Bar */}
        <header className="h-14 glass-header flex items-center justify-between px-4 md:px-5 z-10 shrink-0">
          <div className="flex flex-1 items-center gap-3">
            <Button variant="ghost" size="icon" className="md:hidden h-8 w-8" onClick={toggleMobileMenu}>
              <Menu className="w-4 h-4" />
            </Button>
            <div className="flex-1 max-w-sm hidden sm:block">
              <CommandPalette />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="sm:hidden">
              <CommandPalette />
            </div>
            <UserMenu />
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
