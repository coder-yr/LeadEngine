import { useParams, Link } from "react-router-dom"
import { useState, useEffect, useCallback } from "react"
import api from "@/lib/api"
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

import { ContactsTab } from "@/components/leads/tabs/ContactsTab"

import { ProposalsTab } from "@/components/leads/tabs/ProposalsTab"
import { AIAgentTab } from "@/components/leads/tabs/AIAgentTab"
import { 
  WebsiteTab, 
  LeadershipTab, 
  TechnologyTab, 
  BusinessTab,
  SocialTab,
  SignalsTab
} from "@/components/leads/tabs/KnowledgeEngineTabs"
import { AnalysisTab } from "@/components/leads/tabs/AnalysisTab"

export default function CompanyDetails() {
  const { id } = useParams();
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchCompany = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const res = await api.get(`/companies/${id}`);
      const dbCompany = res.data;
      const aiInsights = dbCompany.company_ai_insights || {};
      
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
          leadScore: dbCompany.lead_score || 0,
          aiInsight: aiInsights.summary || aiInsights.reasoning || "AI Insights pending.",
          recommendedServices: aiInsights.services_needed || [],
          opportunityScore: aiInsights.opportunity_score || dbCompany.opportunity_score || 0
        },
        analysis_status: dbCompany.analysis_status,
        analysis_progress: dbCompany.analysis_progress,
        analysis_started_at: dbCompany.analysis_started_at,
        analysis_completed_at: dbCompany.analysis_completed_at,
        analysis_duration_ms: dbCompany.analysis_duration_ms,
        analysis_confidence: dbCompany.analysis_confidence,
        analysis_error: dbCompany.analysis_error
      };

      setCompany(mappedCompany);
    } catch (error) {
      console.error("Failed to fetch company:", error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchCompany();
  }, [fetchCompany]);

  if (loading || !company) return <div className="p-10 text-center text-muted-foreground">Loading company profile...</div>;
  
  const rawWebsite = company.website || '';
  const cleanWebsite = rawWebsite.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
  const validWebsiteUrl = rawWebsite.match(/^https?:\/\//i) ? rawWebsite : (rawWebsite ? `https://${rawWebsite}` : '#');

  // Create bridge object for legacy tabs that still expect 'Lead'
  const auditData = company.website_audits?.[0] || {};
  const formattedLead = {
    id: company.id,
    name: company.name, // Will be overridden or ignored by most tabs now, except Overview
    title: "Primary Contact",
    company: company.name,
    email: cleanWebsite ? `contact@${cleanWebsite}` : "",
    intelligence: {
      digitalMaturityScore: company.intelligence.digitalMaturityScore || 0,
      aiInsights: company.intelligence.aiInsight,
      servicesNeeded: company.intelligence.recommendedServices as any,
      leadScore: company.intelligence.leadScore
    },
    audit: {
      url: validWebsiteUrl,
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
    <div className="h-full flex flex-col bg-slate-50/50 rounded-xl border border-slate-200/60 shadow-lg overflow-hidden animate-in fade-in duration-500 relative">
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-r from-indigo-100/50 via-purple-50/50 to-transparent pointer-events-none" />

      {/* Top Navigation Bar */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-4 px-4 md:px-6 py-4 border-b border-slate-200/60 bg-white/60 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild className="shrink-0 hover:bg-slate-100">
            <Link to="/companies">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </Link>
          </Button>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white flex items-center justify-center font-bold text-xl shadow-lg shadow-indigo-500/20">
              {company.name.charAt(0)}
            </div>
            <div>
              <h1 className="text-2xl font-bold leading-tight text-slate-900">{company.name}</h1>
              {cleanWebsite && (
                <a href={validWebsiteUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1.5 mt-0.5 transition-colors">
                  <Globe className="w-3.5 h-3.5" />
                  {cleanWebsite}
                </a>
              )}
            </div>
          </div>
        </div>
        <div className="md:ml-auto flex items-center gap-3 w-full md:w-auto">
          <Button variant="outline" className="flex-1 md:flex-none border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-sm">
            Log Activity
          </Button>
          <Button asChild className="flex-1 md:flex-none bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20">
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
        <div className="w-80 border-r border-slate-200/60 bg-white/60 backdrop-blur-xl flex flex-col overflow-y-auto hidden xl:flex z-10 relative">
          <div className="p-6 space-y-8">
            
            {/* About Section */}
            <div className="bg-white p-5 rounded-xl border border-slate-200/60 shadow-sm">
              <h3 className="font-semibold mb-4 flex items-center gap-2 text-slate-900">
                <Building2 className="w-4 h-4 text-indigo-500" />
                About
              </h3>
              <div className="space-y-4 text-sm">
                <div className="flex flex-col gap-1">
                  <span className="text-slate-500 text-xs font-medium uppercase tracking-wider">Industry</span>
                  <Badge variant="secondary" className="w-fit bg-indigo-50 text-indigo-700 border-indigo-100">{company.industry === 'UNKNOWN' ? 'Not specified' : company.industry}</Badge>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-slate-500 text-xs font-medium uppercase tracking-wider">Location</span>
                  <span className="font-medium text-slate-800">
                    {company.city || company.state_province 
                      ? `${company.city || ''}${company.city && company.state_province ? ', ' : ''}${company.state_province || ''}` 
                      : (company.address || 'Not specified')}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-slate-500 text-xs font-medium uppercase tracking-wider">Employees</span>
                  <span className="font-medium text-slate-800">{company.employee_count ? company.employee_count.toString() : 'Not specified'}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-slate-500 text-xs font-medium uppercase tracking-wider">Last Audited</span>
                  <span className="font-medium text-slate-800">{new Date(company.lastAudited).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            {/* Health Scores */}
            <div className="bg-white p-5 rounded-xl border border-slate-200/60 shadow-sm">
              <h3 className="font-semibold mb-4 text-slate-900">Intelligence Scores</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-600 font-medium">Lead Score</span>
                    <span className="font-bold text-indigo-600">{company.intelligence.leadScore}</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full" style={{ width: `${company.intelligence.leadScore}%` }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="space-y-2 pt-2">
              <Button variant="outline" className="w-full justify-start text-left font-normal bg-white border-slate-200 text-slate-700 hover:bg-slate-50" size="sm">
                <Mail className="w-4 h-4 mr-2 text-slate-400" />
                Email Contacts
              </Button>
              <Button variant="outline" className="w-full justify-start text-left font-normal bg-white border-slate-200 text-slate-700 hover:bg-slate-50" size="sm">
                <Phone className="w-4 h-4 mr-2 text-slate-400" />
                Call Primary Contact
              </Button>
              <Button variant="outline" className="w-full justify-start text-left font-normal bg-white border-slate-200 text-slate-700 hover:bg-slate-50" size="sm">
                <CalendarDays className="w-4 h-4 mr-2 text-slate-400" />
                Schedule Meeting
              </Button>
            </div>

          </div>
        </div>

        {/* Main Content Area */}
        <ScrollArea className="flex-1 bg-transparent z-10 relative">
          <div className="p-6 md:p-8 max-w-6xl mx-auto">
            <Tabs defaultValue="analysis" className="w-full">
              <TabsList className="mb-8 bg-white/50 backdrop-blur-sm border border-slate-200/60 rounded-xl p-1.5 h-auto overflow-x-auto flex-nowrap hide-scrollbar whitespace-nowrap flex w-fit max-w-full shadow-sm">
                <TabsTrigger value="analysis" className="data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm rounded-lg px-4 py-2.5 text-sm font-medium text-slate-500 transition-all">Analysis</TabsTrigger>
                <TabsTrigger value="overview" className="data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm rounded-lg px-4 py-2.5 text-sm font-medium text-slate-500 transition-all">Overview</TabsTrigger>
                <TabsTrigger value="website" className="data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm rounded-lg px-4 py-2.5 text-sm font-medium text-slate-500 transition-all">Website</TabsTrigger>
                <TabsTrigger value="contacts" className="data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm rounded-lg px-4 py-2.5 text-sm font-medium text-slate-500 transition-all">Contacts</TabsTrigger>
                <TabsTrigger value="leadership" className="data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm rounded-lg px-4 py-2.5 text-sm font-medium text-slate-500 transition-all">Leadership</TabsTrigger>
                <TabsTrigger value="technology" className="data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm rounded-lg px-4 py-2.5 text-sm font-medium text-slate-500 transition-all">Technology</TabsTrigger>
                <TabsTrigger value="business" className="data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm rounded-lg px-4 py-2.5 text-sm font-medium text-slate-500 transition-all">Business</TabsTrigger>
                <TabsTrigger value="social" className="data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm rounded-lg px-4 py-2.5 text-sm font-medium text-slate-500 transition-all">Social</TabsTrigger>
                <TabsTrigger value="signals" className="data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm rounded-lg px-4 py-2.5 text-sm font-medium text-slate-500 transition-all">Signals</TabsTrigger>
                <TabsTrigger value="audit" className="data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm rounded-lg px-4 py-2.5 text-sm font-medium text-slate-500 transition-all">Audit</TabsTrigger>
                <TabsTrigger value="insights" className="data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm rounded-lg px-4 py-2.5 text-sm font-medium text-slate-500 transition-all">AI Insights</TabsTrigger>
                <TabsTrigger value="proposals" className="data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm rounded-lg px-4 py-2.5 text-sm font-medium text-slate-500 transition-all">Proposal</TabsTrigger>
                <TabsTrigger value="timeline" className="data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm rounded-lg px-4 py-2.5 text-sm font-medium text-slate-500 transition-all">Timeline</TabsTrigger>
                <TabsTrigger value="agent" className="data-[state=active]:bg-white data-[state=active]:text-purple-600 data-[state=active]:shadow-sm rounded-lg px-4 py-2.5 text-sm font-medium text-slate-500 transition-all">AI Agent</TabsTrigger>
              </TabsList>
              
              <div className="mt-4">
                <TabsContent value="analysis" className="m-0">
                  <AnalysisTab company={company} onAnalysisComplete={fetchCompany} />
                </TabsContent>
                <TabsContent value="overview" className="m-0 border-0 p-0"><LeadOverviewTab lead={formattedLead as any} /></TabsContent>
                <TabsContent value="website" className="m-0 border-0 p-0"><WebsiteTab company={company} /></TabsContent>
                <TabsContent value="contacts" className="m-0 border-0 p-0"><ContactsTab company={company} /></TabsContent>
                <TabsContent value="leadership" className="m-0 border-0 p-0"><LeadershipTab company={company} /></TabsContent>
                <TabsContent value="technology" className="m-0 border-0 p-0"><TechnologyTab company={company} /></TabsContent>
                <TabsContent value="business" className="m-0 border-0 p-0"><BusinessTab company={company} /></TabsContent>
                <TabsContent value="social" className="m-0 border-0 p-0"><SocialTab company={company} /></TabsContent>
                <TabsContent value="signals" className="m-0 border-0 p-0"><SignalsTab company={company} /></TabsContent>
                <TabsContent value="audit" className="m-0 border-0 p-0"><WebsiteAuditTab audit={formattedLead.audit as any} /></TabsContent>
                <TabsContent value="insights" className="m-0 border-0 p-0"><AIInsightsTab intelligence={formattedLead.intelligence} /></TabsContent>
                <TabsContent value="proposals" className="m-0 border-0 p-0"><ProposalsTab companyId={company.id} /></TabsContent>
                <TabsContent value="timeline" className="m-0 border-0 p-0"><ActivityTimelineTab activities={formattedLead.activities} /></TabsContent>
                <TabsContent value="agent" className="m-0 border-0 p-0"><AIAgentTab companyId={company.id} /></TabsContent>
              </div>
            </Tabs>
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}

