import { ClassificationService } from './ClassificationService.js';
import { TelemetryService } from './TelemetryService.js';
import { WebsiteDocument } from './WebsiteIntelligenceService.js';

// ─── Industry Taxonomy ────────────────────────────────────────────────────────
// 3-tier taxonomy: Primary → Category → Sub-category
// Zero-shot model scores against INDUSTRIES (top level), then we derive category/sub.

export const INDUSTRY_LABELS = [
    // Professional Services
    'Legal Services', 'Accounting and Finance', 'Management Consulting', 'HR and Recruitment',
    'Marketing and Advertising Agency', 'Public Relations', 'Architecture and Interior Design',
    'Engineering Services', 'IT Services and Consulting',

    // Healthcare
    'Medical Clinic and Hospital', 'Dental Clinic', 'Mental Health and Psychology',
    'Physiotherapy and Rehabilitation', 'Pharmacy and Chemist', 'Veterinary Services',
    'Cosmetic and Aesthetic Clinic', 'Ayurveda and Alternative Medicine',

    // Education
    'School and College', 'Coaching and Tutoring', 'Online Learning Platform',
    'Corporate Training', 'Vocational and Skills Training',

    // Technology
    'Software Development', 'SaaS Product', 'Mobile App Development',
    'Cybersecurity', 'Cloud Services', 'Artificial Intelligence and Machine Learning',
    'Web Design and Development', 'Digital Marketing',

    // Retail and E-commerce
    'E-commerce and Online Retail', 'Physical Retail Store', 'Fashion and Apparel',
    'Electronics and Gadgets', 'Grocery and Food Retail', 'Jewellery and Accessories',

    // Food and Hospitality
    'Restaurant and Cafe', 'Catering Services', 'Hotel and Hospitality',
    'Event Management', 'Travel and Tourism', 'Wedding Planning',

    // Real Estate and Construction
    'Real Estate Agency', 'Property Development', 'Construction and Contracting',
    'Interior Design and Renovation', 'Facility Management',

    // Financial Services
    'Banking and Finance', 'Insurance', 'Investment and Wealth Management',
    'Loan and Credit Services', 'Fintech and Payments',

    // Manufacturing and Industry
    'Manufacturing', 'Export and Import', 'Logistics and Supply Chain',
    'Agriculture and Farming', 'Textile and Garments',

    // Media and Entertainment
    'Media and Publishing', 'Photography and Videography', 'Music and Entertainment',
    'Gaming', 'Sports and Fitness',

    // Non-profit and Government
    'NGO and Non-profit', 'Government and Public Sector',

    // Other
    'Automotive', 'Beauty and Salon', 'Home Services and Repairs',
    'Security Services', 'Cleaning Services',
];

// ─── Business Model Labels ────────────────────────────────────────────────────

export const BUSINESS_MODEL_LABELS = [
    'B2B (Business to Business)',
    'B2C (Business to Consumer)',
    'B2B2C (Both businesses and consumers)',
    'D2C (Direct to Consumer)',
    'Marketplace',
    'SaaS (Software as a Service)',
    'Franchise',
    'Non-profit',
];

// ─── Business Size Estimation (Heuristic) ────────────────────────────────────

const SIZE_SIGNALS: { keywords: string[]; size: string; employees: string }[] = [
    { keywords: ['enterprise', 'fortune 500', '1000+ employees', 'global offices', 'publicly listed', 'headquarters'], size: 'Enterprise', employees: '1000+' },
    { keywords: ['500 employees', '200 employees', 'regional offices', 'multiple locations', 'nationwide'], size: 'Mid-Market', employees: '200-999' },
    { keywords: ['50 employees', '100 employees', 'growing team', 'expanding', 'offices in'], size: 'SMB', employees: '50-199' },
    { keywords: ['small team', 'family business', 'local business', 'boutique', 'solo', 'freelancer', 'startup'], size: 'Small Business', employees: '1-49' },
];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IndustryClassification {
    industry: string;
    confidence: number;
    secondaryIndustry?: string;
    secondaryConfidence?: number;
    allScores: { label: string; score: number }[];
}

export interface BusinessModelClassification {
    model: string;
    confidence: number;
    allScores: { label: string; score: number }[];
}

