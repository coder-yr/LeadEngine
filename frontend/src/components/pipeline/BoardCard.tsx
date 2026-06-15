import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Globe, Building2, TrendingUp } from "lucide-react";

interface BoardCardProps {
  id: string;
  company: any; // Using any for now or a proper type later
}

export function BoardCard({ id, company }: BoardCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, data: { ...company } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const leadScore = company.company_intelligence?.[0]?.lead_score || 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="cursor-grab active:cursor-grabbing mb-3"
    >
      <Card className={`hover:border-primary/50 hover:shadow-md transition-all ${isDragging ? "ring-2 ring-primary ring-offset-2" : ""}`}>
        <CardContent className="p-4 flex flex-col gap-3">
          <div className="flex justify-between items-start">
            <h4 className="font-semibold text-sm leading-none">{company.name}</h4>
          </div>
          
          <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
            {company.website_url && (
              <div className="flex items-center gap-1.5">
                <Globe className="w-3 h-3" />
                <span className="truncate">{company.website_url.replace(/^https?:\/\//, '')}</span>
              </div>
            )}
            {company.industry && (
              <div className="flex items-center gap-1.5">
                <Building2 className="w-3 h-3" />
                <span className="truncate">{company.industry}</span>
              </div>
            )}
          </div>
          
          <div className="flex justify-between items-center mt-1">
            <div className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-primary" />
              <span className="text-xs font-medium">Score: {leadScore}</span>
            </div>
            
            {leadScore > 80 ? (
              <Badge variant="default" className="text-[10px] px-1.5 py-0">Hot</Badge>
            ) : leadScore > 50 ? (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Warm</Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">Cold</Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
