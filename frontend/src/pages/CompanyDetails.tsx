import { useParams, Link } from "react-router-dom"
import { useState, useEffect } from "react"
import axios from "axios"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  Building2, Globe, ArrowLeft, Mail, Phone, CalendarDays
} from "lucide-react"

// Import tabs
import { LeadOverviewTab } from "@/components/leads/tabs/LeadOverviewTab"
import { WebsiteAuditTab } from "@/components/leads/tabs/WebsiteAuditTab"
import { AIInsightsTab } from "@/components/leads/tabs/AIInsightsTab"
import { ActivityTimelineTab } from "@/components/leads/tabs/ActivityTimelineTab"
import { ServicesNeededTab } from "@/components/leads/tabs/ServicesNeededTab"
import { ContactsTab } from "@/components/leads/tabs/ContactsTab"
import { CampaignsTab } from "@/components/leads/tabs/CampaignsTab"
import { ProposalsTab } from "@/components/leads/tabs/ProposalsTab"
import { AIAgentTab } from "@/components/leads/tabs/AIAgentTab"

export default function CompanyDetails() {
  const { id } = useParams();
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCompany = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`http://localhost:3000/api/companies/${id}`);
        const dbCompany = res.data;
        
        // Map backend DB objects to frontend Company schema
        const mappedCompany = {
          id: dbCompany.id,
          name: dbCompany.name,
          website: dbCompany.website_url,
          industry: dbCompany.industry || 'Unknown',
          city: dbCompany.city || null,
          state_province: dbCompany.state_province || null,
          address: dbCompany.address || null,
          employee_count: dbCompany.employee_count || null,
          lastAudited: dbCompany.created_at,
          website_audits: dbCompany.website_audits,
          intelligence: {
            leadScore: dbCompany.company_intelligence?.[0]?.lead_score || 0,
            websiteScore: dbCompany.website_audits?.[0]?.seo_score || 0,
            socialPresence: (dbCompany.website_audits?.[0]?.social_links_found?.length || 0) > 0,
            whatsappPresence: dbCompany.website_audits?.[0]?.has_whatsapp_widget || false,
            crmPresence: false,
            bookingPresence: dbCompany.website_audits?.[0]?.has_contact_form || false,
            aiInsight: "Strategic AI Insights generated successfully.",
            recommendedServices: dbCompany.company_intelligence?.[0]?.services_needed || []
          }
        };

        setCompany(mappedCompany);
      } catch (error) {
        console.error("Failed to fetch company:", error);
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchCompany();
  }, [id]);

  if (loading || !company) return <div className="p-10 text-center text-muted-foreground">Loading company profile...</div>;
  
  // Create bridge object for legacy tabs that still expect 'Lead'
  const auditData = company.website_audits?.[0] || {};
  const formattedLead = {
    id: company.id,
    name: company.name, // Will be overridden or ignored by most tabs now, except Overview
    title: "Primary Contact",
    company: company.name,
    email: "contact@" + company.website,
    intelligence: {
      digitalMaturityScore: company.intelligence.digitalMaturityScore || 0,
      aiInsights: company.intelligence.aiInsight,
      servicesNeeded: company.intelligence.recommendedServices as any,
      leadScore: company.intelligence.leadScore
    },
    audit: {
      url: `https://${company.website}`,
      auditedAt: auditData.audited_at || company.lastAudited,
      seoScore: auditData.seo_score || 0,
      mobileFriendly: auditData.mobile_friendly ?? false,
      sslEnabled: auditData.ssl_enabled ?? false,
      pageSpeedEstimate: auditData.page_speed_estimate || 0,
      hasContactForm: auditData.has_contact_form ?? false,
      hasWhatsAppWidget: auditData.has_whatsapp_widget ?? false,
      socialLinksFound: auditData.social_links_found || [],
      auditSummary: auditData.audit_summary || "Audit pending",
      issues: auditData.issues || []
    },
    activities: []
  };

  return (
    <div className="h-full flex flex-col bg-background rounded-lg border border-border shadow-sm overflow-hidden animate-in fade-in duration-500">
      {/* Top Navigation Bar */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-border bg-card">
        <Button variant="ghost" size="icon" asChild className="shrink-0">
          <Link to="/companies">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg shadow-sm">
            {company.name.charAt(0)}
          </div>
          <div>
            <h1 className="text-xl font-bold leading-none">{company.name}</h1>
            <a href={`https://${company.website}`} target="_blank" rel="noreferrer" className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1 mt-1">
              <Globe className="w-3 h-3" />
              {company.website}
            </a>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline">Log Activity</Button>
          <Button asChild>
            <a href="#proposals" onClick={() => {
              const tabTrigger = document.querySelector('[value="proposals"]') as HTMLElement;
              if (tabTrigger) tabTrigger.click();
            }}>
              Create Proposal
            </a>
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar: Profile Identity */}
        <div className="w-80 border-r border-border bg-card/50 flex flex-col overflow-y-auto hidden xl:flex">
          <div className="p-6 space-y-6">
            
            {/* About Section */}
            <div>
              <h3 className="font-semibold mb-4 flex items-center gap-2 text-foreground">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                About
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Industry</span>
                  <Badge variant="secondary">{company.industry === 'UNKNOWN' ? 'Not specified' : company.industry}</Badge>
                </div>
                <div className="flex justify-between items-start text-right">
                  <span className="text-muted-foreground shrink-0 mr-4">Location</span>
                  <span className="font-medium text-foreground text-xs leading-tight">
                    {company.city || company.state_province 
                      ? `${company.city || ''}${company.city && company.state_province ? ', ' : ''}${company.state_province || ''}` 
                      : (company.address || 'Not specified')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Employees</span>
                  <span className="font-medium text-foreground">{company.employee_count ? company.employee_count.toString() : 'Not specified'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last Audited</span>
                  <span className="font-medium text-foreground">{new Date(company.lastAudited).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            {/* Health Scores */}
            <div>
              <h3 className="font-semibold mb-4 text-foreground">Intelligence Scores</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-muted-foreground">Lead Score</span>
                    <span className="font-bold text-primary">{company.intelligence.leadScore}</span>
                  </div>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${company.intelligence.leadScore}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-muted-foreground">Website Score</span>
                    <span className="font-bold text-primary">{company.intelligence.websiteScore}</span>
                  </div>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${company.intelligence.websiteScore}%` }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="space-y-2 pt-4 border-t border-border">
              <Button variant="secondary" className="w-full justify-start text-left font-normal" size="sm">
                <Mail className="w-4 h-4 mr-2 text-muted-foreground" />
                Email Contacts
              </Button>
              <Button variant="secondary" className="w-full justify-start text-left font-normal" size="sm">
                <Phone className="w-4 h-4 mr-2 text-muted-foreground" />
                Call Primary Contact
              </Button>
              <Button variant="secondary" className="w-full justify-start text-left font-normal" size="sm">
                <CalendarDays className="w-4 h-4 mr-2 text-muted-foreground" />
                Schedule Meeting
              </Button>
            </div>

          </div>
        </div>

        {/* Main Content Area */}
        <ScrollArea className="flex-1 bg-muted/10">
          <div className="p-6 md:p-8 max-w-5xl">
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="mb-6 bg-transparent border-b border-border w-full justify-start rounded-none p-0 h-auto overflow-x-auto">
                <TabsTrigger value="overview" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-4 py-3 text-sm font-medium">Overview</TabsTrigger>
                <TabsTrigger value="audit" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-4 py-3 text-sm font-medium">Website Audit</TabsTrigger>
                <TabsTrigger value="insights" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-4 py-3 text-sm font-medium">AI Insights</TabsTrigger>
                <TabsTrigger value="services" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-4 py-3 text-sm font-medium">Services Needed</TabsTrigger>
                <TabsTrigger value="contacts" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-4 py-3 text-sm font-medium">Contacts</TabsTrigger>
                <TabsTrigger value="activities" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-4 py-3 text-sm font-medium">Activities</TabsTrigger>
                <TabsTrigger value="campaigns" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-4 py-3 text-sm font-medium">Campaigns</TabsTrigger>
                <TabsTrigger value="proposals" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-4 py-3 text-sm font-medium">Proposals</TabsTrigger>
                <TabsTrigger value="agent" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-4 py-3 text-sm font-medium text-purple-500">AI Agent</TabsTrigger>
              </TabsList>
              
              <div className="mt-4">
                <TabsContent value="overview" className="m-0 border-0 p-0"><LeadOverviewTab lead={formattedLead as any} /></TabsContent>
                <TabsContent value="audit" className="m-0 border-0 p-0">
                  <WebsiteAuditTab audit={company.website_audits && company.website_audits.length > 0 ? formattedLead.audit : undefined} />
                </TabsContent>
                <TabsContent value="insights" className="m-0 border-0 p-0"><AIInsightsTab intelligence={formattedLead.intelligence} /></TabsContent>
                <TabsContent value="services" className="m-0 border-0 p-0"><ServicesNeededTab company={company} /></TabsContent>
                <TabsContent value="contacts" className="m-0 border-0 p-0"><ContactsTab company={company} /></TabsContent>
                <TabsContent value="activities" className="m-0 border-0 p-0"><ActivityTimelineTab activities={formattedLead.activities} /></TabsContent>
                <TabsContent value="campaigns" className="m-0 border-0 p-0"><CampaignsTab company={company} /></TabsContent>
                <TabsContent value="proposals" className="m-0 border-0 p-0"><ProposalsTab companyId={company.id} /></TabsContent>
                <TabsContent value="agent" className="m-0 border-0 p-0"><AIAgentTab companyId={company.id} /></TabsContent>
              </div>
            </Tabs>
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
