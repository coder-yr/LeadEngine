import { useState, useEffect } from "react";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, Loader2, ExternalLink } from "lucide-react";

interface Proposal {
  id: string;
  public_url: string;
  created_at: string;
}

export function ProposalsTab({ companyId }: { companyId: string }) {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchProposals = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`http://localhost:3000/api/proposals/${companyId}`);
      setProposals(res.data);
    } catch (error) {
      console.error("Failed to fetch proposals", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProposals();
  }, [companyId]);

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      await axios.post(`http://localhost:3000/api/proposals/${companyId}/generate`);
      await fetchProposals();
    } catch (error) {
      console.error("Failed to generate proposal", error);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Proposals</h2>
          <p className="text-sm text-muted-foreground">Manage and generate automated PDF proposals.</p>
        </div>
        <Button onClick={handleGenerate} disabled={generating}>
          {generating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating PDF...
            </>
          ) : (
            <>
              <FileText className="mr-2 h-4 w-4" />
              Generate Proposal
            </>
          )}
        </Button>
      </div>

      <div className="grid gap-4">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground animate-pulse">Loading proposals...</div>
        ) : proposals.length === 0 ? (
          <Card className="border-dashed bg-muted/20">
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
              <FileText className="h-10 w-10 text-muted-foreground mb-4" />
              <h3 className="font-semibold text-lg">No Proposals Yet</h3>
              <p className="text-muted-foreground max-w-sm mb-6 mt-2">
                Generate your first personalized proposal. It will automatically compile intelligence, pain points, and recommended solutions.
              </p>
              <Button onClick={handleGenerate} disabled={generating} variant="outline">
                {generating ? "Generating..." : "Generate First Proposal"}
              </Button>
            </CardContent>
          </Card>
        ) : (
          proposals.map((proposal, index) => (
            <Card key={proposal.id} className="overflow-hidden transition-all hover:shadow-md">
              <CardContent className="p-0">
                <div className="flex flex-col sm:flex-row items-center justify-between p-6">
                  <div className="flex items-center gap-4 mb-4 sm:mb-0">
                    <div className="p-3 bg-primary/10 rounded-lg">
                      <FileText className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-base">Digital Strategy Proposal v{proposals.length - index}</h4>
                      <p className="text-sm text-muted-foreground">
                        Generated on {new Date(proposal.created_at).toLocaleDateString()} at {new Date(proposal.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Button variant="outline" asChild>
                      <a href={proposal.public_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4 mr-2" />
                        View
                      </a>
                    </Button>
                    <Button asChild>
                      <a href={proposal.public_url} download>
                        <Download className="w-4 h-4 mr-2" />
                        Download PDF
                      </a>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
