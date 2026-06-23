import { useState } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Globe, Clock, CheckCircle2, XCircle, AlertTriangle, Activity, Code, Target, BrainCircuit, Users } from "lucide-react";

export default function WebsiteAuditTester() {
  const [url, setUrl] = useState("");
  const [isDeepAudit, setIsDeepAudit] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRunAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await axios.post("http://localhost:3000/api/audit/test", {
        url,
        type: isDeepAudit ? "deep" : "quick"
      });

      if (res.data.success) {
        setResult(res.data.data);
      } else {
        setError(res.data.error || "Failed to run audit.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const StatusIcon = ({ status }: { status: boolean }) => (
    status ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <XCircle className="w-5 h-5 text-red-500" />
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Lead Intelligence Debugger</h1>
        <p className="text-muted-foreground mt-2">
          Run the full LeadEngine pipeline statelessly. Validate Contact Discovery, AI Extraction, and Scoring logic on-the-fly.
        </p>
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle>Run Pipeline Sandbox</CardTitle>
          <CardDescription>Enter a website URL to execute the full stateless analysis.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRunAudit} className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  className="pl-10 text-lg h-12"
                  placeholder="https://trijog.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={loading}
                />
              </div>
              <Button type="submit" disabled={!url || loading} className="h-12 px-8" size="lg">
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Running Pipeline...
                  </>
                ) : (
                  "Execute Pipeline"
                )}
              </Button>
            </div>

            <div className="flex items-center space-x-3 bg-muted/30 p-4 rounded-lg border border-border/50">
              <Switch
                id="audit-mode"
                checked={isDeepAudit}
                onCheckedChange={setIsDeepAudit}
                disabled={loading}
              />
              <div className="grid gap-1.5 leading-none">
                <Label htmlFor="audit-mode" className="text-base font-semibold">
                  {isDeepAudit ? "Deep Pipeline (Full AI + Deep Scrape)" : "Quick Pipeline (Fast Scrape, No AI)"}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {isDeepAudit 
                    ? "Takes up to 2 minutes. Runs Ollama analysis and extends python scraper timeout." 
                    : "Takes 10-20 seconds. Bypasses Ollama and uses an aggressive 20s scraper timeout."}
                </p>
              </div>
            </div>
          </form>

          {error && (
            <div className="mt-6 p-4 bg-red-500/10 text-red-600 dark:text-red-400 rounded-lg border border-red-500/20 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
              <div>
                <h4 className="font-semibold">Pipeline Failed</h4>
                <p className="text-sm mt-1">{error}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {result && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-5 h-12 mb-6 bg-muted/50 p-1">
              <TabsTrigger value="overview" className="h-10 text-sm font-medium"><Activity className="w-4 h-4 mr-2" /> Overview</TabsTrigger>
              <TabsTrigger value="contacts" className="h-10 text-sm font-medium"><Users className="w-4 h-4 mr-2" /> Contacts</TabsTrigger>
              <TabsTrigger value="technology" className="h-10 text-sm font-medium"><Target className="w-4 h-4 mr-2" /> Technology</TabsTrigger>
              <TabsTrigger value="ai-insights" className="h-10 text-sm font-medium"><BrainCircuit className="w-4 h-4 mr-2" /> AI Insights</TabsTrigger>
              <TabsTrigger value="debug" className="h-10 text-sm font-medium"><Code className="w-4 h-4 mr-2" /> Debug</TabsTrigger>
            </TabsList>

            {/* TAB: OVERVIEW */}
            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-primary/5 border-primary/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Lead Score</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-4xl font-bold text-primary">{result.intelligence?.lead_score}/100</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Intent Score</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{result.intelligence?.intent_score}/100</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Opportunity Score</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{result.intelligence?.opportunity_score}/100</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Digital Maturity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{result.intelligence?.digital_maturity_score}/100</div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border-border/50">
                  <CardHeader>
                    <CardTitle>Recommended Services</CardTitle>
                    <CardDescription>Based on missing infrastructure</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {result.intelligence?.recommended_services?.length > 0 ? (
                      result.intelligence.recommended_services.map((svc: any, idx: number) => (
                        <div key={idx} className="flex flex-col p-3 rounded-lg border border-border/50 bg-muted/20">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-foreground">{svc.service}</span>
                            <Badge variant={svc.confidence > 90 ? "default" : "secondary"}>{svc.confidence}% Match</Badge>
                          </div>
                          <span className="text-sm text-muted-foreground">{svc.reason}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground">No recommendations. Website is highly optimized.</p>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-border/50">
                  <CardHeader>
                    <CardTitle>Audit Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-lg leading-relaxed">{result.audit?.auditSummary}</p>
                    <div className="mt-6 space-y-3">
                      {result.audit?.issues?.map((issue: any, idx: number) => (
                        <div key={idx} className="flex items-start gap-2">
                          <AlertTriangle className={`w-4 h-4 mt-0.5 shrink-0 ${issue.severity === 'high' ? 'text-red-500' : 'text-amber-500'}`} />
                          <span className="text-sm">{issue.message}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* TAB: CONTACTS */}
            <TabsContent value="contacts">
              <Card className="border-border/50">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div>
                    <CardTitle>Discovered Contacts</CardTitle>
                    <CardDescription>Extracted via automated python scraper</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="bg-primary/5">
                      {result.contacts?.length || 0} Total
                    </Badge>
                    <Badge variant="outline" className="bg-primary/5">
                      {result.contacts?.filter((c: any) => c.decision_maker).length || 0} Decision Makers
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>LinkedIn</TableHead>
                        <TableHead className="text-right">Decision Maker</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.contacts?.length > 0 ? (
                        result.contacts.map((contact: any, idx: number) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{contact.name}</TableCell>
                            <TableCell>{contact.title || '-'}</TableCell>
                            <TableCell>{contact.email ? <a href={`mailto:${contact.email}`} className="text-blue-500 hover:underline">{contact.email}</a> : '-'}</TableCell>
                            <TableCell>{contact.phone || '-'}</TableCell>
                            <TableCell>
                              {contact.linkedin ? (
                                <a href={contact.linkedin} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">Profile</a>
                              ) : '-'}
                            </TableCell>
                            <TableCell className="text-right">
                              {contact.decision_maker ? <Badge className="bg-green-500">Yes</Badge> : <Badge variant="secondary">No</Badge>}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                            No contacts were discovered on this domain.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB: TECHNOLOGY */}
            <TabsContent value="technology" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border-border/50">
                  <CardHeader>
                    <CardTitle>Tech Stack Detection</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg border border-border/40">
                      <span className="font-medium">SSL Enabled</span>
                      <StatusIcon status={result.audit?.sslEnabled} />
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg border border-border/40">
                      <span className="font-medium">Mobile Friendly</span>
                      <StatusIcon status={result.audit?.mobileFriendly} />
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg border border-border/40">
                      <span className="font-medium">Contact Form</span>
                      <StatusIcon status={result.audit?.hasContactForm} />
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg border border-border/40">
                      <span className="font-medium">WhatsApp Widget</span>
                      <StatusIcon status={result.audit?.hasWhatsAppWidget} />
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg border border-border/40">
                      <span className="font-medium">CRM System</span>
                      <StatusIcon status={result.audit?.hasCrm} />
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg border border-border/40">
                      <span className="font-medium">Booking System</span>
                      <StatusIcon status={result.audit?.hasBookingSystem} />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/50">
                  <CardHeader>
                    <CardTitle>Social Presence</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {result.audit?.socialLinksFound?.length > 0 ? (
                      <div className="space-y-3">
                        {result.audit.socialLinksFound.map((link: string, idx: number) => {
                          let platform = 'Link';
                          if (link.includes('facebook.com')) platform = 'Facebook';
                          if (link.includes('instagram.com')) platform = 'Instagram';
                          if (link.includes('linkedin.com')) platform = 'LinkedIn';
                          if (link.includes('twitter.com') || link.includes('x.com')) platform = 'X (Twitter)';
                          if (link.includes('youtube.com')) platform = 'YouTube';

                          return (
                            <div key={idx} className="flex items-center gap-3 p-3 bg-muted/20 rounded-lg border border-border/40">
                              <Badge variant="outline">{platform}</Badge>
                              <a href={link} target="_blank" rel="noreferrer" className="text-sm text-blue-500 hover:underline truncate">
                                {link}
                              </a>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center p-6 bg-muted/10 rounded-lg border border-dashed">
                        <p className="text-muted-foreground">No social media profiles detected.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* TAB: AI INSIGHTS */}
            <TabsContent value="ai-insights">
              <Card className="border-border/50 flex flex-col">
                <CardHeader>
                  <CardTitle>LLM Extracted Data</CardTitle>
                  <CardDescription>Generated by local Ollama pipeline</CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  {!result.audit?.extractedCompanyInfo ? (
                    <div className="h-64 flex flex-col items-center justify-center text-center p-6 border border-dashed border-border/60 rounded-lg bg-muted/10">
                      <BrainCircuit className="w-10 h-10 text-muted-foreground/50 mb-3" />
                      <p className="text-lg font-medium text-muted-foreground">AI extraction was skipped.</p>
                      <p className="text-sm text-muted-foreground/80 mt-1">Run a Deep Pipeline execution to extract this data.</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1">Industry</p>
                          <Badge variant="outline" className="text-sm py-1">{result.audit.extractedCompanyInfo.industry || 'Unknown'}</Badge>
                          {result.audit.extractedCompanyInfo.industry_confidence && (
                            <span className="text-xs text-muted-foreground ml-2">({result.audit.extractedCompanyInfo.industry_confidence}% confidence)</span>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1">Employee Est.</p>
                          <p className="text-foreground font-medium">
                            {result.audit.extractedCompanyInfo.employee_count ? `~${result.audit.extractedCompanyInfo.employee_count}` : "Unknown"}
                          </p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1">Location</p>
                          <p className="text-foreground font-medium">
                            {[result.audit.extractedCompanyInfo.city, result.audit.extractedCompanyInfo.state_province, result.audit.extractedCompanyInfo.country].filter(Boolean).join(", ") || "Not found"}
                          </p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1">Business Description</p>
                          <p className="text-base leading-relaxed text-foreground/90 bg-muted/30 p-4 rounded-lg border border-border/50">
                            {result.audit.extractedCompanyInfo.description || "Not found"}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB: DEBUG */}
            <TabsContent value="debug" className="space-y-6">
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle>Performance Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-muted/30 p-4 rounded-lg border border-border/50 text-center">
                      <p className="text-sm text-muted-foreground mb-1">Audit Fetch Time</p>
                      <p className={`font-mono font-bold text-lg ${result.metrics?.fetchTimeMs > 5000 ? 'text-red-500' : ''}`}>
                        {result.metrics?.fetchTimeMs || 0}ms
                      </p>
                    </div>
                    <div className="bg-muted/30 p-4 rounded-lg border border-border/50 text-center">
                      <p className="text-sm text-muted-foreground mb-1">Audit Parse Time</p>
                      <p className="font-mono font-bold text-lg">{result.metrics?.parseTimeMs || 0}ms</p>
                    </div>
                    <div className="bg-muted/30 p-4 rounded-lg border border-border/50 text-center">
                      <p className="text-sm text-muted-foreground mb-1">AI Inference Time</p>
                      <p className={`font-mono font-bold text-lg ${result.metrics?.aiTimeMs > 10000 ? 'text-red-500' : ''}`}>
                        {result.metrics?.aiTimeMs || 0}ms
                      </p>
                    </div>
                    <div className="bg-muted/30 p-4 rounded-lg border border-border/50 text-center">
                      <p className="text-sm text-muted-foreground mb-1">Discovery Scrape Time</p>
                      <p className="font-mono font-bold text-lg text-primary">{result.metrics?.discoveryTimeMs || 0}ms</p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    {result.metrics?.fetchTimeMs > 5000 && (
                      <div className="flex items-center gap-2 text-red-500 text-sm">
                        <AlertTriangle className="w-4 h-4" /> Website response time is slow.
                      </div>
                    )}
                    {result.metrics?.aiTimeMs > 10000 && (
                      <div className="flex items-center gap-2 text-amber-500 text-sm">
                        <AlertTriangle className="w-4 h-4" /> AI analysis is the primary bottleneck.
                      </div>
                    )}
                    {result.metrics?.pythonTimeouts > 0 && (
                      <div className="flex items-center gap-2 text-red-500 text-sm">
                        <AlertTriangle className="w-4 h-4" /> Python discovery scraper hit its execution timeout.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Contact Validation Observability */}
              {result.debug?.contactDiscovery && (
                <Card className="border-border/50">
                  <CardHeader>
                    <CardTitle>Contact Validation Flow</CardTitle>
                    <CardDescription>Trace how Python contacts are filtered by the Node.js Engine</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between text-center bg-muted/20 p-6 rounded-lg border border-border/50">
                      <div>
                        <p className="text-sm text-muted-foreground uppercase tracking-wide">Python Scraped</p>
                        <p className="text-3xl font-bold">{result.debug.contactDiscovery.pythonContactsFound}</p>
                      </div>
                      <div className="text-muted-foreground/50">➔</div>
                      <div>
                        <p className="text-sm text-red-500 uppercase tracking-wide">Rejected</p>
                        <p className="text-3xl font-bold text-red-500">{result.debug.contactDiscovery.contactsRejected}</p>
                      </div>
                      <div className="text-muted-foreground/50">➔</div>
                      <div>
                        <p className="text-sm text-green-500 uppercase tracking-wide">Validated</p>
                        <p className="text-3xl font-bold text-green-500">{result.debug.contactDiscovery.contactsAfterValidation}</p>
                      </div>
                    </div>

                    {result.debug.contactDiscovery.rejectedContacts?.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-3">Rejected Contacts Trace</h4>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Original Name</TableHead>
                              <TableHead>Original Title</TableHead>
                              <TableHead>Email</TableHead>
                              <TableHead>Rejection Reason</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {result.debug.contactDiscovery.rejectedContacts.map((c: any, idx: number) => (
                              <TableRow key={idx}>
                                <TableCell className="font-medium text-red-400">{c.originalName || 'N/A'}</TableCell>
                                <TableCell>{c.originalTitle || '-'}</TableCell>
                                <TableCell>{c.email || '-'}</TableCell>
                                <TableCell>
                                  <Badge variant="destructive" className="bg-red-500/10 text-red-500 hover:bg-red-500/20">{c.reason}</Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* AI Observability */}
              {result.debug?.ollama && (
                <Card className="border-border/50">
                  <CardHeader>
                    <CardTitle>AI Extraction Stream</CardTitle>
                    <CardDescription>Ollama qwen3:8b integration trace</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {result.debug.ollama.parseError && (
                      <div className="p-4 bg-red-500/10 text-red-500 rounded-lg border border-red-500/20">
                        <span className="font-semibold">JSON Parse Error:</span> {result.debug.ollama.parseError}
                      </div>
                    )}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <p className="text-sm font-semibold mb-2">Prompt Sent to Ollama (Preview)</p>
                        <div className="bg-zinc-950 p-4 rounded-lg overflow-y-auto h-64 border border-zinc-800">
                          <pre className="text-xs text-zinc-300 font-mono whitespace-pre-wrap">{result.debug.ollama.promptPreview}</pre>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-semibold mb-2">Raw Ollama Response</p>
                        <div className="bg-zinc-950 p-4 rounded-lg overflow-y-auto h-64 border border-zinc-800">
                          <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap">{result.debug.ollama.rawOllamaResponse}</pre>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle>Raw JSON Payload</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-zinc-950 text-zinc-50 p-4 rounded-lg overflow-x-auto max-h-[500px] overflow-y-auto">
                    <pre className="text-xs font-mono">
                      {JSON.stringify(result, null, 2)}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}
