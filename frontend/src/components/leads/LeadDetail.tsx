import { Lead } from "@/types/lead";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mail, Phone, ExternalLink, RefreshCw, X } from "lucide-react";

import { LeadOverviewTab } from "./tabs/LeadOverviewTab";
import { WebsiteAuditTab } from "./tabs/WebsiteAuditTab";
import { AIInsightsTab } from "./tabs/AIInsightsTab";
import { ActivityTimelineTab } from "./tabs/ActivityTimelineTab";

interface LeadDetailProps {
  lead: Lead | null;
  onClose?: () => void;
}

export function LeadDetail({ lead, onClose }: LeadDetailProps) {
  if (!lead) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground bg-muted/5">
        <div className="text-center space-y-2">
          <h3 className="text-lg font-medium text-foreground">No Lead Selected</h3>
          <p className="text-sm">Select a lead from the list to view intelligence details.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* Header Area */}
      <div className="px-6 py-6 border-b border-border flex-shrink-0">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-2xl font-bold">
              {lead.company.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-2xl font-bold tracking-tight">{lead.company}</h2>
                <Badge variant={lead.status === 'Qualified' ? 'default' : 'outline'}>
                  {lead.status}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                {lead.name} • {lead.title}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Re-Audit
            </Button>
            <Button size="sm" className="gap-2">
              <Mail className="w-4 h-4" />
              Send Pitch
            </Button>
            {onClose && (
              <Button variant="ghost" size="icon" onClick={onClose} className="ml-2">
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
        
        {/* Quick action strip */}
        <div className="flex items-center gap-4 mt-6 text-sm text-muted-foreground">
          {lead.audit?.url && (
            <a href={lead.audit.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-primary transition-colors">
              <ExternalLink className="w-4 h-4" />
              Website
            </a>
          )}
          {lead.email && (
            <a href={`mailto:${lead.email}`} className="flex items-center gap-1.5 hover:text-primary transition-colors">
              <Mail className="w-4 h-4" />
              Email
            </a>
          )}
          {lead.phone && (
            <span className="flex items-center gap-1.5">
              <Phone className="w-4 h-4" />
              {lead.phone}
            </span>
          )}
        </div>
      </div>

      {/* Tabs Content Area */}
      <ScrollArea className="flex-1">
        <div className="p-6">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="mb-6 grid w-full grid-cols-4 max-w-2xl bg-muted/50 border">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="audit">Website Audit</TabsTrigger>
              <TabsTrigger value="insights">AI Insights</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="animate-in fade-in-50 duration-300">
              <LeadOverviewTab lead={lead} />
            </TabsContent>
            
            <TabsContent value="audit" className="animate-in fade-in-50 duration-300">
              <WebsiteAuditTab audit={lead.audit} />
            </TabsContent>
            
            <TabsContent value="insights" className="animate-in fade-in-50 duration-300">
              <AIInsightsTab intelligence={lead.intelligence} />
            </TabsContent>
            
            <TabsContent value="activity" className="animate-in fade-in-50 duration-300">
              <ActivityTimelineTab activities={lead.activities} />
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>
    </div>
  );
}
