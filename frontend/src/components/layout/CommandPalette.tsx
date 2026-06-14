import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  Building2,
  FileText,
  Activity,
  Target,
  Settings,
  Search,
  Sparkles,
  BarChart,
  LayoutDashboard
} from "lucide-react";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = (command: () => void) => {
    setOpen(false);
    command();
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        
        <CommandGroup heading="Views & Workspaces">
          <CommandItem onSelect={() => runCommand(() => navigate("/"))}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            <span>Dashboard</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/leads"))}>
            <Search className="mr-2 h-4 w-4" />
            <span>Leads Intelligence</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/companies"))}>
            <Building2 className="mr-2 h-4 w-4" />
            <span>Companies</span>
          </CommandItem>
        </CommandGroup>
        
        <CommandSeparator />
        
        <CommandGroup heading="Execution (Playbooks)">
          <CommandItem onSelect={() => runCommand(() => navigate("/campaigns"))}>
            <Target className="mr-2 h-4 w-4" />
            <span>Sequences & Campaigns</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/activities"))}>
            <Activity className="mr-2 h-4 w-4" />
            <span>Activity Stream</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Intelligence Tools">
          <CommandItem onSelect={() => runCommand(() => console.log('Audit'))}>
            <BarChart className="mr-2 h-4 w-4 text-blue-500" />
            <span>Run Website Audit</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => console.log('Insights'))}>
            <Sparkles className="mr-2 h-4 w-4 text-purple-500" />
            <span>Generate AI Insights</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => console.log('Proposal'))}>
            <FileText className="mr-2 h-4 w-4 text-green-500" />
            <span>Create PDF Proposal</span>
          </CommandItem>
        </CommandGroup>
        
        <CommandSeparator />

        <CommandGroup heading="System">
          <CommandItem onSelect={() => runCommand(() => navigate("/settings"))}>
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
            <CommandShortcut>⌘S</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
