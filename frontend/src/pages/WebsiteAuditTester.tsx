import { useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Globe, CheckCircle2, XCircle, AlertTriangle, Activity, Code, Target, BrainCircuit, Users } from "lucide-react";

export default function WebsiteAuditTester() {
  const [url, setUrl] = useState("");
  const [isDeepAudit, setIsDeepAudit] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRunAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    let normalizedUrl = url;
    if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
      normalizedUrl = `https://${normalizedUrl}`;
      setUrl(normalizedUrl);
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await api.post(`/audit/test`, {
        url: normalizedUrl,
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
              <div className="space-y-6">
                <Card className="border-border/50">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div>
                      <CardTitle className="text-blue-500 flex items-center gap-2">Leadership & Executives</CardTitle>
                      <CardDescription>Founders, CEOs, Directors</CardDescription>
                    </div>
                    <Badge variant="outline" className="bg-blue-500/10 text-blue-500">
                      {result.contacts?.filter((c: any) => c.contactCategory === 'LEADERSHIP_CONTACT').length || 0} Found
                    </Badge>
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
                          <TableHead>Confidence</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {result.contacts?.filter((c: any) => c.contactCategory === 'LEADERSHIP_CONTACT').length > 0 ? (
                          result.contacts.filter((c: any) => c.contactCategory === 'LEADERSHIP_CONTACT').map((contact: any, idx: number) => (
                            <TableRow key={idx}>
                              <TableCell className="font-medium text-blue-600">{contact.name}</TableCell>
                              <TableCell>{contact.title || '-'}</TableCell>
                              <TableCell>{contact.email ? <a href={`mailto:${contact.email}`} className="text-blue-500 hover:underline">{contact.email}</a> : '-'}</TableCell>
                              <TableCell>{contact.phone || '-'}</TableCell>
                              <TableCell>
                                {contact.linkedin ? (
                                  <a href={contact.linkedin} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">Profile</a>
                                ) : '-'}
                              </TableCell>
                              <TableCell>
                                <Badge className="bg-blue-500/20 text-blue-600 shadow-none hover:bg-blue-500/30">
                                  {contact.confidence_score}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center h-16 text-muted-foreground">
                              No leadership contacts found.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card className="border-border/50">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div>
                      <CardTitle className="text-emerald-500 flex items-center gap-2">Team Members</CardTitle>
                      <CardDescription>Other human employees found on the site</CardDescription>
                    </div>
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500">
                      {result.contacts?.filter((c: any) => c.contactCategory === 'TEAM_CONTACT').length || 0} Found
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Title</TableHead>
                          <TableHead>Confidence</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {result.contacts?.filter((c: any) => c.contactCategory === 'TEAM_CONTACT').length > 0 ? (
                          result.contacts.filter((c: any) => c.contactCategory === 'TEAM_CONTACT').map((contact: any, idx: number) => (
                            <TableRow key={idx}>
                              <TableCell className="font-medium text-emerald-600">{contact.name}</TableCell>
                              <TableCell>{contact.title || '-'}</TableCell>
                              <TableCell>
                                <Badge className="bg-emerald-500/20 text-emerald-600 shadow-none hover:bg-emerald-500/30">
                                  {contact.confidence_score}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center h-16 text-muted-foreground">
                              No team members found.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="border-border/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-amber-500">Business & Support Contacts</CardTitle>
                      <CardDescription>Emails, phones, and WhatsApp extracted from footer and contact pages</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-5 mt-2">
                        {/* Emails */}
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                            <span className="text-base">📧</span> Email
                          </p>
                          {result.businessContacts?.filter((bc: any) => bc.type === 'EMAIL').length > 0 ? (
                            <div className="space-y-2">
                              {result.businessContacts.filter((bc: any) => bc.type === 'EMAIL').map((bc: any, idx: number) => (
                                <div key={idx} className="flex justify-between items-center p-3 border rounded-lg bg-muted/20">
                                  <a href={`mailto:${bc.value}`} className="text-blue-500 hover:underline font-medium text-sm">{bc.value}</a>
                                  <Badge variant="secondary" className="text-xs">Footer</Badge>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground pl-1">No email found</p>
                          )}
                        </div>

                        {/* Phones */}
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                            <span className="text-base">📞</span> Phone
                          </p>
                          {result.businessContacts?.filter((bc: any) => bc.type === 'PHONE').length > 0 ? (
                            <div className="space-y-2">
                              {result.businessContacts.filter((bc: any) => bc.type === 'PHONE').map((bc: any, idx: number) => (
                                <div key={idx} className="flex justify-between items-center p-3 border rounded-lg bg-muted/20">
                                  <span className="font-medium text-sm">{bc.value}</span>
                                  <Badge variant="secondary" className="text-xs">Footer</Badge>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground pl-1">No phone found</p>
                          )}
                        </div>

                        {/* WhatsApp */}
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                            <span className="text-base">💬</span> WhatsApp
                          </p>
                          {result.businessContacts?.filter((bc: any) => bc.type === 'WHATSAPP').length > 0 ? (
                            <div className="space-y-2">
                              {result.businessContacts.filter((bc: any) => bc.type === 'WHATSAPP').map((bc: any, idx: number) => (
                                <div key={idx} className="flex justify-between items-center p-3 border rounded-lg bg-muted/20">
                                  <a href={bc.value} target="_blank" rel="noreferrer" className="text-green-500 hover:underline font-medium text-sm">{bc.value}</a>
                                  <Badge variant="secondary" className="text-xs">WhatsApp</Badge>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground pl-1">No WhatsApp found</p>
                          )}
                        </div>

                        {/* Address */}
                        {result.businessContacts?.filter((bc: any) => bc.type === 'ADDRESS').length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                              <span className="text-base">📍</span> Address
                            </p>
                            <div className="space-y-2">
                              {result.businessContacts.filter((bc: any) => bc.type === 'ADDRESS').map((bc: any, idx: number) => (
                                <div key={idx} className="p-3 border rounded-lg bg-muted/20">
                                  <span className="text-sm">{bc.value}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-border/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-purple-500">Social Profiles & Contact Pages</CardTitle>
                      <CardDescription>Discovered social media links and contact forms</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4 mt-2">
                        {result.socialProfiles?.map((sp: any, idx: number) => (
                           <div key={`sp-${idx}`} className="p-3 border rounded-lg bg-muted/20 truncate">
                             <span className="text-xs text-muted-foreground uppercase mr-2">{sp.platform}</span>
                             <a href={sp.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-blue-500 hover:underline">{sp.url}</a>
                           </div>
                        ))}
                        {result.contactPages?.map((cp: string, idx: number) => (
                           <div key={`cp-${idx}`} className="p-3 border rounded-lg bg-muted/20 truncate">
                             <span className="text-xs text-muted-foreground uppercase mr-2">Contact Page</span>
                             <a href={cp} target="_blank" rel="noreferrer" className="text-sm font-medium text-blue-500 hover:underline">{cp}</a>
                           </div>
                        ))}
                        {!result.socialProfiles?.length && !result.contactPages?.length && (
                          <p className="text-center text-sm text-muted-foreground py-4">No external profiles or contact forms found.</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
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
                          {result.audit.extractedCompanyInfo.confidence && (
                            <Badge className="ml-2 bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 shadow-none">
                              {result.audit.extractedCompanyInfo.confidence}% Confidence
                            </Badge>
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
                        {result.audit.extractedCompanyInfo.evidence?.length > 0 && (
                          <div className="col-span-2 mt-4">
                            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                              <Target className="w-4 h-4" /> Classification Evidence
                            </p>
                            <div className="bg-primary/5 p-4 rounded-lg border border-primary/20">
                              <ul className="list-disc pl-5 space-y-2">
                                {result.audit.extractedCompanyInfo.evidence.map((ev: string, idx: number) => (
                                  <li key={idx} className="text-sm text-foreground/90">{ev}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        )}
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
              {result.metrics && (
                <Card className="border-border/50">
                  <CardHeader>
                    <CardTitle>Discovery Health Metrics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <div className="bg-muted/30 p-4 rounded-lg border border-border/50 text-center">
                        <p className="text-sm text-muted-foreground mb-1">Status</p>
                        <p className={`font-mono font-bold text-lg ${result.metrics?.discoveryStatus === 'SUCCESS' ? 'text-green-500' : 'text-red-500'}`}>
                          {result.metrics?.discoveryStatus || 'UNKNOWN'}
                        </p>
                      </div>
                      <div className="bg-muted/30 p-4 rounded-lg border border-border/50 text-center">
                        <p className="text-sm text-muted-foreground mb-1">Fetch Succeeded</p>
                        <p className="font-mono font-bold text-lg">{result.metrics?.fetchSucceeded ? 'TRUE' : 'FALSE'}</p>
                      </div>
                      <div className="bg-muted/30 p-4 rounded-lg border border-border/50 text-center">
                        <p className="text-sm text-muted-foreground mb-1">Pages Visited</p>
                        <p className="font-mono font-bold text-lg">{result.metrics?.pagesVisited || 0}</p>
                      </div>
                      <div className="bg-muted/30 p-4 rounded-lg border border-border/50 text-center">
                        <p className="text-sm text-muted-foreground mb-1">Fallback Used</p>
                        <p className="font-mono font-bold text-lg">{result.metrics?.fallbackCandidatesFound > 0 ? 'TRUE' : 'FALSE'}</p>
                      </div>
                      <div className="bg-muted/30 p-4 rounded-lg border border-border/50 text-center">
                        <p className="text-sm text-muted-foreground mb-1">Footer Detected</p>
                        <p className="font-mono font-bold text-lg">{result.metrics?.footerDetected ? 'TRUE' : 'FALSE'}</p>
                      </div>
                      <div className="bg-muted/30 p-4 rounded-lg border border-border/50 text-center">
                        <p className="text-sm text-muted-foreground mb-1">Footer Emails</p>
                        <p className="font-mono font-bold text-lg">{result.metrics?.footerEmailsFound || 0}</p>
                      </div>
                      <div className="bg-muted/30 p-4 rounded-lg border border-border/50 text-center">
                        <p className="text-sm text-muted-foreground mb-1">Footer Phones</p>
                        <p className="font-mono font-bold text-lg">{result.metrics?.footerPhonesFound || 0}</p>
                      </div>
                      <div className="bg-muted/30 p-4 rounded-lg border border-border/50 text-center">
                        <p className="text-sm text-muted-foreground mb-1">Footer Addresses</p>
                        <p className="font-mono font-bold text-lg">{result.metrics?.footerAddressesFound || 0}</p>
                      </div>
                      <div className="bg-muted/30 p-4 rounded-lg border border-border/50 text-center">
                        <p className="text-sm text-muted-foreground mb-1">Social Profiles</p>
                        <p className="font-mono font-bold text-lg">{result.metrics?.socialProfilesFound || 0}</p>
                      </div>
                      <div className="bg-muted/30 p-4 rounded-lg border border-border/50 text-center">
                        <p className="text-sm text-muted-foreground mb-1">Contact Pages</p>
                        <p className="font-mono font-bold text-lg">{result.metrics?.contactPagesFound || 0}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Contact Validation Observability */}
              {result.debug?.contactDiscovery && (
                <Card className="border-border/50">
                  <CardHeader>
                    <CardTitle>Contact Validation Flow</CardTitle>
                    <CardDescription>Trace how Python contacts are filtered by the Node.js Engine</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4 bg-muted/20 p-6 rounded-lg border border-border/50 text-center">
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Raw Text Nodes</p>
                        <p className="text-2xl font-bold">{result.debug.contactDiscovery.rawTextNodesScanned || 0}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Profile Containers</p>
                        <p className="text-2xl font-bold text-blue-400">{result.debug.contactDiscovery.profileContainersDetected || 0}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Candidates Generated</p>
                        <p className="text-2xl font-bold text-indigo-400">{result.debug.contactDiscovery.candidatesGenerated || 0}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Pre-Gen Rejects</p>
                        <p className="text-2xl font-bold text-yellow-500">{result.debug.contactDiscovery.candidatesRejectedPreGeneration || 0}</p>
                      </div>
                      
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Validation Rejects</p>
                        <p className="text-2xl font-bold text-red-500">{result.debug.contactDiscovery.contactsRejected || 0}</p>
                      </div>
                      <div>
                        <p className="text-xs text-green-500 uppercase tracking-wide">Final Validated</p>
                        <p className="text-2xl font-bold text-green-500">{result.debug.contactDiscovery.validatedContacts || 0}</p>
                      </div>
                      <div>
                        <p className="text-xs text-emerald-500 uppercase tracking-wide">Decision Makers</p>
                        <p className="text-2xl font-bold text-emerald-500">{result.debug.contactDiscovery.decisionMakersFound || 0}</p>
                      </div>
                      <div>
                        <p className="text-xs text-purple-500 uppercase tracking-wide">Generator Precision</p>
                        <p className="text-2xl font-bold text-purple-500">
                          {result.debug.contactDiscovery.candidatesGenerated > 0 
                            ? Math.round((result.debug.contactDiscovery.validatedContacts / result.debug.contactDiscovery.candidatesGenerated) * 100) 
                            : 0}%
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-orange-500 uppercase tracking-wide">Section Labels Rej.</p>
                        <p className="text-2xl font-bold text-orange-500">{result.debug.contactDiscovery.sectionLabelsRejected || 0}</p>
                      </div>
                      <div>
                        <p className="text-xs text-orange-500 uppercase tracking-wide">LinkedIn Identity Fail</p>
                        <p className="text-2xl font-bold text-orange-500">{result.debug.contactDiscovery.linkedinOwnershipFailures || 0}</p>
                      </div>
                      <div>
                        <p className="text-xs text-orange-500 uppercase tracking-wide">Score Clamps</p>
                        <p className="text-2xl font-bold text-orange-500">{result.debug.contactDiscovery.scoreClampEvents || 0}</p>
                      </div>
                      <div>
                        <p className="text-xs text-orange-500 uppercase tracking-wide">Duplicates Merged</p>
                        <p className="text-2xl font-bold text-orange-500">{result.debug.contactDiscovery.duplicatesMerged || 0}</p>
                      </div>
                      <div>
                        <p className="text-xs text-red-600 uppercase tracking-wide font-semibold">Product Names Rej. (Node)</p>
                        <p className="text-2xl font-bold text-red-600">{result.debug.contactDiscovery.rejectedAsProductNames || 0}</p>
                      </div>
                      <div>
                        <p className="text-xs text-red-600 uppercase tracking-wide font-semibold">Product Names Rej. (Python)</p>
                        <p className="text-2xl font-bold text-red-600">{result.debug.contactDiscovery.candidatesRejectedAsProductNames || 0}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wide">Unknown Persons Rej.</p>
                        <p className="text-2xl font-bold text-slate-500">{result.debug.contactDiscovery.rejectedAsUnknownPersons || 0}</p>
                      </div>
                    </div>



                    {result.debug.contactDiscovery.rejectedMenuItems > 0 && (
                      <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-md">
                        <h4 className="font-semibold text-yellow-600 flex items-center gap-2 mb-3">
                          Rejected Menu Items
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {result.debug.contactDiscovery.rejectedContacts
                            ?.filter((c: any) => c.reason === 'MENU_ITEM_DETECTED')
                            .map((c: any, idx: number) => (
                              <div key={idx} className="text-sm bg-background p-2 rounded border">
                                <span className="font-medium text-foreground">{c.originalName}</span>
                                {c.originalTitle && <div className="text-xs text-muted-foreground">{c.originalTitle}</div>}
                                <div className="text-[10px] text-yellow-600 mt-1 uppercase">Reason: MENU_ITEM_DETECTED</div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {result.contacts?.some((c: any) => c.category === 'validated') && (
                      <div>
                        <h4 className="font-semibold mb-3 text-green-500">Accepted Contacts Trace</h4>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Name</TableHead>
                              <TableHead>Title</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead>Score</TableHead>
                              <TableHead>Reasons</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {result.contacts.filter((c: any) => c.category === 'validated').map((c: any, idx: number) => (
                              <TableRow key={idx}>
                                <TableCell className="font-medium text-green-400">{c.name}</TableCell>
                                <TableCell>{c.title || '-'}</TableCell>
                                <TableCell><Badge variant="outline">{c.candidate_type || 'PERSON'}</Badge></TableCell>
                                <TableCell><Badge className="bg-green-500">{c.confidence_score}</Badge></TableCell>
                                <TableCell>
                                  <ul className="list-disc pl-4 text-xs text-muted-foreground">
                                    {c.reasons?.map((r: string, i: number) => <li key={i}>{r}</li>)}
                                  </ul>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}

                    {result.contacts?.some((c: any) => c.category === 'probable') && (
                      <div>
                        <h4 className="font-semibold mb-3 text-blue-500">Probable Humans Trace</h4>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Name</TableHead>
                              <TableHead>Title</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead>Score</TableHead>
                              <TableHead>Reasons</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {result.contacts.filter((c: any) => c.category === 'probable').map((c: any, idx: number) => (
                              <TableRow key={idx}>
                                <TableCell className="font-medium text-blue-400">{c.name}</TableCell>
                                <TableCell>{c.title || '-'}</TableCell>
                                <TableCell><Badge variant="outline">{c.candidate_type || 'PERSON'}</Badge></TableCell>
                                <TableCell><Badge variant="secondary" className="text-blue-500 border-blue-500">{c.confidence_score}</Badge></TableCell>
                                <TableCell>
                                  <ul className="list-disc pl-4 text-xs text-muted-foreground">
                                    {c.reasons?.map((r: string, i: number) => <li key={i}>{r}</li>)}
                                  </ul>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}

                    {result.debug.contactDiscovery.rejectedContacts?.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-3 text-red-500">Rejected Contacts Trace</h4>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Original Name</TableHead>
                              <TableHead>Original Title</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead>Score</TableHead>
                              <TableHead>Rejection Reason</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {result.debug.contactDiscovery.rejectedContacts.map((c: any, idx: number) => (
                              <TableRow key={idx}>
                                <TableCell className="font-medium text-red-400">{c.originalName || 'N/A'}</TableCell>
                                <TableCell>{c.originalTitle || '-'}</TableCell>
                                <TableCell><Badge variant="outline">{c.candidate_type || 'UNKNOWN'}</Badge></TableCell>
                                <TableCell>{c.score}</TableCell>
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

              {/* Extraction Metrics */}
              {result.metrics && (
                <Card className="border-border/50">
                  <CardHeader>
                    <CardTitle>Ollama Context Pollution Metrics</CardTitle>
                    <CardDescription>Metrics tracked during python extraction</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-zinc-950 text-zinc-50 p-4 rounded-lg overflow-x-auto overflow-y-auto">
                      <pre className="text-xs font-mono">
{JSON.stringify({
  summaryLength: result.metrics.summaryLength,
  metaLength: result.metrics.metaLength,
  heroLength: result.metrics.heroLength,
  aboutLength: result.metrics.aboutLength,
  servicesLength: result.metrics.servicesLength
}, null, 2)}
                      </pre>
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

