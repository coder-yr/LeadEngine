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
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
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

  const isActive = (href: string) => {
    if (href === '/dashboard') return location.pathname === '/dashboard';
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
        <nav className="grid gap-1 px-3">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 mt-2 px-3">
            Workspace
          </div>
          {navigation.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-300",
                  active
                    ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/20"
                    : "text-slate-600 hover:bg-indigo-50 hover:text-indigo-700"
                )}
              >
                <item.icon className={cn("h-4 w-4 shrink-0 transition-transform duration-300", active ? "text-white" : "text-slate-400")} />
                {item.name}
              </Link>
            );
          })}
          
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 mt-6 px-3">
            Tools
          </div>
          <Link
            to="/tools/audit-tester"
            onClick={() => setIsMobileMenuOpen(false)}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-300",
              location.pathname === "/tools/audit-tester"
                ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/20"
                : "text-slate-600 hover:bg-indigo-50 hover:text-indigo-700"
            )}
          >
            <TestTubes className={cn("h-4 w-4 shrink-0", location.pathname === "/tools/audit-tester" ? "text-white" : "text-slate-400")} />
            Audit Tester
          </Link>
        </nav>
      </div>

      <div className="p-4 border-t border-slate-200/50 mt-auto bg-slate-50/30">
        <Link
          to="/settings"
          onClick={() => setIsMobileMenuOpen(false)}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-300",
            location.pathname === "/settings"
              ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/20"
              : "text-slate-600 hover:bg-indigo-50 hover:text-indigo-700"
          )}
        >
          <Settings className={cn("h-4 w-4 shrink-0", location.pathname === "/settings" ? "text-white" : "text-slate-400")} />
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
