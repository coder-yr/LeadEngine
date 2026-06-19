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
        const mappedLeads = res.data.map((dbCompany: any) => {
          const auditData = dbCompany.website_audits?.[0] || {};
          return {
            id: dbCompany.id,
            name: dbCompany.contacts?.[0]?.first_name ? `${dbCompany.contacts[0].first_name} ${dbCompany.contacts[0].last_name}` : "Unknown Contact",
            title: dbCompany.contacts?.[0]?.title || "Unknown Title",
            company: dbCompany.name,
            email: dbCompany.contacts?.[0]?.email || `contact@${dbCompany.website_url?.replace(/^https?:\/\//, '')}`,
            intelligence: {
              digitalMaturityScore: dbCompany.company_intelligence?.[0]?.digital_maturity_score || 0,
              aiInsights: "Insights are generated dynamically on the server.",
              servicesNeeded: dbCompany.company_intelligence?.[0]?.services_needed || [],
              leadScore: dbCompany.company_intelligence?.[0]?.lead_score || 0
            },
            audit: {
              url: dbCompany.website_url,
              seoScore: auditData.seo_score || 0,
              mobileFriendly: auditData.mobile_friendly ?? false,
              sslEnabled: auditData.ssl_enabled ?? false,
              pageSpeedEstimate: auditData.page_speed_estimate || 0,
              hasContactForm: auditData.has_contact_form ?? false,
              hasWhatsAppWidget: auditData.has_whatsapp_widget ?? false,
              socialLinksFound: auditData.social_links_found || [],
              auditSummary: auditData.audit_summary || "Audit pending or not available.",
              issues: auditData.issues || [],
              auditedAt: auditData.audited_at || dbCompany.created_at
            },
            activities: dbCompany.activities || []
          };
        });

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
