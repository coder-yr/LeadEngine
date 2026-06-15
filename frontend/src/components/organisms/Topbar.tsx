import { Search, Bell, Moon, Sun } from "lucide-react"
import { useThemeStore } from "@/store/themeStore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export function Topbar() {
  const { theme, setTheme } = useThemeStore()

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark")
  }

  return (
    <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4 sticky top-0 z-10">
      <div className="flex-1 flex items-center max-w-md relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          type="search" 
          placeholder="Search leads, companies (Ctrl+K)..." 
          className="pl-9 bg-muted/40 border-border/50 focus-visible:ring-primary/50 rounded-md h-9 shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)] transition-all hover:bg-background"
        />
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={toggleTheme} className="text-muted-foreground">
          {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>
        <Button variant="ghost" size="icon" className="text-muted-foreground relative">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive" />
        </Button>
        <div className="h-8 w-px bg-border mx-2" />
        <Avatar className="h-8 w-8 cursor-pointer border border-border">
          <AvatarImage src="https://github.com/shadcn.png" />
          <AvatarFallback>YE</AvatarFallback>
        </Avatar>
      </div>
    </header>
  )
}
