import { Router, Request, Response } from 'express';
import { AiGateway } from '../../ai-engine/AiGateway.js';

const router = Router();

// POST /api/audit/test
// Runs the new modular AI/deterministic pipeline on-the-fly without saving to the DB.
router.post('/test', async (req: Request, res: Response) => {
  try {
    const { url, type } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    const start = Date.now();

    // 1. Smart Scrape and Discovery (Phase 2)
    const doc = await AiGateway.Website.crawl(url);

    // 2. Extract Contacts & Socials (Phase 3)
    const contacts = await AiGateway.Contacts.extractContacts(doc);

    // 3. Classify Industry & Business Model (Phase 4)
    const company = await AiGateway.Company.analyze(doc);

    // 4. Run Audit Check (Phase 6)
    const audit = await AiGateway.QuickAudit.audit(doc);

    // 5. Calculate Stateless Scores & Recommendations (Phase 7)
    const lead = AiGateway.Lead.score({ doc, audit, company, contacts });

    const totalTimeMs = Date.now() - start;

    // Map the new structured pipeline output into backward-compatible response shapes for the UI
    const mappedAudit = {
      url: audit.url,
      seoScore: audit.seoScore,
      mobileFriendly: audit.mobileFriendly,
      sslEnabled: audit.sslEnabled,
      pageSpeedEstimate: 90, // High-quality default/proxy
      hasContactForm: audit.hasContactForm,
      hasWhatsAppWidget: audit.hasWhatsAppWidget,
      hasCrm: audit.hasCrm,
      hasBookingSystem: audit.hasBookingSystem,
      hasChatbot: audit.hasChatbot,
      hasAnalytics: audit.hasAnalytics,
      socialLinksFound: audit.socialLinksFound.map(s => {
        if (s.startsWith('http')) return s;
        return `https://${s}.com`;
      }),
      auditSummary: audit.aiProfile?.companySummary || "Audit completed successfully.",
      issues: audit.issues.map(i => ({
        type: i.type,
        severity: i.severity,
        message: i.message
      })),
      extractedCompanyInfo: {
        city: undefined,
        state_province: undefined,
        country: undefined,
        employee_count: company.companySize.estimatedEmployees,
        industry: company.industry.industry,
        confidence: company.industry.confidence,
        evidence: company.companySize.evidence,
        description: company.description,
        business_model: company.businessModel.model,
        target_audience: company.targetAudience,
        services_offered: company.servicesOffered
      }
    };

    const mappedContacts = [
      ...contacts.leadership.map(c => ({
        name: c.name,
        title: c.title || 'Executive',
        email: c.email,
        phone: c.phone,
        linkedin: c.linkedin,
        confidence_score: c.confidence,
        contactCategory: 'LEADERSHIP_CONTACT'
      })),
      ...contacts.team.map(c => ({
        name: c.name,
        title: c.title || 'Team Member',
        email: c.email,
        phone: c.phone,
        linkedin: c.linkedin,
        confidence_score: c.confidence,
        contactCategory: 'TEAM_CONTACT'
      }))
    ];

    const mappedBusinessContacts = [
      ...contacts.businessContacts.emails.map(e => ({ type: 'EMAIL', value: e.email })),
      ...contacts.businessContacts.phones.map(p => ({ type: 'PHONE', value: p })),
      ...(contacts.businessContacts.whatsapp ? [{ type: 'WHATSAPP', value: contacts.businessContacts.whatsapp }] : [])
    ];

    const mappedSocialProfiles = Object.entries(contacts.socialProfiles)
      .filter(([_, val]) => !!val)
      .map(([platform, val]) => ({ platform: platform.toUpperCase(), url: val }));

    const mappedIntelligence = {
      lead_score: lead.scores.leadScore,
      intent_score: lead.scores.intentScore,
      opportunity_score: lead.scores.opportunityScore,
      digital_maturity_score: lead.scores.maturityScore,
      recommended_services: lead.servicesNeeded.map(s => ({
        service: s.service,
        confidence: s.confidence,
        reason: s.reason
      }))
    };

    return res.json({
      success: true,
      data: {
        audit: mappedAudit,
        contacts: mappedContacts,
        businessContacts: mappedBusinessContacts,
        socialProfiles: mappedSocialProfiles,
        contactPages: doc.pages,
        intelligence: mappedIntelligence,
        metrics: {
          auditTimeMs: audit.deterministicTimeMs,
          discoveryTimeMs: doc.crawlMetrics.totalTimeSec * 1000,
          pythonTimeouts: doc.crawlMetrics.totalTimeSec >= 20 ? 1 : 0,
          fetchTimeMs: doc.crawlMetrics.totalTimeSec * 1000,
          parseTimeMs: doc.crawlMetrics.cleaningTimeSec * 1000,
          aiTimeMs: audit.aiTimeMs,
          totalTimeMs
        },
        debug: {
          ollama: audit.aiProfile,
          contactDiscovery: contacts.metrics
        }
      }
    });
  } catch (error: any) {
    console.error('Test Audit Pipeline Error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Internal server error during audit pipeline execution' 
    });
  }
});

export default router;
