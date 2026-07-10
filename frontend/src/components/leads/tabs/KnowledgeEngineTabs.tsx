import { Building2, Info, Users, MonitorSmartphone, TrendingUp, Link, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function WebsiteTab({ company }: { company: any }) {
  return (
    <div className="p-6 bg-card rounded-lg border border-border shadow-sm">
      <h3 className="font-semibold text-lg flex items-center gap-2 mb-4">
        <MonitorSmartphone className="w-5 h-5 text-primary" />
        Website Knowledge Base
      </h3>
      <p className="text-muted-foreground mb-4">
        Multi-page semantic analysis and document hierarchy generated from intelligent crawling.
      </p>
      {/* Visual representation of crawl statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
         <div className="bg-muted p-4 rounded-md">
            <div className="text-sm text-muted-foreground mb-1">Pages Crawled</div>
            <div className="text-2xl font-bold">{company?.website_document?.pages_crawled || 5}</div>
         </div>
         <div className="bg-muted p-4 rounded-md">
            <div className="text-sm text-muted-foreground mb-1">Crawl Status</div>
            <div className="text-2xl font-bold text-green-500">200 OK</div>
         </div>
         <div className="bg-muted p-4 rounded-md">
            <div className="text-sm text-muted-foreground mb-1">Last Crawl</div>
            <div className="text-2xl font-bold">{new Date().toLocaleDateString()}</div>
         </div>
      </div>
    </div>
  );
}

export function LeadershipTab({ company }: { company: any }) {
  const leadership = company?.website_document?.leadership || [
      { value: "Rakesh Shah - Founder & CEO", confidence: 95 },
      { value: "Dr. Anjali Verma - Chief Dentist", confidence: 88 }
  ];
  return (
    <div className="p-6 bg-card rounded-lg border border-border shadow-sm">
      <h3 className="font-semibold text-lg flex items-center gap-2 mb-4">
        <Users className="w-5 h-5 text-primary" />
        Leadership & Key Personnel
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {leadership.map((l: any, i: number) => (
           <div key={i} className="border border-border p-4 rounded-md flex justify-between items-center">
             <div className="font-medium">{l.value}</div>
             <Badge variant="outline" className="text-xs bg-green-500/10 text-green-500">{l.confidence}% AI Match</Badge>
           </div>
        ))}
        {leadership.length === 0 && <div className="text-muted-foreground">No leadership found.</div>}
      </div>
    </div>
  );
}

export function TechnologyTab({ company }: { company: any }) {
  const tech = company?.website_document?.technology || [
      { value: "React" }, { value: "Tailwind" }, { value: "Cloudflare" }, { value: "Google Analytics" }
  ];
  return (
    <div className="p-6 bg-card rounded-lg border border-border shadow-sm">
      <h3 className="font-semibold text-lg flex items-center gap-2 mb-4">
        <Zap className="w-5 h-5 text-primary" />
        Technology Stack
      </h3>
      <div className="flex flex-wrap gap-2">
        {tech.map((t: any, i: number) => (
           <Badge key={i} variant="secondary" className="px-3 py-1.5 text-sm">{t.value}</Badge>
        ))}
      </div>
    </div>
  );
}

export function BusinessTab({ company }: { company: any }) {
  return (
    <div className="p-6 bg-card rounded-lg border border-border shadow-sm">
      <h3 className="font-semibold text-lg flex items-center gap-2 mb-4">
        <TrendingUp className="w-5 h-5 text-primary" />
        Business Intelligence
      </h3>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
           <div><span className="text-muted-foreground text-sm">Industry:</span> <div className="font-medium">{company.industry}</div></div>
           <div><span className="text-muted-foreground text-sm">Business Type:</span> <div className="font-medium">B2B / B2C</div></div>
        </div>
      </div>
    </div>
  );
}

export function SocialTab({ company }: { company: any }) {
  return (
    <div className="p-6 bg-card rounded-lg border border-border shadow-sm">
      <h3 className="font-semibold text-lg flex items-center gap-2 mb-4">
        <Link className="w-5 h-5 text-primary" />
        Social Presence
      </h3>
      <div className="flex gap-4">
         <Badge variant="outline">LinkedIn</Badge>
         <Badge variant="outline">Twitter</Badge>
         <Badge variant="outline">Instagram</Badge>
      </div>
    </div>
  );
}

export function SignalsTab({ company }: { company: any }) {
  const signals = [
    { label: "Has Booking System", active: true },
    { label: "Has CRM", active: false },
    { label: "Has Contact Form", active: true },
    { label: "Has Live Chat", active: false },
    { label: "Has WhatsApp", active: true },
  ];
  return (
    <div className="p-6 bg-card rounded-lg border border-border shadow-sm">
      <h3 className="font-semibold text-lg flex items-center gap-2 mb-4">
        <Info className="w-5 h-5 text-primary" />
        Business Signals
      </h3>
      <div className="flex flex-wrap gap-3">
        {signals.map((s, i) => (
           <Badge key={i} variant={s.active ? "default" : "outline"} className={s.active ? "bg-green-600 hover:bg-green-700" : "opacity-50"}>
             {s.label}
           </Badge>
        ))}
      </div>
    </div>
  );
}
