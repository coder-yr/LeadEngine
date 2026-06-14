import { IntelligenceData } from "@/types/lead";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BrainCircuit, Lightbulb, Rocket } from "lucide-react";

interface AIInsightsTabProps {
  intelligence: IntelligenceData;
}

export function AIInsightsTab({ intelligence }: AIInsightsTabProps) {
  return (
    <div className="space-y-6">
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BrainCircuit className="w-5 h-5 text-primary" />
            AI Lead Analysis
          </CardTitle>
          <CardDescription>
            Automated intelligence based on digital footprint maturity.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed font-medium">
            {intelligence.aiInsights}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Rocket className="w-4 h-4 text-blue-500" />
              Services Needed
            </CardTitle>
          </CardHeader>
          <CardContent>
            {intelligence.servicesNeeded.length === 0 ? (
              <p className="text-sm text-muted-foreground">No specific services identified yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {intelligence.servicesNeeded.map((service, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-3 rounded-md bg-muted/50 border text-sm font-medium">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    {service}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lightbulb className="w-4 h-4 text-yellow-500" />
              Scoring Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Digital Maturity Score</span>
                <span className="font-bold">{intelligence.digitalMaturityScore}/100</span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-yellow-500" 
                  style={{ width: `${intelligence.digitalMaturityScore}%` }}
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Sales Priority (Lead Score)</span>
                <span className="font-bold">{intelligence.leadScore}/100</span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-green-500" 
                  style={{ width: `${intelligence.leadScore}%` }}
                />
              </div>
            </div>
            
            <p className="text-xs text-muted-foreground pt-2">
              Note: A lower digital maturity often results in a higher lead score, as there are more service opportunities to pitch.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
