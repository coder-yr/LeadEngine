import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Database, Sparkles, ShieldCheck } from "lucide-react";

interface DiscoveryStatsProps {
  stats: {
    totalJobs?: number;
    completedJobs?: number;
    runningJobs?: number;
    totalDiscovered?: number;
    totalAfterDedup?: number;
    totalNew?: number;
    totalExisting?: number;
  };
}

export function DiscoveryStats({ stats }: DiscoveryStatsProps) {
  const totalFound = stats.totalAfterDedup || 0;
  const known = stats.totalExisting || 0;
  const newLeads = stats.totalNew || 0;
  const duplicates = (stats.totalDiscovered || 0) - totalFound;

  return (
    <div className="grid gap-6 grid-cols-2 lg:grid-cols-4">
      {/* Total Found */}
      <Card className="relative overflow-hidden group bg-white/80 border-slate-200/60 backdrop-blur-xl shadow-sm hover:border-indigo-300 transition-all duration-300">
        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
          <Search className="w-24 h-24 text-indigo-600 -mr-6 -mt-6" />
        </div>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
          <CardTitle className="text-sm font-medium text-slate-500">Total Found</CardTitle>
          <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
            <Search className="h-4 w-4" />
          </div>
        </CardHeader>
        <CardContent className="relative z-10">
          <div className="text-3xl font-extrabold text-slate-900 tracking-tight">{totalFound.toLocaleString()}</div>
          <p className="text-xs font-medium text-slate-500 mt-2">
            Companies across all searches
          </p>
        </CardContent>
      </Card>

      {/* Known */}
      <Card className="relative overflow-hidden group bg-white/80 border-slate-200/60 backdrop-blur-xl shadow-sm hover:border-slate-300 transition-all duration-300">
        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
          <Database className="w-24 h-24 text-slate-600 -mr-6 -mt-6" />
        </div>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
          <CardTitle className="text-sm font-medium text-slate-500">Known Intelligence</CardTitle>
          <div className="p-2 rounded-lg bg-slate-100 text-slate-600">
            <Database className="h-4 w-4" />
          </div>
        </CardHeader>
        <CardContent className="relative z-10">
          <div className="text-3xl font-extrabold text-slate-900 tracking-tight">{known.toLocaleString()}</div>
          <p className="text-xs font-medium text-slate-500 mt-2">
            Already exist in LeadEngine
          </p>
        </CardContent>
      </Card>

      {/* New */}
      <Card className="relative overflow-hidden group bg-white/80 border-slate-200/60 backdrop-blur-xl shadow-sm hover:border-emerald-300 transition-all duration-300">
        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
          <Sparkles className="w-24 h-24 text-emerald-600 -mr-6 -mt-6" />
        </div>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
          <CardTitle className="text-sm font-medium text-slate-500">New Discoveries</CardTitle>
          <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
            <Sparkles className="h-4 w-4" />
          </div>
        </CardHeader>
        <CardContent className="relative z-10">
          <div className="text-3xl font-extrabold text-slate-900 tracking-tight">{newLeads.toLocaleString()}</div>
          <p className="text-xs font-medium text-emerald-600 mt-2">
            Fresh companies added globally
          </p>
        </CardContent>
      </Card>

      {/* Duplicates Prevented */}
      <Card className="relative overflow-hidden group bg-white/80 border-slate-200/60 backdrop-blur-xl shadow-sm hover:border-violet-300 transition-all duration-300">
        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
          <ShieldCheck className="w-24 h-24 text-violet-600 -mr-6 -mt-6" />
        </div>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
          <CardTitle className="text-sm font-medium text-slate-500">Duplicates Prevented</CardTitle>
          <div className="p-2 rounded-lg bg-violet-50 text-violet-600">
            <ShieldCheck className="h-4 w-4" />
          </div>
        </CardHeader>
        <CardContent className="relative z-10">
          <div className="text-3xl font-extrabold text-slate-900 tracking-tight">{duplicates.toLocaleString()}</div>
          <p className="text-xs font-medium text-slate-500 mt-2">
            Resolved via Identity Engine
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
