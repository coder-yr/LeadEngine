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

  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        setLoading(true);
        const res = await axios.get("http://localhost:3000/api/companies");
        
        // Map backend DB objects to frontend Company schema
        const mappedCompanies = res.data.map((dbCompany: any) => ({
          id: dbCompany.id,
          name: dbCompany.name,
          website: dbCompany.website_url,
          industry: dbCompany.industry || 'Unknown',
          lastAudited: dbCompany.created_at,
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
        }));

        setCompanies(mappedCompanies);
      } catch (error) {
        console.error("Failed to fetch companies:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchCompanies();
  }, []);

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
            <CompanyCard key={company.id || idx} company={company} />
          ))
        )}
      </div>
    </div>
  );
}
