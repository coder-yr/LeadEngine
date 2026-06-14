import { Lead } from "@/types/lead";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface LeadListProps {
  leads: Lead[];
  selectedLeadId: string | null;
  onSelectLead: (id: string) => void;
}

export function LeadList({ leads, selectedLeadId, onSelectLead }: LeadListProps) {
  return (
    <div className="flex flex-col h-full bg-muted/20 border-r border-border">
      <div className="p-4 border-b border-border font-semibold text-sm uppercase tracking-wider text-muted-foreground">
        Discovered Leads ({leads.length})
      </div>
      <ScrollArea className="flex-1">
        <div className="flex flex-col p-2 space-y-1">
          {leads.map((lead) => {
            const isSelected = lead.id === selectedLeadId;
            const score = lead.intelligence.leadScore;

            return (
              <button
                key={lead.id}
                onClick={() => onSelectLead(lead.id)}
                className={cn(
                  "flex flex-col items-start gap-2 p-3 text-left text-sm transition-all rounded-md border",
                  isSelected
                    ? "bg-primary/10 border-primary/20"
                    : "bg-transparent border-transparent hover:bg-muted"
                )}
              >
                <div className="flex w-full flex-col gap-1">
                  <div className="flex items-center">
                    <div className="flex items-center gap-2 font-semibold">
                      {lead.name}
                    </div>
                    <div className="ml-auto text-xs">
                      <Badge variant={score >= 80 ? "default" : score >= 50 ? "secondary" : "destructive"}>
                        {score}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground line-clamp-1">
                    {lead.company} • {lead.title}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