export interface CompanySizeEstimate {
    size: 'Small Business' | 'SMB' | 'Mid-Market' | 'Enterprise' | 'Unknown';
    estimatedEmployees: string;
    evidence: string[];
}

export interface CompanyIntelligenceResult {
    industry: IndustryClassification;
    businessModel: BusinessModelClassification;
    companySize: CompanySizeEstimate;
    description: string;
    targetAudience: string;
    servicesOffered: string[];
    metrics: {
        processingTimeMs: number;
        textLengthUsed: number;
        classificationCallsMade: number;
    };
}

// ─── Main Service ─────────────────────────────────────────────────────────────

export class CompanyIntelligenceService {

    /**
     * Main entry point. Accepts a WebsiteDocument and returns full company intelligence.
     */
    static async analyze(doc: WebsiteDocument): Promise<CompanyIntelligenceResult> {
        const start = Date.now();
        TelemetryService.trackEvent('company_intelligence_start', { url: doc.url });

        // Build a compact, high-signal text blob for classification
        // Priority: meta title/description > hero > about > services (first 2)
        const classificationText = this.buildClassificationText(doc);
        let classificationCallsMade = 0;

        // 1. Industry classification
        const industry = await this.classifyIndustry(classificationText);
        classificationCallsMade++;

        // 2. Business model classification
        const businessModel = await this.classifyBusinessModel(classificationText);
        classificationCallsMade++;

        // 3. Heuristic company size (deterministic, no AI call)
        const companySize = this.estimateCompanySize(doc);

        // 4. Extract description, target audience, services (deterministic)
        const description = this.extractDescription(doc);
        const targetAudience = this.extractTargetAudience(doc, businessModel.model);
        const servicesOffered = this.extractServices(doc);

        const elapsed = Date.now() - start;

        TelemetryService.trackEvent('company_intelligence_complete', {
            url: doc.url,
            industry: industry.industry,
            industryConfidence: industry.confidence,
            businessModel: businessModel.model,
            companySize: companySize.size,
            processingTimeMs: elapsed,
        });

        return {
            industry,
            businessModel,
            companySize,
            description,
            targetAudience,
            servicesOffered,
            metrics: {
                processingTimeMs: elapsed,
                textLengthUsed: classificationText.length,
                classificationCallsMade,
            },
        };
    }

    // ─── Build Text for Zero-Shot Classification ────────────────────────────

    private static buildClassificationText(doc: WebsiteDocument): string {
        const parts: string[] = [];

        // Meta (highest signal)
        if (doc.meta?.title) parts.push(doc.meta.title);
        if (doc.meta?.description) parts.push(doc.meta.description);

        // Hero headline
        if (doc.hero) parts.push(doc.hero);

        // About section (first 400 chars)
        if (doc.about) parts.push(doc.about.substring(0, 400));

        // Services (first 2 entries)
        if (doc.services?.length > 0) {
            parts.push(...doc.services.slice(0, 2).map(s => s.substring(0, 200)));
        }

        // Combine and trim to 512 tokens worth (~1800 chars)
        return parts.join('. ').substring(0, 1800).trim();
    }

    // ─── Industry Classification ─────────────────────────────────────────────

    private static async classifyIndustry(text: string): Promise<IndustryClassification> {
        try {
            const result = await ClassificationService.classify(text, INDUSTRY_LABELS);

            // HF Zero-shot returns { sequence, labels, scores }
            const labels: string[] = result.labels || [];
            const scores: number[] = result.scores || [];

            const allScores = labels.map((label: string, i: number) => ({
                label,
                score: Math.round((scores[i] || 0) * 100) / 100,
            }));

            const top = allScores[0] || { label: 'Unknown', score: 0 };
            const second = allScores[1];

            return {
                industry: top.label,
                confidence: Math.round((top.score || 0) * 100),
                secondaryIndustry: second?.label,
                secondaryConfidence: Math.round((second?.score || 0) * 100),
                allScores,
            };
        } catch (error) {
            TelemetryService.trackError('industry_classification_error', { error });
            return {
                industry: 'Unknown',
                confidence: 0,
                allScores: [],
            };
        }
    }

    // ─── Business Model Classification ───────────────────────────────────────

