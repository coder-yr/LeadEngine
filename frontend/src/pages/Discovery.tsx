import { useState, useEffect } from "react";
import { ChevronLeft } from "lucide-react";
import { DiscoveryResultsTable } from "@/components/discovery/DiscoveryResultsTable";
import { DiscoverySearchForm } from "@/components/discovery/DiscoverySearchForm";
import { DiscoveryStats } from "@/components/discovery/DiscoveryStats";
import { DiscoveryJobsTable } from "@/components/discovery/DiscoveryJobsTable";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";

export default function Discovery() {
  const [stats, setStats] = useState({
    totalJobs: 0,
    completedJobs: 0,
    runningJobs: 0,
    totalDiscovered: 0,
    totalAfterDedup: 0,
    totalCompaniesCreated: 0,
  });
  const [jobs, setJobs] = useState<any[]>([]);
  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const [jobResults, setJobResults] = useState<any[]>([]);

  const fetchData = async () => {
    try {
      const [statsRes, jobsRes] = await Promise.all([
        api.get('/discovery/stats'),
        api.get('/discovery/jobs?limit=20'),
      ]);
      setStats(statsRes.data);
      setJobs(jobsRes.data.data);
    } catch (error) {
      console.error("Failed to fetch discovery data:", error);
    }
  };

  const fetchJobResults = async (jobId: string) => {
    try {
      const res = await api.get(`/discovery/jobs/${jobId}/results`);
      setJobResults(res.data);
    } catch (error) {
      console.error("Failed to fetch job results:", error);
    }
  };

  useEffect(() => {
    fetchData();
    // Poll every 5s if there are running jobs
    const interval = setInterval(() => {
      if (jobs.some((j) => j.status === 'running')) {
        fetchData();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [jobs]);

  useEffect(() => {
    if (selectedJob) {
      fetchJobResults(selectedJob.id);
      // Poll results if job is running
      if (selectedJob.status === 'running') {
        const interval = setInterval(() => {
          fetchJobResults(selectedJob.id);
        }, 5000);
        return () => clearInterval(interval);
      }
    }
  }, [selectedJob]);

  const handleBulkAnalyze = async (resultIds: string[]) => {
    try {
      await api.post('/discovery/bulk-analyze', { resultIds });
      alert(`Triggered intelligence workflows for ${resultIds.length} records. The UI will update shortly.`);
      
      if (selectedJob) {
        // Poll a few times as the async backend creates companies
        setTimeout(() => fetchJobResults(selectedJob.id), 1000);
        setTimeout(() => fetchJobResults(selectedJob.id), 3000);
        setTimeout(() => fetchJobResults(selectedJob.id), 6000);
      }
    } catch (error) {
      alert("Failed to start bulk analysis.");
    }
  };

  return (
    <div className="relative flex-1 min-h-screen p-8 pt-6 overflow-hidden bg-slate-50/50">
      {/* Premium Light Background Effects */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-200/40 blur-[100px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-200/40 blur-[100px]" />
      </div>

      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col space-y-2">
          <h2 className="text-4xl font-extrabold tracking-tight text-slate-900 drop-shadow-sm">
            Find Companies
          </h2>
          <p className="text-slate-500 text-lg">
            Discover new businesses and search companies already known by LeadEngine.
          </p>
        </div>

        {selectedJob ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-white/80 backdrop-blur-xl p-4 rounded-xl border border-slate-200/60 shadow-sm">
              <div className="flex items-center gap-4">
                <Button 
                  variant="outline" 
                  onClick={() => { setSelectedJob(null); setJobResults([]); fetchData(); }}
                  className="bg-white hover:bg-slate-50 text-slate-700"
                >
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Back to Search
                </Button>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Results for <span className="text-indigo-600">"{selectedJob.keyword}"</span> in {selectedJob.city}
                  </h3>
                  {selectedJob.status === 'running' && (
                    <p className="text-sm text-indigo-500 flex items-center mt-0.5">
                      <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse mr-2" />
                      Discovery in progress...
                    </p>
                  )}
                </div>
              </div>
            </div>
            
            <DiscoveryResultsTable 
              results={jobResults} 
              onBulkAnalyze={handleBulkAnalyze} 
              jobStatus={selectedJob.status}
              jobStats={{
                total: selectedJob.total_after_dedup || 0,
                new: selectedJob.total_new || 0,
                existing: selectedJob.total_existing || 0,
                duplicates: (selectedJob.total_raw_results || 0) - (selectedJob.total_after_dedup || 0)
              }}
            />
          </div>
        ) : (
          <div className="space-y-10">
            {/* Horizontal Search Form */}
            <div className="w-full">
              <DiscoverySearchForm onJobStarted={fetchData} />
            </div>
            
            {/* Statistics */}
            <DiscoveryStats stats={stats} />

            {/* Jobs / History */}
            <div className="space-y-4">
              <h3 className="text-xl font-bold tracking-tight text-slate-900">Recent Searches</h3>
              <DiscoveryJobsTable 
                jobs={jobs} 
                onSelectJob={setSelectedJob}
                onRefresh={fetchData} 
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

