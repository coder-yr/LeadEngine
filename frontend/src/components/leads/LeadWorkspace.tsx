import { useState, useEffect } from "react";
import axios from "axios";
import { LeadTable } from "./LeadTable";
import { LeadDetail } from "./LeadDetail";
import { Loader2 } from "lucide-react";

export function LeadWorkspace() {
  const [leads, setLeads] = useState<any[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeads = async () => {
      try {
        setLoading(true);
        const res = await axios.get("http://localhost:3000/api/companies");
        
        // Map companies to the expected Lead structure
        const mappedLeads = res.data.map((dbCompany: any) => ({
          id: dbCompany.id,
          name: dbCompany.name,
          title: "Unknown",
          company: dbCompany.name,
          email: dbCompany.email || `contact@${dbCompany.website_url}`,
          status: dbCompany.pipeline_stage === 'Discovered' ? 'New' : 'Qualified',
          intelligence: {
            digitalMaturityScore: dbCompany.company_intelligence?.[0]?.digital_maturity_score || 0,
            servicesNeeded: dbCompany.company_intelligence?.[0]?.services_needed || ["SEO"],
            leadScore: dbCompany.company_intelligence?.[0]?.lead_score || 0,
            aiInsights: dbCompany.company_intelligence?.[0]?.ai_insight || "No insights generated yet."
          },
          audit: {
            url: dbCompany.website_url,
            seoScore: dbCompany.company_intelligence?.[0]?.website_score || 0,
            mobileFriendly: true,
            sslEnabled: true,
            pageSpeedEstimate: 85,
            hasContactForm: dbCompany.company_intelligence?.[0]?.booking_detected || false,
            hasWhatsAppWidget: dbCompany.company_intelligence?.[0]?.whatsapp_detected || false,
            socialLinksFound: dbCompany.company_intelligence?.[0]?.social_profiles || [],
            auditSummary: "Dynamic audit retrieved.",
            issues: [],
            auditedAt: dbCompany.created_at
          },
          activities: []
        }));

        setLeads(mappedLeads);
        if (mappedLeads.length > 0) setSelectedLeadId(mappedLeads[0].id);
      } catch (error) {
        console.error("Failed to fetch leads:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchLeads();
  }, []);

  const selectedLead = leads.find(l => l.id === selectedLeadId) || null;

  if (loading) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center rounded-lg border border-border bg-background shadow-sm">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] rounded-lg border border-border bg-background shadow-sm overflow-hidden flex">
      <div className={`transition-all duration-300 ease-in-out ${selectedLeadId ? 'w-[30%] border-r border-border' : 'w-full'}`}>
        <LeadTable 
          leads={leads} 
          selectedLeadId={selectedLeadId} 
          onSelectLead={setSelectedLeadId} 
        />
      </div>
      
      {selectedLeadId && selectedLead && (
        <div className="w-[70%] bg-background overflow-hidden relative">
          <LeadDetail lead={selectedLead} onClose={() => setSelectedLeadId(null)} />
        </div>
      )}
    </div>
  );
}
