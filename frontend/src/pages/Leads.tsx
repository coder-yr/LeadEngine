import { LeadWorkspace } from "@/components/leads/LeadWorkspace"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

export default function Leads() {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Leads Intelligence</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage your discovered leads, website audits, and AI-driven insights.
          </p>
        </div>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Add Lead
        </Button>
      </div>

      <LeadWorkspace />
    </div>
  )
}
