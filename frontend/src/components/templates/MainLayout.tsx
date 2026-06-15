import { Outlet } from "react-router-dom"
import { Sidebar } from "../organisms/Sidebar"
import { Topbar } from "../organisms/Topbar"
import { CommandPalette } from "../layout/CommandPalette"

export function MainLayout() {
  return (
    <div className="flex h-screen w-full bg-background overflow-hidden text-foreground">
      <Sidebar />
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto bg-background p-6">
          <Outlet />
        </main>
      </div>
      <CommandPalette />
    </div>
  )
}
