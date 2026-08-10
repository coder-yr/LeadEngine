import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Phone, Globe, MapPin, Search, LayoutGrid, List, ChevronLeft, ChevronRight, Loader2, Sparkles, Database } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";

interface DiscoveryResult {
  id: string;
  source: string;
  raw_name: string;
  raw_phone: string;
  raw_website: string;
  raw_address: string;
  is_duplicate: boolean;
  result_type?: 'EXISTING' | 'NEW';
  discovered_now?: boolean;
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
  jobStatus?: string;
  jobStats?: {
    total: number;
    new: number;
    existing: number;
    duplicates: number;
  };
}

export function DiscoveryResultsTable({ results, onBulkAnalyze, jobStatus }: DiscoveryResultsTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<string>("all");
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const uniqueResults = useMemo(() => results.filter(r => !r.is_duplicate), [results]);
  
  const filteredResults = useMemo(() => {
    return uniqueResults.filter(r => {
      if (activeTab === "all") return true;
      if (activeTab === "new") return r.result_type === "NEW";
      if (activeTab === "existing") return r.result_type === "EXISTING";
      return true;
    });
  }, [uniqueResults, activeTab]);

  const totalPages = Math.ceil(filteredResults.length / pageSize);
  const paginatedResults = filteredResults.slice((page - 1) * pageSize, page * pageSize);

  const toggleAll = () => {
    if (selectedIds.size === paginatedResults.length && paginatedResults.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedResults.map(r => r.id)));
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

  if (jobStatus === 'running' && uniqueResults.length === 0) {
    return (
      <Card className="w-full h-[400px] flex flex-col items-center justify-center bg-white/50 backdrop-blur-md border-slate-200/60 shadow-sm border-dashed">
        <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
        <h3 className="text-xl font-bold text-slate-900 mb-2">Discovery in progress</h3>
        <p className="text-slate-500 max-w-sm text-center">
          We are currently scanning sources, checking existing intelligence, and removing duplicates...
        </p>
      </Card>
    );
  }

  if (jobStatus === 'completed' && uniqueResults.length === 0) {
    return (
      <Card className="w-full h-[400px] flex flex-col items-center justify-center bg-white/50 backdrop-blur-md border-slate-200/60 shadow-sm border-dashed">
        <Search className="w-12 h-12 text-slate-400 mb-4" />
        <h3 className="text-xl font-bold text-slate-900 mb-2">No results found</h3>
        <p className="text-slate-500 max-w-sm text-center">
          We couldn't find any companies matching your search. Try broadening your keyword or location.
        </p>
      </Card>
    );
  }

  const newCount = uniqueResults.filter(r => r.result_type === 'NEW').length;
  const existingCount = uniqueResults.filter(r => r.result_type === 'EXISTING').length;

  return (
    <div className="space-y-4">
      {/* Top Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/80 p-4 rounded-xl border border-slate-200/60 backdrop-blur-xl shadow-sm relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-100/50 to-transparent pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto relative z-10">
          <Tabs value={activeTab} onValueChange={(val) => { setActiveTab(val); setSelectedIds(new Set()); setPage(1); }} className="w-full sm:w-[350px]">
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="all">All ({uniqueResults.length})</TabsTrigger>
              <TabsTrigger value="new">New ({newCount})</TabsTrigger>
              <TabsTrigger value="existing">Known ({existingCount})</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2 bg-slate-100/50 p-1 rounded-lg">
            <Button 
              variant={viewMode === 'table' ? 'secondary' : 'ghost'} 
              size="sm" 
              className={`px-3 ${viewMode === 'table' ? 'bg-white shadow-sm' : ''}`}
              onClick={() => setViewMode('table')}
            >
              <List className="w-4 h-4 mr-2" /> Table
            </Button>
            <Button 
              variant={viewMode === 'card' ? 'secondary' : 'ghost'} 
              size="sm"
              className={`px-3 ${viewMode === 'card' ? 'bg-white shadow-sm' : ''}`}
              onClick={() => setViewMode('card')}
            >
              <LayoutGrid className="w-4 h-4 mr-2" /> Cards
            </Button>
          </div>
        </div>

        <Button 
          onClick={handleBulkAnalyze}
          disabled={selectedIds.size === 0}
          className="w-full md:w-auto relative z-10 bg-indigo-600 hover:bg-indigo-700 text-white shadow-[0_0_15px_rgba(79,70,229,0.2)] hover:shadow-[0_0_25px_rgba(79,70,229,0.4)] transition-all"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          Deep Analyze Selected ({selectedIds.size})
        </Button>
      </div>

      {/* Results Rendering */}
      {viewMode === 'table' ? (
        <div className="rounded-xl border border-slate-200/60 bg-white/80 backdrop-blur-xl shadow-lg overflow-hidden relative">
          <Table className="relative z-10">
            <TableHeader className="bg-slate-50/80 backdrop-blur-md border-b border-slate-200">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-12 text-slate-500 font-semibold">
                  <Checkbox 
                    checked={selectedIds.size === paginatedResults.length && paginatedResults.length > 0}
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
              {paginatedResults.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-slate-500">
                    No results for this filter.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedResults.map((r) => {
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
                        <div className="flex items-center gap-2">
                          <div className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate max-w-[300px]" title={r.companies?.name || r.raw_name}>
                            {r.companies?.name || r.raw_name}
                          </div>
                          {r.result_type === 'EXISTING' && (
                            <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-slate-200">
                              <Database className="w-3 h-3 mr-1" /> Known
                            </Badge>
                          )}
                          {r.result_type === 'NEW' && (
                            <Badge variant="secondary" className="bg-emerald-50 text-emerald-600 border-emerald-200">
                              <Sparkles className="w-3 h-3 mr-1" /> New
                            </Badge>
                          )}
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
                })
              )}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {paginatedResults.map((r) => {
            const companyId = r.companies?.id;
            const isSelected = selectedIds.has(r.id);
            return (
              <Card 
                key={r.id} 
                className={`relative overflow-hidden transition-all duration-300 border-2 ${isSelected ? 'border-indigo-500 shadow-lg shadow-indigo-500/20' : 'border-slate-200/60 hover:border-indigo-300'} bg-white/80 backdrop-blur-xl group cursor-pointer`}
                onClick={() => toggleOne(r.id)}
              >
                <div className="absolute top-4 right-4 z-10">
                  <Checkbox 
                    checked={isSelected}
                    onCheckedChange={() => toggleOne(r.id)}
                    className="data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600 transition-all shadow-sm w-5 h-5"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4 pr-8">
                    <div>
                      <h4 className="font-bold text-lg text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1" title={r.companies?.name || r.raw_name}>
                        {r.companies?.name || r.raw_name}
                      </h4>
                      <div className="flex gap-2 mt-2">
                        {r.result_type === 'EXISTING' && (
                          <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-slate-200">
                            <Database className="w-3 h-3 mr-1" /> Known
                          </Badge>
                        )}
                        {r.result_type === 'NEW' && (
                          <Badge variant="secondary" className="bg-emerald-50 text-emerald-600 border-emerald-200">
                            <Sparkles className="w-3 h-3 mr-1" /> New
                          </Badge>
                        )}
                        <Badge variant="outline" className="bg-white text-slate-500 border-slate-200">
                          {r.source.replace('_', ' ')}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-3 mt-6">
                    {r.raw_phone && (
                      <div className="flex items-center text-sm font-medium text-slate-700">
                        <Phone className="w-4 h-4 mr-2 text-slate-400" />
                        {r.raw_phone}
                      </div>
                    )}
                    {r.raw_website && (
                      <div className="flex items-center text-sm font-medium text-indigo-600">
                        <Globe className="w-4 h-4 mr-2" />
                        <a 
                          href={r.raw_website.startsWith('http') ? r.raw_website : `https://${r.raw_website}`} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {r.raw_website.replace(/^https?:\/\//, '')}
                        </a>
                      </div>
                    )}
                    {r.raw_address && (
                      <div className="flex items-start text-sm text-slate-500 line-clamp-2">
                        <MapPin className="w-4 h-4 mr-2 mt-0.5 shrink-0 text-slate-400" />
                        <span>{r.raw_address}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                    {companyId ? (
                      <Link to={`/companies/${companyId}`} onClick={(e) => e.stopPropagation()} className="w-full">
                        <Button variant="ghost" className="w-full hover:bg-indigo-50 text-indigo-600 font-semibold">
                          View Details
                        </Button>
                      </Link>
                    ) : (
                      <span className="text-sm text-slate-400 text-center w-full">Processing...</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white/80 p-4 rounded-xl border border-slate-200/60 backdrop-blur-xl shadow-sm">
          <div className="text-sm text-slate-500">
            Showing <span className="font-medium text-slate-900">{(page - 1) * pageSize + 1}</span> to <span className="font-medium text-slate-900">{Math.min(page * pageSize, filteredResults.length)}</span> of <span className="font-medium text-slate-900">{filteredResults.length}</span> results
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">Rows per page</span>
              <Select value={pageSize.toString()} onValueChange={(val) => { setPageSize(Number(val)); setPage(1); }}>
                <SelectTrigger className="w-[70px] h-8 bg-white">
                  <SelectValue placeholder="25" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="icon" 
                className="h-8 w-8 bg-white"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="text-sm font-medium px-2">
                Page {page} of {totalPages}
              </div>
              <Button 
                variant="outline" 
                size="icon"
                className="h-8 w-8 bg-white"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
