export interface CompanyIntelligence {
  websiteScore: number;
  leadScore: number;
  socialPresence: boolean;
  whatsappPresence: boolean;
  crmPresence: boolean;
  bookingPresence: boolean;
  aiInsight: string;
  recommendedServices: string[];
}

export interface Company {
  id: string;
  name: string;
  website: string;
  industry: string;
  intelligence: CompanyIntelligence;
  lastAudited: string;
  auditStatus?: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
}

export const MOCK_COMPANIES: Company[] = [
  {
    id: "1",
    name: "Apex Manufacturing Solutions",
    website: "apexmanufacturing.com",
    industry: "Manufacturing",
    lastAudited: new Date().toISOString(),
    intelligence: {
      websiteScore: 42,
      leadScore: 95,
      socialPresence: false,
      whatsappPresence: false,
      crmPresence: false,
      bookingPresence: false,
      aiInsight: "This company has a very outdated website and zero modern integrations (No WhatsApp, No CRM). Extremely high probability lead for a complete digital transformation package.",
      recommendedServices: ["Website Development", "CRM Development", "WhatsApp Automation"],
    }
  },
  {
    id: "2",
    name: "Summit Real Estate Group",
    website: "summitrealestate.net",
    industry: "Real Estate",
    lastAudited: new Date(Date.now() - 86400000).toISOString(),
    intelligence: {
      websiteScore: 88,
      leadScore: 70,
      socialPresence: true,
      whatsappPresence: true,
      crmPresence: true,
      bookingPresence: false,
      aiInsight: "Strong digital presence with WhatsApp and a detected CRM. Missing automated booking systems. High probability for an AI chatbot or scheduling integration.",
      recommendedServices: ["AI Chatbot", "Scheduling Integration"],
    }
  },
  {
    id: "3",
    name: "Lumina Dental Care",
    website: "luminadental.io",
    industry: "Healthcare",
    lastAudited: new Date(Date.now() - 86400000 * 2).toISOString(),
    intelligence: {
      websiteScore: 75,
      leadScore: 85,
      socialPresence: true,
      whatsappPresence: false,
      crmPresence: false,
      bookingPresence: true,
      aiInsight: "Has a modern website and booking flow, but lacks automated followup and direct messaging. Pitch WhatsApp API for appointment reminders.",
      recommendedServices: ["WhatsApp Automation", "CRM Development"],
    }
  },
  {
    id: "4",
    name: "Horizon Law Partners",
    website: "horizonlaw.com",
    industry: "Legal Services",
    lastAudited: new Date(Date.now() - 86400000 * 5).toISOString(),
    intelligence: {
      websiteScore: 50,
      leadScore: 90,
      socialPresence: false,
      whatsappPresence: false,
      crmPresence: false,
      bookingPresence: false,
      aiInsight: "Minimal digital footprint. Website is slow and lacks basic lead capture. High probability lead for SEO and a new modern website.",
      recommendedServices: ["Website Development", "SEO", "CRM Development"],
    }
  }
];
