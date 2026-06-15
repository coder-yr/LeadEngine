import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Company } from "@/types/company"
import { PlayCircle, CheckCircle2 } from "lucide-react"

interface CampaignsTabProps {
  company: Company;
}

export function CampaignsTab({ company }: CampaignsTabProps) {
  const campaigns = [
    { name: "Q3 Website Revamp Outreach", status: "Active", type: "Email Sequence", engaged: true },
    { name: "Local SEO Audit Drop", status: "Completed", type: "LinkedIn", engaged: false }
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Card>
        <CardHeader>
          <CardTitle>Outreach Campaigns</CardTitle>
          <CardDescription>Historical and active marketing cadences for {company.name}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {campaigns.map((camp, i) => (
              <div key={i} className="flex items-center justify-between p-4 border rounded-lg transition-all hover:bg-accent/50">
                <div>
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    {camp.status === 'Active' ? <PlayCircle className="w-4 h-4 text-blue-500"/> : <CheckCircle2 className="w-4 h-4 text-green-500"/>}
                    {camp.name}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1">{camp.type}</p>
                </div>
                <Badge variant={camp.engaged ? "default" : "secondary"}>
                  {camp.engaged ? 'Engaged' : 'No Response'}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
