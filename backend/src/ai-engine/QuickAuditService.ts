import { LlmGateway } from './LlmGateway';
import { ModelRegistry } from './ModelRegistry';
import { TelemetryService } from './TelemetryService';
import { WebsiteDocument } from './WebsiteIntelligenceService';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface QuickAuditResult {
    url: string;
    // SEO
    seoScore: number;
    sslEnabled: boolean;
    mobileFriendly: boolean;
    hasTitle: boolean;
    hasMetaDescription: boolean;
    hasH1: boolean;
    // Conversion
    hasContactForm: boolean;
    hasWhatsAppWidget: boolean;
    hasBookingSystem: boolean;
    hasChatbot: boolean;
    hasCrm: boolean;
    hasAnalytics: boolean;
    // Tech
    technology: string[];
    socialLinksFound: string[];
    // Business Signals
    businessSignals: string[];
    // AI-generated profile (Qwen2.5:3b)
    aiProfile: QuickAiProfile | null;
    // Issues
    issues: AuditIssue[];
    // Timing
    deterministicTimeMs: number;
    aiTimeMs: number;
    totalTimeMs: number;
}

export interface QuickAiProfile {
    companySummary: string;
    businessModel: string;
    servicesOffered: string[];
    targetAudience: string;
    confidence: number;
}

export interface AuditIssue {
    type: 'seo' | 'conversion' | 'performance' | 'security';
    severity: 'high' | 'medium' | 'low';
    message: string;
}

// ─── Prompt ────────────────────────────────────────────────────────────────────

function buildQuickAuditPrompt(doc: WebsiteDocument): string {
    const context = [
        doc.meta?.title ? `Title: ${doc.meta.title}` : '',
        doc.meta?.description ? `Description: ${doc.meta.description}` : '',
        doc.hero ? `Hero: ${doc.hero}` : '',
        doc.about ? `About: ${doc.about.substring(0, 400)}` : '',
        doc.services?.length ? `Services: ${doc.services.slice(0, 3).map(s => s.substring(0, 150)).join(' | ')}` : '',
    ].filter(Boolean).join('\n');

    return `You are a business analyst. Extract structured information from this company website content.

CONTENT:
${context.substring(0, 2000)}

Return ONLY valid JSON with exactly these keys:
{
  "companySummary": "One clear sentence about what this company does",
  "businessModel": "B2B or B2C or B2B2C or Unknown",
  "servicesOffered": ["Service 1", "Service 2", "Service 3"],
  "targetAudience": "Who they serve in one phrase",
  "confidence": 85
}

Rules:
- companySummary must be 1 sentence, max 120 chars
- servicesOffered max 5 items
- confidence is 0-100 based on how clear the content is
- Return ONLY the JSON object, no markdown, no explanation`;
}

// ─── Main Service ──────────────────────────────────────────────────────────────

export class QuickAuditService {
    /**
     * Runs a fast full audit on a WebsiteDocument.
     * Deterministic checks first, then a single focused Qwen2.5:3b call.
     * Target: < 5 seconds total.
     */
    static async audit(doc: WebsiteDocument): Promise<QuickAuditResult> {
        const start = Date.now();
        TelemetryService.trackEvent('quick_audit_start', { url: doc.url });

        // ── Phase A: Deterministic Checks (no AI, < 5ms) ──────────────────────
        const detStart = Date.now();
        const deterministic = this.runDeterministicChecks(doc);
        const deterministicTimeMs = Date.now() - detStart;

        // ── Phase B: Quick AI Profile (Qwen2.5:3b, target < 4s) ──────────────
        let aiProfile: QuickAiProfile | null = null;
        let aiTimeMs = 0;

        const aiStart = Date.now();
        try {
            const prompt = buildQuickAuditPrompt(doc);
            const rawResponse = await LlmGateway.generate(ModelRegistry.quickAudit, prompt, {
                format: 'json',
                keep_alive: '24h',
                options: {
                    num_ctx: 2048,
                    num_predict: 256,   // Short output = fast
                    temperature: 0.1,   // Low temp = deterministic JSON
                }
            });

            aiProfile = this.parseAiProfile(rawResponse);
        } catch (error) {
            TelemetryService.trackError('quick_audit_ai_error', { url: doc.url, error });
        }
        aiTimeMs = Date.now() - aiStart;

        const totalTimeMs = Date.now() - start;

        TelemetryService.trackEvent('quick_audit_complete', {
            url: doc.url,
            seoScore: deterministic.seoScore,
            issueCount: deterministic.issues.length,
            aiProfileGenerated: !!aiProfile,
            deterministicTimeMs,
            aiTimeMs,
            totalTimeMs,
        });

        return {
            url: doc.url,
            ...deterministic,
            aiProfile,
            deterministicTimeMs,
            aiTimeMs,
            totalTimeMs,
        };
    }

    // ─── Deterministic Section ──────────────────────────────────────────────────

