import { Activity } from "lucide-react"

export default function Activities() {
  return (
    <div className="flex flex-col items-center justify-center h-[80vh] space-y-4">
      <div className="p-4 rounded-full bg-primary/10">
        <Activity className="h-10 w-10 text-primary" />
      </div>
      <h2 className="text-2xl font-bold tracking-tight">No Recent Activity</h2>
      <p className="text-muted-foreground text-center max-w-sm">
        Once your team starts engaging with leads, your feed will appear here.
      </p>
    </div>
  )
}
