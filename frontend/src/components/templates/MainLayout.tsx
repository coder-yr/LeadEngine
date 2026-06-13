import { Outlet } from "react-router-dom"
import { Sidebar } from "../organisms/Sidebar"
import { Topbar } from "../organisms/Topbar"

export function MainLayout() {
  return (
    <div className="flex h-screen w-full bg-background overflow-hidden text-foreground">
      <Sidebar />
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto bg-muted/20 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
