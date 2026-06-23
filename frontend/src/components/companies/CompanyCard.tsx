import { Company } from "@/types/company";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Building2, 
  Globe, 
  MessageCircle, 
  Database, 
  CalendarDays, 
  Share2, 
  CheckCircle2, 
  XCircle,
  Lightbulb,
  Rocket,
  ChevronRight,
  Trash2
} from "lucide-react";

interface CompanyCardProps {
  company: Company;
  onDelete?: (id: string) => void;
}

export function CompanyCard({ company, onDelete }: CompanyCardProps) {
  const { intelligence } = company;

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 50) return "text-yellow-500";
    return "text-red-500";
  };

  const getScoreProgressColor = (score: number) => {
    if (score >= 80) return "bg-green-500";
    if (score >= 50) return "bg-yellow-500";
    return "bg-red-500";
  };

  const PresenceIndicator = ({ label, present, icon: Icon }: { label: string, present: boolean, icon: any }) => (
    <div className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="w-4 h-4" />
        <span>{label}</span>
      </div>
      {present ? (
        <CheckCircle2 className="w-4 h-4 text-green-500" />
      ) : (
        <XCircle className="w-4 h-4 text-red-500" />
      )}
    </div>
  );

  return (
    <Card className="overflow-hidden border-border/50 shadow-sm hover:shadow-md transition-all duration-200 group bg-card">
      <CardContent className="p-0">
        <div className="flex flex-col lg:flex-row">
          
          {/* Column 1: Company Profile & Scores (approx 35%) */}
          <div className="p-6 flex-1 lg:max-w-[35%] lg:border-r border-border">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xl flex-shrink-0">
                {company.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold truncate" title={company.name}>{company.name}</h3>
                <a href={`https://${company.website}`} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1 mt-0.5 truncate">
                  <Globe className="w-3 h-3" />
                  {company.website}
                </a>
              </div>
            </div>
            <div className="flex gap-2 mb-6">
              <Badge variant="outline" className="bg-muted/50">
                <Building2 className="w-3 h-3 mr-1" />
                {company.industry}
              </Badge>
              {company.auditStatus === 'RUNNING' && (
                <Badge variant="secondary" className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 animate-pulse border-blue-500/20">
                  <Rocket className="w-3 h-3 mr-1 animate-spin" />
                  Auditing
                </Badge>
              )}
              {company.auditStatus === 'FAILED' && (
                <Badge variant="outline" className="text-red-500 border-red-500/30">
                  Audit Failed
                </Badge>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="font-medium">Lead Score</span>
                  <span className={`font-bold ${getScoreColor(intelligence.leadScore)}`}>{intelligence.leadScore}</span>
                </div>
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div className={`h-full ${getScoreProgressColor(intelligence.leadScore)}`} style={{ width: `${intelligence.leadScore}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="font-medium">Website Score</span>
                  <span className={`font-bold ${getScoreColor(intelligence.websiteScore)}`}>{intelligence.websiteScore}</span>
                </div>
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div className={`h-full ${getScoreProgressColor(intelligence.websiteScore)}`} style={{ width: `${intelligence.websiteScore}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Column 2: Digital Presence Matrix (approx 25%) */}
          <div className="p-6 flex-1 lg:max-w-[25%] lg:border-r border-border bg-muted/5">
            <h4 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider">Digital Presence</h4>
            <div className="space-y-1">
              <PresenceIndicator label="Social Profiles" present={intelligence.socialPresence} icon={Share2} />
              <PresenceIndicator label="WhatsApp API" present={intelligence.whatsappPresence} icon={MessageCircle} />
              <PresenceIndicator label="CRM System" present={intelligence.crmPresence} icon={Database} />
              <PresenceIndicator label="Booking Flow" present={intelligence.bookingPresence} icon={CalendarDays} />
            </div>
          </div>

          {/* Column 3: AI Insights & Services (approx 40%) */}
          <div className="p-6 flex-1 flex flex-col bg-gradient-to-br from-background to-primary/5">
            <div className="flex-1">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2 text-primary">
                <Lightbulb className="w-4 h-4 fill-primary/20" />
                AI Intelligence
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {intelligence.aiInsight}
              </p>

              <div className="mt-5">
                <h4 className="text-xs font-semibold mb-2 flex items-center gap-2 text-muted-foreground uppercase tracking-wider">
                  <Rocket className="w-3.5 h-3.5" />
                  Recommended Services
                </h4>
                <div className="flex flex-wrap gap-2">
                  {intelligence.recommendedServices.map((service, idx) => (
                    <Badge key={idx} variant="secondary" className="bg-background border-border">
                      {service}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-between items-center">
              {onDelete && (
                <Button 
                  variant="ghost" 
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1 px-3" 
                  onClick={() => onDelete(company.id)}
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Delete</span>
                </Button>
              )}
              <Button variant="ghost" className="text-primary hover:text-primary hover:bg-primary/10 gap-1 group-hover:underline ml-auto" asChild>
                <Link to={`/companies/${company.id}`}>
                  View Full Profile
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </Button>
            </div>
          </div>

        </div>
      </CardContent>
    </Card>
  );
}
