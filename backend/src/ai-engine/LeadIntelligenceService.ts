import { TelemetryService } from './TelemetryService';
import { WebsiteDocument } from './WebsiteIntelligenceService';
import { QuickAuditResult } from './QuickAuditService';
import { CompanyIntelligenceResult } from './CompanyIntelligenceService';
import { ContactIntelligenceResult } from './ContactIntelligenceService';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ServiceRecommendation {
    service: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    confidence: number;
    reason: string;
    estimatedImpact: string;
}

export interface LeadScoreBreakdown {
    // Score components (each 0–100)
    intentScore: number;        // How urgently do they need our services?
    opportunityScore: number;   // How many gaps do they have?
    fitScore: number;           // Are they a good target (contact quality, digital presence)?
    maturityScore: number;      // How digitally mature are they?
    // Composite (weighted)
    leadScore: number;          // Intent×0.35 + Opportunity×0.35 + Fit×0.30
    // Grade
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    priority: 'hot' | 'warm' | 'cold' | 'skip';
}

export interface LeadIntelligenceResult {
    url: string;
    companyName?: string;
    industry: string;
    businessModel: string;
    companySize: string;
    description: string;
    targetAudience: string;
    // Scoring
    scores: LeadScoreBreakdown;
    // What they need
    servicesNeeded: ServiceRecommendation[];
    // Digital footprint
    digitalPresence: {
        hasWebsite: boolean;
        hasSsl: boolean;
        hasMobileView: boolean;
        hasContactForm: boolean;
        hasWhatsApp: boolean;
        hasBookingSystem: boolean;
        hasCrm: boolean;
        hasChatbot: boolean;
        hasAnalytics: boolean;
        socialNetworks: string[];
        technologies: string[];
        seoScore: number;
    };
    // Buying signals
    buyingSignals: {
        detected: string[];
        count: number;
        strength: 'strong' | 'moderate' | 'weak' | 'none';
    };
    // Contact quality
    contactSummary: {
        totalFound: number;
        leadershipFound: number;
        hasPersonalEmail: boolean;
        hasPhone: boolean;
        hasLinkedin: boolean;
        decisionMakerPresent: boolean;
    };
    // Metadata
    processingTimeMs: number;
}

// ─── Scoring Constants ─────────────────────────────────────────────────────────

// Intent: missing infrastructure signals
const INTENT_SIGNALS: { key: string; points: number; label: string }[] = [
    { key: 'no_whatsapp',     points: 18, label: 'No WhatsApp integration' },
    { key: 'no_booking',      points: 15, label: 'No booking/appointment system' },
    { key: 'no_crm',          points: 15, label: 'No CRM detected' },
    { key: 'poor_seo',        points: 15, label: 'Poor SEO score (<50)' },
    { key: 'no_ssl',          points: 12, label: 'No SSL/HTTPS' },
    { key: 'no_contact_form', points: 12, label: 'No contact form' },
    { key: 'no_analytics',    points: 8,  label: 'No analytics tracking' },
    { key: 'no_chatbot',      points: 5,  label: 'No chatbot' },
];

// Service recommendations
const SERVICE_MAP: {
    condition: (audit: QuickAuditResult) => boolean;
    service: string;
    priority: ServiceRecommendation['priority'];
    confidence: number;
    reason: string;
    impact: string;
}[] = [
    {
        condition: a => !a.hasWhatsAppWidget,
        service: 'WhatsApp Automation',
        priority: 'critical',
        confidence: 95,
        reason: 'No WhatsApp widget or wa.me link found. WhatsApp is the #1 conversion channel in India.',
        impact: '30-50% increase in lead response rate',
    },
    {
        condition: a => !a.hasBookingSystem,
        service: 'Online Booking System',
        priority: 'high',
        confidence: 90,
        reason: 'No automated booking or scheduling system detected.',
        impact: 'Eliminate manual appointment friction and no-shows',
    },
    {
        condition: a => !a.hasCrm,
        service: 'CRM Integration',
        priority: 'high',
        confidence: 85,
        reason: 'No CRM platform (HubSpot, Salesforce, Zoho) detected.',
        impact: 'Centralize leads, track pipeline, and automate follow-ups',
    },
    {
        condition: a => !a.hasChatbot,
        service: 'AI Chatbot',
        priority: 'high',
        confidence: 88,
        reason: 'No chatbot or live chat widget detected.',
        impact: '24/7 lead capture, instant customer support',
    },
    {
        condition: a => a.seoScore < 50,
        service: 'SEO Optimization',
        priority: 'high',
        confidence: 92,
        reason: `Low SEO score (${0}/100). Missing title, meta description, or H1 tags.`,
        impact: '2–5× increase in organic search visibility',
    },
    {
        condition: a => !a.hasAnalytics,
        service: 'Analytics & Tracking Setup',
        priority: 'medium',
        confidence: 80,
        reason: 'No Google Analytics, Meta Pixel, or Hotjar detected.',
        impact: 'Understand traffic sources and user behaviour',
    },
    {
        condition: a => !a.sslEnabled,
        service: 'Website Security (SSL)',
        priority: 'critical',
        confidence: 99,
        reason: 'Website does not use HTTPS. Google penalizes non-HTTPS sites.',
        impact: 'Immediate trust improvement + SEO ranking boost',
    },
    {
        condition: a => !a.mobileFriendly,
        service: 'Mobile-Responsive Website',
        priority: 'critical',
        confidence: 95,
        reason: 'Website does not appear to be mobile-friendly.',
        impact: '60%+ of web traffic is mobile; high bounce rate risk',
    },
];

