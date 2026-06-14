import { useState } from "react";
import { LeadTable } from "./LeadTable";
import { LeadDetail } from "./LeadDetail";
import { MOCK_LEADS } from "@/types/lead";

export function LeadWorkspace() {
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(MOCK_LEADS[0].id);

  const selectedLead = MOCK_LEADS.find(l => l.id === selectedLeadId) || null;

  return (
    <div className="h-[calc(100vh-8rem)] rounded-lg border border-border bg-background shadow-sm overflow-hidden flex">
      <div className={`transition-all duration-300 ease-in-out ${selectedLeadId ? 'w-[30%] border-r border-border' : 'w-full'}`}>
        <LeadTable 
          leads={MOCK_LEADS} 
          selectedLeadId={selectedLeadId} 
          onSelectLead={setSelectedLeadId} 
        />
      </div>
      
      {selectedLeadId && (
        <div className="w-[70%] bg-background overflow-hidden relative">
          <LeadDetail lead={selectedLead} onClose={() => setSelectedLeadId(null)} />
        </div>
      )}
    </div>
  );
}
