import { useState, useEffect } from "react";
import axios from "axios";
import { CompanyCard } from "./CompanyCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Filter, ArrowDownWideNarrow, Loader2 } from "lucide-react";

export function CompanyList() {
  const [searchQuery, setSearchQuery] = useState("");
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastLines, setToastLines] = useState<string[] | null>(null);

  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        setLoading(true);
        const res = await axios.get("http://localhost:3000/api/companies");
        
        // Map backend DB objects to frontend Company schema
        const mappedCompanies = res.data.map((dbCompany: any) => {
          const activeAuditJob = dbCompany.audit_jobs?.find((j: any) => j.status === 'RUNNING' || j.status === 'PENDING') || dbCompany.audit_jobs?.[0];
          const hasCompletedAudit = dbCompany.website_audits && dbCompany.website_audits.length > 0;
          const auditStatus = activeAuditJob?.status || (hasCompletedAudit ? 'COMPLETED' : 'PENDING');

          return {
            id: dbCompany.id,
            name: dbCompany.name,
            website: dbCompany.website_url,
            industry: dbCompany.industry || 'Unknown',
            lastAudited: dbCompany.created_at,
            auditStatus,
            intelligence: {
              leadScore: dbCompany.company_intelligence?.[0]?.lead_score || 0,
              websiteScore: dbCompany.company_intelligence?.[0]?.website_score || 0,
              socialPresence: dbCompany.company_intelligence?.[0]?.social_profiles?.length > 0,
              whatsappPresence: dbCompany.company_intelligence?.[0]?.whatsapp_detected || false,
              crmPresence: dbCompany.company_intelligence?.[0]?.crm_detected || false,
              bookingPresence: dbCompany.company_intelligence?.[0]?.booking_detected || false,
              aiInsight: "Backend data mapping complete.",
              recommendedServices: dbCompany.company_intelligence?.[0]?.services_needed || ["SEO", "Web Dev"]
            }
          };
        });

        setCompanies(mappedCompanies);
      } catch (error) {
        console.error("Failed to fetch companies:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchCompanies();
  }, []);

  const handleDeleteCompany = async (companyId: string) => {
    if (!window.confirm("Delete this company and all associated data? This action cannot be undone.")) {
      return;
    }

    try {
      const res = await axios.delete(`http://localhost:3000/api/companies/${companyId}`);
      if (res.data.success) {
        setCompanies(prev => prev.filter(c => c.id !== companyId));
        
        const sum = res.data.summary;
        const lines = [
          "Deleted company",
          `${sum.contactsDeleted || 0} contacts removed`,
          `${sum.auditsDeleted || 0} audits removed`,
          `${sum.insightsDeleted || 0} insight removed`
        ];
        
        setToastLines(lines);
        setTimeout(() => setToastLines(null), 5000);
      }
    } catch (error) {
      console.error("Failed to delete company:", error);
      alert("Failed to delete company. Check console for details.");
    }
  };

  const filteredCompanies = companies.filter(company => 
    company.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    company.industry?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Command Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between p-4 bg-card border border-border/60 shadow-sm rounded-lg">
        <div className="relative w-full sm:w-96 flex-shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search companies by name or industry..." 
            className="pl-9 bg-background/50 border-border/60 shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)]"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          <Button variant="outline" size="sm" className="gap-2 shrink-0">
            <Filter className="w-4 h-4" />
            Missing Integrations
          </Button>
          <Button variant="outline" size="sm" className="gap-2 shrink-0">
            <Filter className="w-4 h-4" />
            Industry
          </Button>
          <Button variant="outline" size="sm" className="gap-2 shrink-0">
            <ArrowDownWideNarrow className="w-4 h-4" />
            Sort: Lead Score
          </Button>
        </div>
      </div>

      {/* List */}
      <div className="flex flex-col gap-4">
        {loading ? (
          <div className="flex justify-center items-center py-12 text-muted-foreground border border-dashed rounded-lg">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            Loading companies...
          </div>
        ) : filteredCompanies.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg">
            No companies found matching your criteria.
          </div>
        ) : (
          filteredCompanies.map((company, idx) => (
            <CompanyCard 
              key={company.id || idx} 
              company={company} 
              onDelete={handleDeleteCompany}
            />
          ))
        )}
      </div>

      {/* Lightweight Toast */}
      {toastLines && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-1 bg-gray-900 text-white p-4 rounded-lg shadow-xl animate-in fade-in slide-in-from-bottom-5">
          {toastLines.map((line, i) => (
            <div key={i} className={i === 0 ? "font-bold text-sm mb-1" : "text-xs text-gray-300"}>
              {line}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
