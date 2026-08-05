import { useState, useEffect } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";

import { Play, CheckCircle2, AlertCircle, Loader2, Sparkles } from "lucide-react";

interface AnalysisProgress {
  stage: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  progress: number;
  message?: string;
  error?: string;
}

export function AnalysisTab({ company, onAnalysisComplete }: { company: any, onAnalysisComplete?: () => void }) {
  const [status, setStatus] = useState<string>(company.analysis_status || 'READY_FOR_ANALYSIS');
  const [progressData, setProgressData] = useState<AnalysisProgress>(
    company.analysis_progress || { stage: 'INIT', status: 'PENDING', progress: 0 }
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Only connect SSE if we are running analysis
    if (status !== 'ANALYSIS_RUNNING') return;

    const eventSource = new EventSource(`http://localhost:3000/api/analysis/${company.id}/stream`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'CONNECTED') return;
        
        setProgressData(data);
        
        if (data.status === 'COMPLETED') {
          setStatus('ANALYSIS_COMPLETED');
          if (onAnalysisComplete) onAnalysisComplete();
          eventSource.close();
        } else if (data.status === 'FAILED') {
          setStatus('ANALYSIS_FAILED');
          eventSource.close();
        }
      } catch (err) {
        console.error("Failed to parse SSE message", err);
      }
    };

    eventSource.onerror = (err) => {
      console.error("SSE Error", err);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [status, company.id]);

  const startAnalysis = async () => {
    try {
      setLoading(true);
      await axios.post(`http://localhost:3000/api/analysis/${company.id}`);
      setStatus('ANALYSIS_RUNNING');
      setProgressData({ stage: 'INIT', status: 'RUNNING', progress: 5, message: 'Starting analysis pipeline...' });
    } catch (err) {
      console.error("Failed to start analysis", err);
      alert("Failed to start analysis.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Company Intelligence Analysis
              </CardTitle>
              <CardDescription className="mt-1.5">
                Run our deep AI analysis pipeline to extract buying signals, verify technologies, and score this company.
              </CardDescription>
            </div>
            {status === 'READY_FOR_ANALYSIS' && (
              <Button onClick={startAnalysis} disabled={loading} size="lg">
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                Analyze Company
              </Button>
            )}
            {status === 'ANALYSIS_COMPLETED' && (
              <Button onClick={startAnalysis} variant="outline" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                Re-analyze
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {status === 'READY_FOR_ANALYSIS' && (
            <div className="text-center py-10 bg-muted/20 rounded-md border border-dashed border-border">
              <Sparkles className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
              <h3 className="font-semibold text-foreground mb-1">Analysis Pending</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                This company has been discovered but not yet analyzed. Click the button above to run the AI pipeline.
              </p>
            </div>
          )}

          {status === 'ANALYSIS_RUNNING' && (
            <div className="py-8 space-y-6 max-w-2xl mx-auto">
              <div className="text-center space-y-2">
                <h3 className="text-lg font-semibold animate-pulse text-primary">Analyzing...</h3>
                <p className="text-sm text-muted-foreground">{progressData.message || 'Processing step...'}</p>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-medium text-muted-foreground mb-1">
                  <span>{progressData.stage.replace(/_/g, ' ')}</span>
                  <span>{progressData.progress}%</span>
                </div>
                <Progress value={progressData.progress} className="h-2" />
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm pt-4 border-t border-border mt-6">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle2 className={`w-4 h-4 ${progressData.progress >= 25 ? 'text-primary' : 'opacity-20'}`} />
                  Verification
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle2 className={`w-4 h-4 ${progressData.progress >= 50 ? 'text-primary' : 'opacity-20'}`} />
                  Intelligence
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle2 className={`w-4 h-4 ${progressData.progress >= 75 ? 'text-primary' : 'opacity-20'}`} />
                  AI Insights
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle2 className={`w-4 h-4 ${progressData.progress >= 95 ? 'text-primary' : 'opacity-20'}`} />
                  Scoring & Context
                </div>
              </div>
            </div>
          )}

          {status === 'ANALYSIS_COMPLETED' && (
            <div className="py-6 space-y-4">
              <div className="flex items-center gap-3 text-green-500 mb-6">
                <CheckCircle2 className="w-6 h-6" />
                <h3 className="text-lg font-semibold">Analysis Complete</h3>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg bg-card border border-border shadow-sm">
                  <p className="text-xs text-muted-foreground mb-1">Lead Score</p>
                  <p className="text-2xl font-bold text-primary">{company.analysis_confidence || '--'}</p>
                </div>
                <div className="p-4 rounded-lg bg-card border border-border shadow-sm">
                  <p className="text-xs text-muted-foreground mb-1">Duration</p>
                  <p className="text-2xl font-bold">
                    {company.analysis_duration_ms ? `${(company.analysis_duration_ms / 1000).toFixed(1)}s` : '--'}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-card border border-border shadow-sm col-span-2">
                  <p className="text-xs text-muted-foreground mb-1">Last Analyzed</p>
                  <p className="text-sm font-medium mt-1 text-foreground">
                    {company.analysis_completed_at ? new Date(company.analysis_completed_at).toLocaleString() : '--'}
                  </p>
                </div>
              </div>
              
              <p className="text-sm text-muted-foreground mt-4">
                Review the detailed findings in the AI Insights, Website, and Timeline tabs.
              </p>
            </div>
          )}

          {status === 'ANALYSIS_FAILED' && (
            <div className="text-center py-8 text-destructive">
              <AlertCircle className="w-10 h-10 mx-auto mb-3" />
              <h3 className="font-semibold mb-1">Analysis Failed</h3>
              <p className="text-sm">{progressData.message || company.analysis_error || 'An unexpected error occurred during analysis.'}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
