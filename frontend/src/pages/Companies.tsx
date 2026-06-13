import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Globe, Lightbulb, Activity } from "lucide-react"

const mockCompanies = [
  {
    id: "1",
    name: "DigitalRise Marketing",
    domain: "digitalrisemarketing.in",
    auditScore: 85,
    mobileFriendly: true,
    hasContactForm: true,
    hasWhatsApp: false,
    aiInsight: "High potential for WhatsApp automation integration.",
    industry: "Marketing",
  },
  {
    id: "2",
    name: "Local Plumbers Inc",
    domain: "localplumbers.com",
    auditScore: 42,
    mobileFriendly: false,
    hasContactForm: false,
    hasWhatsApp: false,
    aiInsight: "Needs complete website overhaul and basic lead capture.",
    industry: "Home Services",
  },
  {
    id: "3",
    name: "Tech Solutions LLC",
    domain: "techsol.net",
    auditScore: 95,
    mobileFriendly: true,
    hasContactForm: true,
    hasWhatsApp: true,
    aiInsight: "Strong digital presence. Upsell advanced CRM integration.",
    industry: "IT Services",
  }
]

export default function Companies() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Companies</h1>
          <p className="text-muted-foreground">Discovered accounts and their audit insights.</p>
        </div>
        <Button>Import Companies</Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {mockCompanies.map(company => (
          <Card key={company.id} className="flex flex-col">
            <CardHeader className="pb-4">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-xl">{company.name}</CardTitle>
                  <CardDescription className="flex items-center gap-1 mt-1">
                    <Globe className="h-3 w-3" /> {company.domain}
                  </CardDescription>
                </div>
                <Badge variant="outline" className="bg-primary/5">
                  {company.industry}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex-1 space-y-4">
              {/* Audit Summary */}
              <div className="rounded-lg bg-muted/50 p-3 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" />
                    Audit Score
                  </span>
                  <Badge variant={company.auditScore > 80 ? "default" : company.auditScore > 50 ? "secondary" : "destructive"}>
                    {company.auditScore}/100
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1">
                    <div className={`h-2 w-2 rounded-full ${company.mobileFriendly ? 'bg-green-500' : 'bg-red-500'}`} />
                    Mobile Friendly
                  </div>
                  <div className="flex items-center gap-1">
                    <div className={`h-2 w-2 rounded-full ${company.hasContactForm ? 'bg-green-500' : 'bg-red-500'}`} />
                    Contact Form
                  </div>
                  <div className="flex items-center gap-1">
                    <div className={`h-2 w-2 rounded-full ${company.hasWhatsApp ? 'bg-green-500' : 'bg-red-500'}`} />
                    WhatsApp
                  </div>
                </div>
              </div>

              {/* AI Insights */}
              <div className="space-y-2">
                <span className="text-sm font-semibold flex items-center gap-2 text-amber-500">
                  <Lightbulb className="h-4 w-4" /> AI Insights
                </span>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {company.aiInsight}
                </p>
              </div>
            </CardContent>
            <CardFooter className="border-t pt-4">
              <Button variant="secondary" className="w-full">View Full Profile</Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  )
}
