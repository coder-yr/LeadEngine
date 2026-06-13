import { Settings as SettingsIcon } from "lucide-react"

export default function Settings() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your account and workspace preferences.</p>
      </div>

      <div className="flex flex-col items-center justify-center h-[50vh] space-y-4 border border-border rounded-lg bg-card mt-8">
        <div className="p-4 rounded-full bg-primary/10">
          <SettingsIcon className="h-10 w-10 text-primary" />
        </div>
        <h2 className="text-xl font-semibold">Preferences</h2>
        <p className="text-muted-foreground text-center max-w-sm">
          Settings panels will be implemented in future phases.
        </p>
      </div>
    </div>
  )
}