// ─── Grade lookup ──────────────────────────────────────────────────────────────

function gradeFromScore(score: number): { grade: LeadScoreBreakdown['grade']; priority: LeadScoreBreakdown['priority'] } {
    if (score >= 80) return { grade: 'A', priority: 'hot' };
    if (score >= 65) return { grade: 'B', priority: 'warm' };
    if (score >= 45) return { grade: 'C', priority: 'warm' };
    if (score >= 25) return { grade: 'D', priority: 'cold' };
    return { grade: 'F', priority: 'skip' };
}

// ─── Main Service ──────────────────────────────────────────────────────────────

export class LeadIntelligenceService {
    /**
     * Combines outputs of Phases 2–6 into a comprehensive lead score.
     * 100% deterministic — no AI calls.
     */
    static score(params: {
        doc: WebsiteDocument;
        audit: QuickAuditResult;
        company: CompanyIntelligenceResult;
        contacts: ContactIntelligenceResult;
        companyName?: string;
    }): LeadIntelligenceResult {
        const start = Date.now();
        const { doc, audit, company, contacts, companyName } = params;

        TelemetryService.trackEvent('lead_intelligence_start', { url: doc.url });

        // ── 1. Digital Maturity Score ─────────────────────────────────────────
        const maturityScore = this.calcMaturity(audit);

        // ── 2. Intent Score ───────────────────────────────────────────────────
        const { intentScore, triggeredSignals } = this.calcIntent(audit);

        // ── 3. Opportunity Score ──────────────────────────────────────────────
        const opportunityScore = this.calcOpportunity(maturityScore, triggeredSignals.length);

        // ── 4. Fit Score ──────────────────────────────────────────────────────
        const fitScore = this.calcFit(contacts, doc, company);

        // ── 5. Composite Lead Score ───────────────────────────────────────────
        const raw = (intentScore * 0.35) + (opportunityScore * 0.35) + (fitScore * 0.30);
        const leadScore = Math.round(Math.min(100, Math.max(0, raw)));
        const { grade, priority } = gradeFromScore(leadScore);

        // ── 6. Service Recommendations ────────────────────────────────────────
        const servicesNeeded = this.buildServiceRecommendations(audit);

        // ── 7. Buying Signals ─────────────────────────────────────────────────
        const buyingSignals = this.buildBuyingSignals(doc, audit);

        // ── 8. Contact Summary ────────────────────────────────────────────────
        const contactSummary = this.buildContactSummary(contacts);

        const processingTimeMs = Date.now() - start;

        TelemetryService.trackEvent('lead_intelligence_complete', {
            url: doc.url,
            leadScore,
            grade,
            priority,
            intentScore,
            opportunityScore,
            fitScore,
            maturityScore,
            servicesCount: servicesNeeded.length,
            processingTimeMs,
        });

        return {
            url: doc.url,
            companyName,
            industry: company.industry.industry,
            businessModel: company.businessModel.model,
            companySize: company.companySize.size,
            description: company.description,
            targetAudience: company.targetAudience,
            scores: {
                intentScore,
                opportunityScore,
                fitScore,
                maturityScore,
                leadScore,
                grade,
                priority,
            },
            servicesNeeded,
            digitalPresence: {
                hasWebsite: true,
                hasSsl: audit.sslEnabled,
                hasMobileView: audit.mobileFriendly,
                hasContactForm: audit.hasContactForm,
                hasWhatsApp: audit.hasWhatsAppWidget,
                hasBookingSystem: audit.hasBookingSystem,
                hasCrm: audit.hasCrm,
                hasChatbot: audit.hasChatbot,
                hasAnalytics: audit.hasAnalytics,
                socialNetworks: audit.socialLinksFound,
                technologies: audit.technology,
                seoScore: audit.seoScore,
            },
            buyingSignals,
            contactSummary,
            processingTimeMs,
        };
    }

    // ─── Score Components ──────────────────────────────────────────────────────

