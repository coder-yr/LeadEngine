import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Search, ShieldCheck, Database } from "lucide-react";

interface DiscoveryStatsProps {
  stats: {
    totalJobs: number;
    completedJobs: number;
    runningJobs: number;
    totalDiscovered: number;
    totalAfterDedup: number;
    totalCompaniesCreated: number;
  };
}

export function DiscoveryStats({ stats }: DiscoveryStatsProps) {
  const dedupRate = stats.totalDiscovered > 0 
    ? Math.round(((stats.totalDiscovered - stats.totalAfterDedup) / stats.totalDiscovered) * 100)
    : 0;

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      <Card className="relative overflow-hidden group bg-white/80 border-slate-200/60 backdrop-blur-xl shadow-sm hover:border-indigo-300 transition-all duration-500 hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-500/10">
        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
          <Search className="w-24 h-24 text-indigo-600 -mr-6 -mt-6" />
        </div>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
          <CardTitle className="text-sm font-medium text-slate-500">Total Jobs Run</CardTitle>
          <div className="p-2 rounded-lg bg-indigo-100 text-indigo-600">
            <Search className="h-4 w-4" />
          </div>
        </CardHeader>
        <CardContent className="relative z-10">
          <div className="text-3xl font-bold text-slate-900 tracking-tight">{stats.totalJobs}</div>
          <p className="text-xs font-medium text-indigo-600 mt-2 flex items-center">
            {stats.runningJobs} currently running
          </p>
        </CardContent>
      </Card>

      <Card className="relative overflow-hidden group bg-white/80 border-slate-200/60 backdrop-blur-xl shadow-sm hover:border-blue-300 transition-all duration-500 hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-500/10">
        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
          <Database className="w-24 h-24 text-blue-600 -mr-6 -mt-6" />
        </div>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
          <CardTitle className="text-sm font-medium text-slate-500">Raw Leads Found</CardTitle>
          <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
            <Database className="h-4 w-4" />
          </div>
        </CardHeader>
        <CardContent className="relative z-10">
          <div className="text-3xl font-bold text-slate-900 tracking-tight">{stats.totalDiscovered.toLocaleString()}</div>
          <p className="text-xs font-medium text-slate-500 mt-2">
            Across all active sources
          </p>
        </CardContent>
      </Card>

      <Card className="relative overflow-hidden group bg-white/80 border-slate-200/60 backdrop-blur-xl shadow-sm hover:border-emerald-300 transition-all duration-500 hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-500/10">
        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
          <ShieldCheck className="w-24 h-24 text-emerald-600 -mr-6 -mt-6" />
        </div>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
          <CardTitle className="text-sm font-medium text-slate-500">Deduplication Rate</CardTitle>
          <div className="p-2 rounded-lg bg-emerald-100 text-emerald-600">
            <ShieldCheck className="h-4 w-4" />
          </div>
        </CardHeader>
        <CardContent className="relative z-10">
          <div className="text-3xl font-bold text-slate-900 tracking-tight">{dedupRate}%</div>
          <p className="text-xs font-medium text-slate-500 mt-2">
            {stats.totalAfterDedup.toLocaleString()} unique leads
          </p>
        </CardContent>
      </Card>

      <Card className="relative overflow-hidden group bg-white/80 border-slate-200/60 backdrop-blur-xl shadow-sm hover:border-purple-300 transition-all duration-500 hover:-translate-y-1 hover:shadow-xl hover:shadow-purple-500/10">
        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
          <Activity className="w-24 h-24 text-purple-600 -mr-6 -mt-6" />
        </div>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
          <CardTitle className="text-sm font-medium text-slate-500">Companies Created</CardTitle>
          <div className="p-2 rounded-lg bg-purple-100 text-purple-600">
            <Activity className="h-4 w-4" />
          </div>
        </CardHeader>
        <CardContent className="relative z-10">
          <div className="text-3xl font-bold text-slate-900 tracking-tight">{stats.totalCompaniesCreated.toLocaleString()}</div>
          <p className="text-xs font-medium text-slate-500 mt-2">
            Added to orchestration pipeline
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