    private static async classifyBusinessModel(text: string): Promise<BusinessModelClassification> {
        try {
            const result = await ClassificationService.classify(text, BUSINESS_MODEL_LABELS);

            const labels: string[] = result.labels || [];
            const scores: number[] = result.scores || [];

            const allScores = labels.map((label: string, i: number) => ({
                label,
                score: Math.round((scores[i] || 0) * 100) / 100,
            }));

            const top = allScores[0] || { label: 'B2C (Business to Consumer)', score: 0 };

            return {
                model: top.label,
                confidence: Math.round((top.score || 0) * 100),
                allScores,
            };
        } catch (error) {
            TelemetryService.trackError('business_model_classification_error', { error });
            return {
                model: 'Unknown',
                confidence: 0,
                allScores: [],
            };
        }
    }

    // ─── Heuristic Size Estimation ────────────────────────────────────────────

    private static estimateCompanySize(doc: WebsiteDocument): CompanySizeEstimate {
        const fullText = [doc.about, doc.hero, ...(doc.services || [])].join(' ').toLowerCase();
        const evidence: string[] = [];

        for (const { keywords, size, employees } of SIZE_SIGNALS) {
            const matched = keywords.filter(kw => fullText.includes(kw));
            if (matched.length > 0) {
                return {
                    size: size as any,
                    estimatedEmployees: employees,
                    evidence: matched,
                };
            }
        }

        // Fallback: infer from technology stack
        if (doc.technology?.includes('Salesforce') || doc.technology?.includes('HubSpot')) {
            evidence.push('enterprise CRM detected');
            return { size: 'Mid-Market', estimatedEmployees: '50-499', evidence };
        }
        if (doc.technology?.includes('Shopify') || doc.technology?.includes('WooCommerce')) {
            evidence.push('e-commerce platform detected');
            return { size: 'Small Business', estimatedEmployees: '1-49', evidence };
        }
        if (doc.technology?.includes('WordPress')) {
            return { size: 'Small Business', estimatedEmployees: '1-49', evidence: ['WordPress detected'] };
        }

        return { size: 'Unknown', estimatedEmployees: 'Unknown', evidence: [] };
    }

    // ─── Description Extraction ───────────────────────────────────────────────

    private static extractDescription(doc: WebsiteDocument): string {
        if (doc.meta?.description && doc.meta.description.length > 30) {
            return doc.meta.description;
        }
        if (doc.about && doc.about.length > 30) {
            return doc.about.substring(0, 500);
        }
        if (doc.hero) {
            return doc.hero.substring(0, 300);
        }
        return '';
    }

    // ─── Target Audience Extraction ───────────────────────────────────────────

    private static extractTargetAudience(doc: WebsiteDocument, businessModel: string): string {
        if (businessModel.startsWith('B2B')) return 'Businesses and companies';
        if (businessModel.startsWith('B2C')) return 'Individual consumers';
        if (businessModel.startsWith('B2B2C')) return 'Businesses and consumers';

        // Check about/hero for audience keywords
        const text = (doc.about + ' ' + doc.hero).toLowerCase();
        if (text.includes('enterprise') || text.includes('corporate')) return 'Enterprise clients';
        if (text.includes('small business') || text.includes('smb')) return 'Small and medium businesses';
        if (text.includes('student') || text.includes('learner')) return 'Students and learners';
        if (text.includes('patient') || text.includes('healthcare')) return 'Patients and healthcare seekers';

        return 'General consumers and businesses';
    }

    // ─── Services Extraction ──────────────────────────────────────────────────

    private static extractServices(doc: WebsiteDocument): string[] {
        const rawServices: string[] = [];

        // Use the already-extracted services blocks from the WebsiteDocument
        if (doc.services?.length > 0) {
            // Each service block is a paragraph of text — extract the first sentence/heading
            for (const block of doc.services.slice(0, 10)) {
                const firstLine = block.split(/[\n.]/)[0].trim();
                if (firstLine.length > 3 && firstLine.length < 120) {
                    rawServices.push(firstLine);
                }
            }
        }

        // Also try products
        if (doc.products?.length > 0) {
            for (const block of doc.products.slice(0, 5)) {
                const firstLine = block.split(/[\n.]/)[0].trim();
                if (firstLine.length > 3 && firstLine.length < 120) {
                    rawServices.push(firstLine);
                }
            }
        }

        // Deduplicate
        return [...new Set(rawServices)];
    }
}

