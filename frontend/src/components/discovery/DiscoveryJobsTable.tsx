import { formatDistanceToNow } from "date-fns";
import { Loader2, ChevronRight, Download, Trash2, CheckCircle2, XCircle, Clock, MapPin } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import axios from "axios";

interface DiscoveryJob {
  id: string;
  keyword: string;
  city: string;
  sources: string[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  total_raw_results: number;
  total_after_dedup: number;
  created_at: string;
  per_source_counts: Record<string, number>;
}

interface DiscoveryJobsTableProps {
  jobs: DiscoveryJob[];
  onSelectJob: (job: DiscoveryJob) => void;
  onRefresh: () => void;
}

export function DiscoveryJobsTable({ jobs, onSelectJob, onRefresh }: DiscoveryJobsTableProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running':
        return <Badge variant="secondary" className="bg-blue-500/10 text-blue-400 border-blue-500/20"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Running</Badge>;
      case 'completed':
        return <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20"><CheckCircle2 className="w-3 h-3 mr-1" /> Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive" className="bg-red-500/10 text-red-400 border-red-500/20"><XCircle className="w-3 h-3 mr-1" /> Failed</Badge>;
      default:
        return <Badge variant="outline" className="text-muted-foreground"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this discovery job?")) return;
    
    try {
      await axios.delete(`http://localhost:3000/api/discovery/jobs/${id}`);
      onRefresh();
    } catch (error) {
      alert("Failed to delete");
    }
  };

  const handleExport = (id: string, format: 'csv' | 'xlsx', e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(`http://localhost:3000/api/discovery/export/${id}${format === 'xlsx' ? '/xlsx' : ''}`, '_blank');
  };

  if (jobs.length === 0) {
    return (
      <div className="text-center p-8 text-muted-foreground bg-black/20 rounded-lg border border-white/5">
        No discovery jobs yet. Start a new search above.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200/60 bg-white/80 backdrop-blur-xl shadow-lg overflow-hidden relative">
      <Table className="relative z-10">
        <TableHeader className="bg-slate-50/80 backdrop-blur-md border-b border-slate-200">
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-slate-600 font-semibold">Target</TableHead>
            <TableHead className="text-slate-600 font-semibold">Status</TableHead>
            <TableHead className="text-slate-600 font-semibold">Sources</TableHead>
            <TableHead className="text-right text-slate-600 font-semibold">Results (Deduped)</TableHead>
            <TableHead className="text-slate-600 font-semibold">Age</TableHead>
            <TableHead className="text-right text-slate-600 font-semibold">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.map((job) => (
            <TableRow 
              key={job.id} 
              className="cursor-pointer border-b border-slate-100 hover:bg-slate-50/50 transition-colors group"
              onClick={() => onSelectJob(job)}
            >
              <TableCell className="font-medium">
                <div className="text-slate-900 group-hover:text-indigo-600 transition-colors">{job.keyword}</div>
                <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {job.city}
                </div>
              </TableCell>
              <TableCell>{getStatusBadge(job.status)}</TableCell>
              <TableCell>
                <div className="flex gap-1.5 flex-wrap max-w-[200px]">
                  {job.sources.map((s: string) => (
                    <Badge key={s} variant="outline" className="text-[10px] py-0 border-slate-200 bg-white text-slate-600">
                      {s.replace('_', ' ')}
                    </Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div className="font-bold text-emerald-600">{job.total_after_dedup}</div>
                <div className="text-xs text-slate-500 mt-0.5">from {job.total_raw_results} raw</div>
              </TableCell>
              <TableCell className="text-slate-500 text-sm">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3 h-3" />
                  {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 hover:text-emerald-600 hover:bg-emerald-50"
                    onClick={(e) => handleExport(job.id, 'xlsx', e)}
                    title="Export XLSX"
                    disabled={job.status !== 'completed'}
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 hover:text-red-600 hover:bg-red-50"
                    onClick={(e) => handleDelete(job.id, e)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
