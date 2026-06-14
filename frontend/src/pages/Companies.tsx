import { CompanyList } from "@/components/companies/CompanyList";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function Companies() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Company Intelligence</h1>
          <p className="text-muted-foreground mt-1">
            Browse discovered accounts, review their digital footprint, and analyze AI-generated service recommendations.
          </p>
        </div>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Add Company
        </Button>
      </div>

      <CompanyList />
    </div>
  );
}
