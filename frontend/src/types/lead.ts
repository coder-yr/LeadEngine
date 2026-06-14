export type ServiceRecommendation = 
  | 'Website Development'
  | 'CRM Development'
  | 'WhatsApp Automation'
  | 'AI Chatbot'
  | 'Mobile App'
  | 'SEO';

export type ActivityType = 
  | 'Discovery'
  | 'Audit'
  | 'AI_Analysis'
  | 'Email_Sent'
  | 'Note_Added';

export interface Activity {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  timestamp: string;
}

export interface AuditIssue {
  type: 'seo' | 'performance' | 'security' | 'conversion';
  message: string;
  severity: 'high' | 'medium' | 'low';
}

export interface WebsiteAudit {
  url: string;
  seoScore: number;
  mobileFriendly: boolean;
  sslEnabled: boolean;
  pageSpeedEstimate: number;
  hasContactForm: boolean;
  hasWhatsAppWidget: boolean;
  socialLinksFound: string[];
  auditSummary: string;
  issues: AuditIssue[];
  auditedAt: string;
}

export interface IntelligenceData {
  digitalMaturityScore: number;
  servicesNeeded: ServiceRecommendation[];
  leadScore: number;
  aiInsights: string;
}

export interface Lead {
  id: string;
  name: string;
  title?: string;
  company: string;
  email: string;
  phone?: string;
  status: "New" | "Contacted" | "Qualified" | "Lost";
  intelligence: IntelligenceData;
  audit?: WebsiteAudit;
  activities: Activity[];
}

export const MOCK_LEADS: Lead[] = [
  {
    id: "1",
    name: "Alice Smith",
    title: "CEO",
    company: "Acme Corp",
    email: "alice@acme.com",
    phone: "+1 555-0199",
    status: "New",
    intelligence: {
      digitalMaturityScore: 45,
      servicesNeeded: ["WhatsApp Automation", "SEO"],
      leadScore: 85,
      aiInsights: "Acme Corp has a moderate digital footprint. They have a functioning website but lack direct messaging funnels. Recommending WhatsApp Automation."
    },
    audit: {
      url: "https://acme.com",
      seoScore: 60,
      mobileFriendly: true,
      sslEnabled: true,
      pageSpeedEstimate: 85,
      hasContactForm: true,
      hasWhatsAppWidget: false,
      socialLinksFound: ["https://linkedin.com/company/acme"],
      auditSummary: "Good technical foundation but lacks conversion widgets.",
      issues: [
        { type: "conversion", message: "No WhatsApp widget detected", severity: "low" },
        { type: "seo", message: "Missing H1 on homepage", severity: "medium" }
      ],
      auditedAt: new Date().toISOString()
    },
    activities: [
      { id: "a1", type: "Discovery", title: "Lead Discovered", description: "Found via LinkedIn search", timestamp: new Date(Date.now() - 86400000 * 2).toISOString() },
      { id: "a2", type: "Audit", title: "Website Audited", description: "Completed automated scan of acme.com", timestamp: new Date(Date.now() - 86400000).toISOString() },
      { id: "a3", type: "AI_Analysis", title: "Intelligence Generated", description: "Calculated maturity score of 45", timestamp: new Date().toISOString() }
    ]
  },
  {
    id: "2",
    name: "Bob Jones",
    title: "Founder",
    company: "Globex",
    email: "bob@globex.com",
    status: "Contacted",
    intelligence: {
      digitalMaturityScore: 10,
      servicesNeeded: ["Website Development", "CRM Development"],
      leadScore: 95,
      aiInsights: "Globex currently has almost no digital presence. Prime candidate for a full Website and CRM package."
    },
    activities: [
      { id: "a4", type: "Discovery", title: "Lead Discovered", description: "Imported from CSV", timestamp: new Date(Date.now() - 86400000 * 5).toISOString() }
    ]
  },
  {
    id: "3",
    name: "Charlie Brown",
    title: "Marketing Director",
    company: "Initech",
    email: "charlie@initech.com",
    status: "Qualified",
    intelligence: {
      digitalMaturityScore: 90,
      servicesNeeded: ["AI Chatbot"],
      leadScore: 40,
      aiInsights: "Highly mature digital stack. Contact forms, WhatsApp, and CRM are already present. Pitch AI Chatbot to increase efficiency."
    },
    audit: {
      url: "https://initech.com",
      seoScore: 95,
      mobileFriendly: true,
      sslEnabled: true,
      pageSpeedEstimate: 90,
      hasContactForm: true,
      hasWhatsAppWidget: true,
      socialLinksFound: ["https://twitter.com/initech", "https://linkedin.com/company/initech"],
      auditSummary: "Excellent overall technical execution. All standard elements present.",
      issues: [],
      auditedAt: new Date().toISOString()
    },
    activities: [
      { id: "a5", type: "Discovery", title: "Lead Discovered", description: "Found via Organic Search", timestamp: new Date(Date.now() - 86400000 * 10).toISOString() }
    ]
  }
];
