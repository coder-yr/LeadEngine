import { useState, useEffect } from "react";
import { ChevronLeft } from "lucide-react";
import { DiscoveryResultsTable } from "@/components/discovery/DiscoveryResultsTable";
import { DiscoverySearchForm } from "@/components/discovery/DiscoverySearchForm";
import { DiscoveryStats } from "@/components/discovery/DiscoveryStats";
import { DiscoveryJobsTable } from "@/components/discovery/DiscoveryJobsTable";
import { Button } from "@/components/ui/button";
import axios from "axios";

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
        axios.get("http://localhost:3000/api/discovery/stats"),
        axios.get("http://localhost:3000/api/discovery/jobs?limit=20"),
      ]);
      setStats(statsRes.data);
      setJobs(jobsRes.data.data);
    } catch (error) {
      console.error("Failed to fetch discovery data:", error);
    }
  };

  const fetchJobResults = async (jobId: string) => {
    try {
      const res = await axios.get(`http://localhost:3000/api/discovery/jobs/${jobId}/results`);
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
      await axios.post("http://localhost:3000/api/discovery/bulk-analyze", { resultIds });
      alert(`Triggered intelligence workflows for ${resultIds.length} records.`);
    } catch (error) {
      alert("Failed to start bulk analysis.");
    }
  };

  return (
    <div className="relative flex-1 min-h-screen p-8 pt-6 overflow-hidden">
      {/* Premium Light Background Effects */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-200/40 blur-[100px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-200/40 blur-[100px]" />
      </div>

      <div className="flex items-center justify-between space-y-2 mb-8">
        <div>
          <h2 className="text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-indigo-700 to-purple-700 drop-shadow-sm">
            Lead Discovery Engine
          </h2>
          <p className="text-slate-600 mt-2">
            Automated multi-source scraping, deduplication, and intelligence.
          </p>
        </div>
      </div>

      <div className="space-y-8">
        <DiscoveryStats stats={stats} />

      {selectedJob ? (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              onClick={() => { setSelectedJob(null); setJobResults([]); }}
              className="hover:bg-white/10"
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Back to Jobs
            </Button>
            <h3 className="text-lg font-medium">
              Results for <span className="text-indigo-400">"{selectedJob.keyword}"</span> in {selectedJob.city}
            </h3>
          </div>
          
          <DiscoveryResultsTable 
            results={jobResults} 
            onBulkAnalyze={handleBulkAnalyze} 
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-1">
            <DiscoverySearchForm onJobStarted={fetchData} />
          </div>
          <div className="xl:col-span-2 space-y-4">
            <h3 className="text-lg font-medium">Recent Discovery Jobs</h3>
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
