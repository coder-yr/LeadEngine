import { useState } from "react";
import { Link } from "react-router-dom";
import { Phone, Globe, MapPin, Search } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

interface DiscoveryResult {
  id: string;
  source: string;
  raw_name: string;
  raw_phone: string;
  raw_website: string;
  raw_address: string;
  is_duplicate: boolean;
  companies?: {
    id: string;
    name: string;
    lead_score: number;
    pipeline_stage: string;
  };
}

interface DiscoveryResultsTableProps {
  results: DiscoveryResult[];
  onBulkAnalyze: (companyIds: string[]) => void;
}



export function DiscoveryResultsTable({ results, onBulkAnalyze }: DiscoveryResultsTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const uniqueResults = results.filter(r => !r.is_duplicate);

  const toggleAll = () => {
    if (selectedIds.size === uniqueResults.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(uniqueResults.map(r => r.id)));
    }
  };

  const toggleOne = (id: string | undefined) => {
    if (!id) return;
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleBulkAnalyze = () => {
    onBulkAnalyze(Array.from(selectedIds));
    setSelectedIds(new Set());
  };



  if (uniqueResults.length === 0) {
    return <div className="p-8 text-center text-muted-foreground">No unique results found.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-white/80 p-4 rounded-xl border border-slate-200/60 backdrop-blur-xl shadow-sm relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-100/50 to-transparent pointer-events-none" />
        <div className="text-sm relative z-10 flex items-center gap-3">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold">
            {selectedIds.size}
          </span>
          <span className="text-slate-600">
            selected of <span className="text-slate-900 font-bold">{uniqueResults.length}</span> unique leads
          </span>
        </div>
        <Button 
          onClick={handleBulkAnalyze}
          disabled={selectedIds.size === 0}
          className="relative z-10 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-all"
        >
          <Search className="w-4 h-4 mr-2" />
          Bulk Deep Analyze ({selectedIds.size})
        </Button>
      </div>

      <div className="rounded-xl border border-slate-200/60 bg-white/80 backdrop-blur-xl shadow-lg overflow-hidden relative">
        <Table className="relative z-10">
          <TableHeader className="bg-slate-50/80 backdrop-blur-md border-b border-slate-200">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-12 text-slate-500 font-semibold">
                <Checkbox 
                  checked={selectedIds.size === uniqueResults.length && uniqueResults.length > 0}
                  onCheckedChange={toggleAll}
                  aria-label="Select all"
                  className="data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600 transition-all"
                />
              </TableHead>
              <TableHead className="min-w-[300px] text-slate-500 font-semibold">Company</TableHead>
              <TableHead className="w-[180px] text-slate-500 font-semibold">Contact</TableHead>
              <TableHead className="w-[120px] text-slate-500 font-semibold">Source</TableHead>
              <TableHead className="w-[150px] text-slate-500 font-semibold">Lead Score</TableHead>
              <TableHead className="w-[120px] text-right text-slate-500 font-semibold">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {uniqueResults.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-slate-500">
                  <div className="flex flex-col items-center justify-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                      <MapPin className="w-6 h-6 text-slate-400" />
                    </div>
                    <p>No results to display.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              <>
                {uniqueResults.map((r) => {
                  const companyId = r.companies?.id;
                  const isSelected = selectedIds.has(r.id);
                  const score = r.companies?.lead_score || 0;

                  return (
                    <TableRow key={r.id} className="border-b border-slate-100/80 hover:bg-white/60 transition-colors group">
                      <TableCell>
                        <Checkbox 
                          checked={isSelected}
                          onCheckedChange={() => toggleOne(r.id)}
                          className="data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600 transition-all shadow-sm"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate max-w-[400px]" title={r.companies?.name || r.raw_name}>
                          {r.companies?.name || r.raw_name}
                        </div>
                        {r.raw_address && (
                          <div className="flex items-start text-xs text-slate-500 mt-1.5 line-clamp-2 max-w-[400px]" title={r.raw_address}>
                            <MapPin className="w-3.5 h-3.5 mr-1.5 mt-0.5 shrink-0 text-slate-400" />
                            <span>{r.raw_address}</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-2">
                          {r.raw_phone && (
                            <div className="flex items-center text-xs font-medium text-slate-700 bg-slate-100/80 backdrop-blur-sm border border-slate-200/60 w-fit px-2.5 py-1 rounded-md shadow-sm whitespace-nowrap">
                              <Phone className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                              {r.raw_phone}
                            </div>
                          )}
                          {r.raw_website && (
                            <div className="flex items-center text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 w-fit px-2.5 py-1 rounded-md transition-colors shadow-sm whitespace-nowrap">
                              <Globe className="w-3.5 h-3.5 mr-1.5" />
                              <a href={r.raw_website.startsWith('http') ? r.raw_website : `https://${r.raw_website}`} target="_blank" rel="noreferrer" className="hover:underline">
                                Website
                              </a>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200">
                          {r.source.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full" 
                              style={{ width: `${score}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold text-slate-700">{score}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {companyId ? (
                          <Link to={`/companies/${companyId}`}>
                            <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-200 text-slate-700">
                              View Details
                            </Button>
                          </Link>
                        ) : (
                          <span className="text-xs text-slate-400">Processing...</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