    private static calcMaturity(audit: QuickAuditResult): number {
        let score = 100;
        if (!audit.sslEnabled)       score -= 15;
        if (!audit.mobileFriendly)   score -= 15;
        if (!audit.hasContactForm)   score -= 10;
        if (!audit.hasWhatsAppWidget) score -= 10;
        if (!audit.hasBookingSystem) score -= 10;
        if (!audit.hasCrm)           score -= 10;
        if (!audit.hasChatbot)       score -= 10;
        if (!audit.hasAnalytics)     score -= 8;
        if (audit.seoScore < 50)     score -= 12;
        return Math.max(0, Math.min(100, score));
    }

    private static calcIntent(audit: QuickAuditResult): { intentScore: number; triggeredSignals: string[] } {
        const triggered: string[] = [];
        let score = 0;

        const checks: Record<string, boolean> = {
            no_whatsapp:     !audit.hasWhatsAppWidget,
            no_booking:      !audit.hasBookingSystem,
            no_crm:          !audit.hasCrm,
            poor_seo:        audit.seoScore < 50,
            no_ssl:          !audit.sslEnabled,
            no_contact_form: !audit.hasContactForm,
            no_analytics:    !audit.hasAnalytics,
            no_chatbot:      !audit.hasChatbot,
        };

        for (const signal of INTENT_SIGNALS) {
            if (checks[signal.key]) {
                score += signal.points;
                triggered.push(signal.label);
            }
        }

        return {
            intentScore: Math.min(100, score),
            triggeredSignals: triggered,
        };
    }

    private static calcOpportunity(maturityScore: number, signalCount: number): number {
        const base = 100 - maturityScore;
        const bonus = Math.min(25, signalCount * 5);
        return Math.min(100, Math.round((base * 0.75) + bonus));
    }

    private static calcFit(
        contacts: ContactIntelligenceResult,
        doc: WebsiteDocument,
        company: CompanyIntelligenceResult
    ): number {
        let score = 0;

        // Contact quality
        if (contacts.metrics.totalContactsExtracted > 0)  score += 20;
        if (contacts.metrics.leadershipContacts > 0)       score += 20;
        if (contacts.businessContacts.emails.some(e => e.type === 'personal')) score += 15;
        if (contacts.businessContacts.phones.length > 0)   score += 10;
        if (contacts.socialProfiles.linkedin)              score += 10;

        // Company profile quality
        if (doc.about && doc.about.length > 100)           score += 5;
        if (company.companySize.size !== 'Unknown')        score += 5;
        if (company.industry.confidence > 60)              score += 10;
        if (company.description && company.description.length > 30) score += 5;

        return Math.min(100, score);
    }

    // ─── Service Recommendations ───────────────────────────────────────────────

    private static buildServiceRecommendations(audit: QuickAuditResult): ServiceRecommendation[] {
        return SERVICE_MAP
            .filter(svc => svc.condition(audit))
            .map(svc => ({
                service: svc.service,
                priority: svc.priority,
                confidence: svc.confidence,
                reason: svc.reason.replace('${0}', String(audit.seoScore)),
                estimatedImpact: svc.impact,
            }))
            .sort((a, b) => {
                const order = { critical: 0, high: 1, medium: 2, low: 3 };
                return order[a.priority] - order[b.priority];
            });
    }

    // ─── Buying Signals ────────────────────────────────────────────────────────

    private static buildBuyingSignals(
        doc: WebsiteDocument,
        audit: QuickAuditResult
    ): LeadIntelligenceResult['buyingSignals'] {
        const raw = [
            ...(doc.businessSignals || []),
            ...(audit.businessSignals || []),
        ];

        // Deduplicate and normalize
        const detected = [...new Set(raw.map(s => s.toLowerCase().trim()))];

        const HIGH_VALUE = ['book demo', 'book consultation', 'pricing', 'case studies', 'awards', 'certifications'];
        const highCount = detected.filter(s => HIGH_VALUE.some(h => s.includes(h))).length;

        const strength: LeadIntelligenceResult['buyingSignals']['strength'] =
            highCount >= 3 ? 'strong' :
            highCount >= 1 ? 'moderate' :
            detected.length > 0 ? 'weak' : 'none';

        return { detected, count: detected.length, strength };
    }

    // ─── Contact Summary ───────────────────────────────────────────────────────

    private static buildContactSummary(
        contacts: ContactIntelligenceResult
    ): LeadIntelligenceResult['contactSummary'] {
        const hasPersonalEmail = contacts.businessContacts.emails.some(e => e.type === 'personal');
        const hasPhone = contacts.businessContacts.phones.length > 0;
        const hasLinkedin = !!contacts.socialProfiles.linkedin;
        const decisionMakerPresent = contacts.metrics.leadershipContacts > 0;

        return {
            totalFound: contacts.metrics.totalContactsExtracted,
            leadershipFound: contacts.metrics.leadershipContacts,
            hasPersonalEmail,
            hasPhone,
            hasLinkedin,
            decisionMakerPresent,
        };
    }
}
