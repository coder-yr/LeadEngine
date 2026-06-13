import { Button } from "@/components/ui/button"
import { Target } from "lucide-react"

export default function Campaigns() {
  return (
    <div className="flex flex-col items-center justify-center h-[80vh] space-y-4">
      <div className="p-4 rounded-full bg-primary/10">
        <Target className="h-10 w-10 text-primary" />
      </div>
      <h2 className="text-2xl font-bold tracking-tight">No Active Campaigns</h2>
      <p className="text-muted-foreground text-center max-w-sm">
        You haven't launched any outreach campaigns yet. Create your first campaign to start engaging with leads.
      </p>
      <Button className="mt-4">Create Campaign</Button>
    </div>
  )
}