    private static runDeterministicChecks(doc: WebsiteDocument) {
        const issues: AuditIssue[] = [];
        let seoScore = 0;

        // ── SSL ─────────────────────────────────────────────────────────────────
        const sslEnabled = doc.url.startsWith('https://');
        if (!sslEnabled) {
            issues.push({ type: 'security', severity: 'high', message: 'Website does not use HTTPS/SSL.' });
        }

        // ── SEO ─────────────────────────────────────────────────────────────────
        const hasTitle = !!(doc.meta?.title && doc.meta.title.trim().length > 5);
        if (hasTitle) { seoScore += 30; }
        else { issues.push({ type: 'seo', severity: 'high', message: 'Missing or empty <title> tag.' }); }

        const hasMetaDescription = !!(doc.meta?.description && doc.meta.description.trim().length > 10);
        if (hasMetaDescription) { seoScore += 25; }
        else { issues.push({ type: 'seo', severity: 'medium', message: 'Missing meta description.' }); }

        const hasH1 = !!(doc.hero && doc.hero.trim().length > 3);
        if (hasH1) { seoScore += 25; }
        else { issues.push({ type: 'seo', severity: 'medium', message: 'No clear <h1> heading detected.' }); }

        // Bonus: has about section content
        if (doc.about && doc.about.length > 100) seoScore += 10;

        // Bonus: has structured services
        if (doc.services?.length > 0) seoScore += 10;

        seoScore = Math.min(100, seoScore);

        // ── Mobile Friendliness ─────────────────────────────────────────────────
        // We infer from tech: modern stacks are usually responsive
        const modernTech = ['React', 'Next.js', 'Vue', 'Angular', 'Shopify'];
        const mobileFriendly = doc.technology?.some(t => modernTech.includes(t)) || false;
        if (!mobileFriendly) {
            // Soft warning — can't confirm without actual rendering
            issues.push({ type: 'performance', severity: 'low', message: 'Could not confirm mobile-friendliness from static content.' });
        }

        // ── Conversion Elements ─────────────────────────────────────────────────
        const businessSignalLower = (doc.businessSignals || []).map(s => s.toLowerCase());
        const footerRaw = (doc.footer?.raw || '').toLowerCase();
        const allText = footerRaw + ' ' + (doc.about || '').toLowerCase();

        const hasWhatsAppWidget = businessSignalLower.includes('whatsapp') ||
            footerRaw.includes('wa.me') || footerRaw.includes('whatsapp');

        const hasContactForm = businessSignalLower.some(s =>
            s.includes('appointment') || s.includes('consultation') || s.includes('book')
        ) || allText.includes('contact form') || allText.includes('get in touch');

        const hasBookingSystem = doc.technology?.includes('Calendly') ||
            businessSignalLower.some(s => s.includes('book') || s.includes('appointment'));

        const hasChatbot = doc.technology?.some(t =>
            ['Freshworks', 'HubSpot', 'Zoho'].includes(t)
        ) || allText.includes('live chat') || allText.includes('chat with us') || false;

        const hasCrm = doc.technology?.some(t =>
            ['HubSpot', 'Salesforce', 'Zoho'].includes(t)
        ) || false;

        const hasAnalytics = doc.technology?.some(t =>
            ['Google Analytics', 'Meta Pixel', 'Hotjar'].includes(t)
        ) || false;

        if (!hasContactForm && !hasWhatsAppWidget) {
            issues.push({ type: 'conversion', severity: 'high', message: 'No contact form or WhatsApp widget detected.' });
        }
        if (!hasBookingSystem) {
            issues.push({ type: 'conversion', severity: 'medium', message: 'No booking or appointment system detected.' });
        }
        if (!hasAnalytics) {
            issues.push({ type: 'performance', severity: 'medium', message: 'No analytics platform detected (Google Analytics, Meta Pixel, etc.).' });
        }
        if (!hasCrm) {
            issues.push({ type: 'conversion', severity: 'low', message: 'No CRM integration detected (HubSpot, Salesforce, Zoho).' });
        }

        // ── Social Links ────────────────────────────────────────────────────────
        const socialLinksFound: string[] = [];
        const socialMap: Record<string, string> = {
            linkedin: 'linkedin.com',
            facebook: 'facebook.com',
            instagram: 'instagram.com',
            twitter: 'twitter.com',
            youtube: 'youtube.com',
        };
        for (const [key, domain] of Object.entries(socialMap)) {
            if (footerRaw.includes(domain) || allText.includes(domain)) {
                socialLinksFound.push(key);
            }
        }

        return {
            seoScore,
            sslEnabled,
            mobileFriendly,
            hasTitle,
            hasMetaDescription,
            hasH1,
            hasContactForm,
            hasWhatsAppWidget,
            hasBookingSystem,
            hasChatbot,
            hasCrm,
            hasAnalytics,
            technology: doc.technology || [],
            socialLinksFound,
            businessSignals: doc.businessSignals || [],
            issues,
        };
    }

    // ─── AI Profile Parser ──────────────────────────────────────────────────────

    private static parseAiProfile(raw: string): QuickAiProfile | null {
        try {
            // Strip markdown fences if present
            const cleaned = raw
                .replace(/```json\s*/gi, '')
                .replace(/```\s*/g, '')
                .trim();

            // Extract first JSON object
            const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
            if (!jsonMatch) return null;

            const parsed = JSON.parse(jsonMatch[0]);

            return {
                companySummary: parsed.companySummary || '',
                businessModel: parsed.businessModel || 'Unknown',
                servicesOffered: Array.isArray(parsed.servicesOffered)
                    ? parsed.servicesOffered.slice(0, 5)
                    : [],
                targetAudience: parsed.targetAudience || '',
                confidence: Number(parsed.confidence) || 0,
            };
        } catch {
            return null;
        }
    }
}
