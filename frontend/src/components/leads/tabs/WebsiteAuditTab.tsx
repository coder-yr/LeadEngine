import { WebsiteAudit } from "@/types/lead";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ShieldAlert, Smartphone, LayoutDashboard, Search, FormInput, MessageCircle } from "lucide-react";

interface WebsiteAuditTabProps {
  audit?: WebsiteAudit;
}

export function WebsiteAuditTab({ audit }: WebsiteAuditTabProps) {
  if (!audit) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <LayoutDashboard className="w-12 h-12 mb-4 opacity-20" />
        <p>No website audit has been run for this lead yet.</p>
      </div>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 50) return "text-yellow-500";
    return "text-red-500";
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">SEO Score</CardTitle>
            <Search className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getScoreColor(audit.seoScore)}`}>{audit.seoScore}/100</div>
            <Progress value={audit.seoScore} className="mt-3" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Page Speed</CardTitle>
            <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getScoreColor(audit.pageSpeedEstimate)}`}>{audit.pageSpeedEstimate}/100</div>
            <Progress value={audit.pageSpeedEstimate} className="mt-3" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Security (SSL)</CardTitle>
            {audit.sslEnabled ? (
              <ShieldCheck className="h-4 w-4 text-green-500" />
            ) : (
              <ShieldAlert className="h-4 w-4 text-red-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{audit.sslEnabled ? "Secured" : "Vulnerable"}</div>
            <p className="text-xs text-muted-foreground mt-1">HTTPS Connection</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mobile</CardTitle>
            <Smartphone className={`h-4 w-4 ${audit.mobileFriendly ? "text-green-500" : "text-red-500"}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{audit.mobileFriendly ? "Friendly" : "Unfriendly"}</div>
            <p className="text-xs text-muted-foreground mt-1">Viewport Metadata</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Conversion Widgets</CardTitle>
            <CardDescription>Detected lead capture mechanisms</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FormInput className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Contact Form</span>
              </div>
              <Badge variant={audit.hasContactForm ? "default" : "destructive"}>
                {audit.hasContactForm ? "Found" : "Missing"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">WhatsApp Widget</span>
              </div>
              <Badge variant={audit.hasWhatsAppWidget ? "default" : "destructive"}>
                {audit.hasWhatsAppWidget ? "Found" : "Missing"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Detected Issues</CardTitle>
            <CardDescription>Technical and SEO issues found during audit</CardDescription>
          </CardHeader>
          <CardContent>
            {audit.issues.length === 0 ? (
              <p className="text-sm text-muted-foreground">No major issues found.</p>
            ) : (
              <div className="space-y-3">
                {audit.issues.map((issue, idx) => (
                  <div key={idx} className="flex items-start gap-2 p-2 rounded-md bg-muted/50 border border-border/50 text-sm">
                    <div className="mt-0.5">
                      {issue.severity === 'high' && <ShieldAlert className="h-4 w-4 text-red-500" />}
                      {issue.severity === 'medium' && <ShieldAlert className="h-4 w-4 text-yellow-500" />}
                      {issue.severity === 'low' && <ShieldAlert className="h-4 w-4 text-blue-500" />}
                    </div>
                    <div>
                      <span className="font-semibold capitalize text-xs mr-2">{issue.type}:</span>
                      <span className="text-muted-foreground">{issue.message}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {audit.socialLinksFound.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Social Footprint</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {audit.socialLinksFound.map((link, idx) => (
                <a key={idx} href={link} target="_blank" rel="noreferrer">
                  <Badge variant="secondary" className="hover:bg-primary/20 cursor-pointer">
                    {new URL(link).hostname.replace('www.', '')}
                  </Badge>
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
