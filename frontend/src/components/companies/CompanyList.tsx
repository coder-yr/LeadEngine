import { useState } from "react";
import { CompanyCard } from "./CompanyCard";
import { MOCK_COMPANIES } from "@/types/company";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Filter, ArrowDownWideNarrow } from "lucide-react";

export function CompanyList() {
  const [searchQuery, setSearchQuery] = useState("");

  // Simple filter for mock purposes
  const filteredCompanies = MOCK_COMPANIES.filter(company => 
    company.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    company.industry.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Command Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between p-4 bg-muted/20 border border-border rounded-lg">
        <div className="relative w-full sm:w-96 flex-shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search companies by name or industry..." 
            className="pl-9 bg-background"
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
        {filteredCompanies.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg">
            No companies found matching your criteria.
          </div>
        ) : (
          filteredCompanies.map(company => (
            <CompanyCard key={company.id} company={company} />
          ))
        )}
      </div>
    </div>
  );
}
