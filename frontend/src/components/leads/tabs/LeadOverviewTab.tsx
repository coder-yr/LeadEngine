import { Lead } from "@/types/lead";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Building2, Mail, Phone, ExternalLink } from "lucide-react";

interface LeadOverviewTabProps {
  lead: Lead;
}

export function LeadOverviewTab({ lead }: LeadOverviewTabProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Company Details</CardTitle>
            <CardDescription>Primary information regarding the prospect's company.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 text-sm">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">{lead.company}</span>
            </div>
            {lead.audit?.url && (
              <div className="flex items-center gap-3 text-sm">
                <ExternalLink className="w-4 h-4 text-muted-foreground" />
                <a href={lead.audit.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                  {lead.audit.url}
                </a>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
            <CardDescription>Decision maker contact details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 text-sm">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                {lead.name.charAt(0)}
              </div>
              <div>
                <p className="font-medium">{lead.name}</p>
                <p className="text-muted-foreground text-xs">{lead.title}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm mt-4">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <a href={`mailto:${lead.email}`} className="text-primary hover:underline">
                {lead.email}
              </a>
            </div>
            {lead.phone && (
              <div className="flex items-center gap-3 text-sm">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span>{lead.phone}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Intelligence Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {lead.intelligence.aiInsights}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
