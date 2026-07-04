import { LocalAiGateway } from './LocalAiGateway.js';
import { TelemetryService } from './TelemetryService';
import { WebsiteDocument } from './WebsiteIntelligenceService';

// ─── Regex Patterns ─────────────────────────────────────────────────────────

const EMAIL_REGEX = /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/gi;
const PHONE_REGEX = /(?:\+?\d{1,3}[\s\-.]?)?\(?\d{3,5}\)?[\s\-.]?\d{3,5}(?:[\s\-.]?\d{3,5})?(?:\s?(?:ext|x)\.?\s?\d{1,5})?/gi;
const WHATSAPP_REGEX = /wa\.me\/(\d+)|whatsapp[^\S\n]*:?[^\S\n]*(\+?\d[\d\s\-]{7,15})/gi;
const LINKEDIN_REGEX = /https?:\/\/(?:www\.)?linkedin\.com\/(?:in|company)\/[a-zA-Z0-9\-_%]+\/?/gi;
const FACEBOOK_REGEX = /https?:\/\/(?:www\.)?facebook\.com\/[a-zA-Z0-9.\-_]+\/?/gi;
const INSTAGRAM_REGEX = /https?:\/\/(?:www\.)?instagram\.com\/[a-zA-Z0-9._]+\/?/gi;
const TWITTER_REGEX = /https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[a-zA-Z0-9_]+\/?/gi;
const YOUTUBE_REGEX = /https?:\/\/(?:www\.)?youtube\.com\/(?:channel|user|c)\/[a-zA-Z0-9_\-]+\/?/gi;

// ─── Known generic email prefixes to reject ──────────────────────────────────

const GENERIC_EMAIL_PREFIXES = new Set([
    'info', 'support', 'hello', 'contact', 'admin', 'sales', 'help',
    'enquiry', 'enquiries', 'noreply', 'no-reply', 'billing', 'accounts',
    'hr', 'careers', 'jobs', 'team', 'office', 'general', 'mail',
    'webmaster', 'postmaster', 'marketing', 'press', 'media',
]);

// ─── Executive title keywords for categorization ─────────────────────────────

const LEADERSHIP_TITLE_KWS = [
    'founder', 'co-founder', 'ceo', 'coo', 'cto', 'cfo', 'cmo',
    'president', 'vice president', 'vp', 'director', 'managing director',
    'managing partner', 'partner', 'owner', 'chairperson', 'head of',
    'doctor', 'dr.', 'dentist', 'psychiatrist', 'psychologist',
    'principal', 'chief',
];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExtractedContact {
    name: string;
    title?: string;
    email?: string;
    phone?: string;
    linkedin?: string;
    source: string;
    category: 'LEADERSHIP' | 'TEAM' | 'BUSINESS';
    confidence: number;
    isDecisionMaker: boolean;
    decisionMakerScore: number;
}

export interface SocialProfiles {
    linkedin?: string;
    facebook?: string;
    instagram?: string;
    twitter?: string;
    youtube?: string;
}

export interface BusinessContacts {
    emails: { email: string; type: 'personal' | 'generic' }[];
    phones: string[];
    whatsapp?: string;
    address?: string;
}

export interface ContactIntelligenceResult {
    leadership: ExtractedContact[];
    team: ExtractedContact[];
    businessContacts: BusinessContacts;
    socialProfiles: SocialProfiles;
    nerRawEntities: any[];
    metrics: {
        totalContactsExtracted: number;
        leadershipContacts: number;
        teamContacts: number;
        emailsFound: number;
        phonesFound: number;
        socialProfilesFound: number;
        nerCallMade: boolean;
        processingTimeMs: number;
    };
}

// ─── Main Service ─────────────────────────────────────────────────────────────

export class ContactIntelligenceService {

    /**
     * Main entry point. Accepts a WebsiteDocument and returns structured contacts.
     */
    static async extractContacts(doc: WebsiteDocument): Promise<ContactIntelligenceResult> {
        const start = Date.now();
        TelemetryService.trackEvent('contact_intelligence_start', { url: doc.url });

        // 1. Deterministic extraction from footer / raw text
        const businessContacts = this.extractBusinessContacts(doc);
        const socialProfiles = this.extractSocialProfiles(doc);

        // 2. NER-based person extraction from leadership, team, about text
        const { leadership, team, nerEntities, nerCallMade } = await this.extractPersonContacts(doc);

        // 3. Cross-reference: attach emails/phones to named contacts if possible
        const enrichedLeadership = this.enrichContactsWithBusinessData(leadership, businessContacts, doc.url);
        const enrichedTeam = this.enrichContactsWithBusinessData(team, businessContacts, doc.url);

        const elapsed = Date.now() - start;

        TelemetryService.trackEvent('contact_intelligence_complete', {
            url: doc.url,
            leadershipFound: enrichedLeadership.length,
            teamFound: enrichedTeam.length,
            emailsFound: businessContacts.emails.length,
            phonesFound: businessContacts.phones.length,
            nerCallMade,
            processingTimeMs: elapsed,
        });

        return {
            leadership: enrichedLeadership,
            team: enrichedTeam,
            businessContacts,
            socialProfiles,
            nerRawEntities: nerEntities,
            metrics: {
                totalContactsExtracted: enrichedLeadership.length + enrichedTeam.length,
                leadershipContacts: enrichedLeadership.length,
                teamContacts: enrichedTeam.length,
                emailsFound: businessContacts.emails.length,
                phonesFound: businessContacts.phones.length,
                socialProfilesFound: Object.values(socialProfiles).filter(Boolean).length,
                nerCallMade,
                processingTimeMs: elapsed,
            },
        };
    }

    // ─── Deterministic: Business Contacts ──────────────────────────────────────

    private static extractBusinessContacts(doc: WebsiteDocument): BusinessContacts {
        // Combine all text sources, prioritizing footer then full text
        const sources = [
            doc.footer?.raw || '',
            doc.about || '',
            doc.hero || '',
            doc.rawText || '',
        ].join(' ');

        const fullText = sources + ' ' + (Object.values(doc.meta).join(' ') || '');

        // Extract emails
        const rawEmails = [...new Set((fullText.match(EMAIL_REGEX) || []).map(e => e.toLowerCase()))];
        const emails = rawEmails.map(email => ({
            email,
            type: (GENERIC_EMAIL_PREFIXES.has(email.split('@')[0]) ? 'generic' : 'personal') as 'personal' | 'generic',
        }));

        // Extract phones - clean duplicates and obvious false positives
        const rawPhones = [...new Set((fullText.match(PHONE_REGEX) || [])
            .map(p => p.trim())
            .filter(p => p.replace(/\D/g, '').length >= 7)  // at least 7 digits
        )];

        // WhatsApp
        let whatsapp: string | undefined;
        const waMatch = WHATSAPP_REGEX.exec(fullText);
        if (waMatch) {
            whatsapp = (waMatch[1] || waMatch[2] || '').replace(/\s/g, '');
        }

        return { emails, phones: rawPhones, whatsapp };
    }

    // ─── Deterministic: Social Profiles ────────────────────────────────────────

    private static extractSocialProfiles(doc: WebsiteDocument): SocialProfiles {
        const allText = [
            doc.footer?.raw || '',
            ...(doc.services || []),
            doc.about || '',
            doc.rawText || '',
        ].join(' ');

        const pick = (regex: RegExp): string | undefined => {
            regex.lastIndex = 0;
            const m = regex.exec(allText);
            return m ? m[0] : undefined;
        };

        return {
            linkedin: pick(LINKEDIN_REGEX),
            facebook: pick(FACEBOOK_REGEX),
            instagram: pick(INSTAGRAM_REGEX),
            twitter: pick(TWITTER_REGEX),
            youtube: pick(YOUTUBE_REGEX),
        };
    }

    // ─── NER: Person Extraction ──────────────────────────────────────────────

    private static async extractPersonContacts(doc: WebsiteDocument): Promise<{
        leadership: ExtractedContact[];
        team: ExtractedContact[];
        nerEntities: any[];
        nerCallMade: boolean;
    }> {
        // Build text chunks to run NER on: prioritize leadership > about > team
        const nerChunks: { text: string; source: string }[] = [];

        if (doc.leadership?.length > 0) {
            nerChunks.push({ text: doc.leadership.slice(0, 3).join('\n'), source: 'leadership' });
        }
        if (doc.about) {
            nerChunks.push({ text: doc.about.slice(0, 1000), source: 'about' });
        }

        const leadership: ExtractedContact[] = [];
        const team: ExtractedContact[] = [];
        const allNerEntities: any[] = [];
        let nerCallMade = false;

        if (nerChunks.length === 0) {
            return { leadership, team, nerEntities: allNerEntities, nerCallMade };
        }

        try {
            for (const chunk of nerChunks) {
                // HuggingFace NER - dslim/bert-base-NER
                const entities = await LocalAiGateway.query('ner', {
                    inputs: chunk.text.substring(0, 512),  // BERT token limit
                }) as any;
                nerCallMade = true;

                if (!Array.isArray(entities)) continue;
                allNerEntities.push(...entities);

                // Merge sub-tokens (B-PER, I-PER) into full names
                const persons = this.mergeNerPersonEntities(entities);

                for (const person of persons) {
                    const contact = this.buildContactFromNerPerson(person, chunk.text, chunk.source);
                    if (!contact) continue;

                    if (contact.category === 'LEADERSHIP') {
                        leadership.push(contact);
                    } else {
                        team.push(contact);
                    }
                }
            }
        } catch (error) {
            TelemetryService.trackError('ner_extraction_error', { error });
        }

        // Deduplicate by name
        const dedup = (contacts: ExtractedContact[]) => {
            const seen = new Set<string>();
            return contacts.filter(c => {
                const key = c.name.toLowerCase();
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
        };

        return {
            leadership: dedup(leadership),
            team: dedup(team),
            nerEntities: allNerEntities,
            nerCallMade,
        };
    }

    /**
     * Merge BERT WordPiece sub-tokens (B-PER, I-PER) into a single full name.
     */
    private static mergeNerPersonEntities(entities: any[]): { name: string; score: number }[] {
        const persons: { name: string; score: number }[] = [];
        let currentName = '';
        let currentScore = 0;
        let tokenCount = 0;

        for (const entity of entities) {
            const label: string = entity.entity || entity.entity_group || '';
            const word: string = (entity.word || '').replace(/^##/, '');  // strip BERT sub-token prefix

            if (label === 'B-PER' || label === 'B-PERSON') {
                // Save previous
                if (currentName.trim().length > 1) {
                    persons.push({ name: currentName.trim(), score: currentScore / Math.max(tokenCount, 1) });
                }
                currentName = word;
                currentScore = entity.score || 0;
                tokenCount = 1;
            } else if ((label === 'I-PER' || label === 'I-PERSON') && currentName) {
                // Continuation - handle WordPiece stitching
                if (word.startsWith('##') || entity.word?.startsWith('##')) {
                    currentName += word;
                } else {
                    currentName += ' ' + word;
                }
                currentScore += entity.score || 0;
                tokenCount++;
            } else {
                // End of person entity
                if (currentName.trim().length > 1) {
                    persons.push({ name: currentName.trim(), score: currentScore / Math.max(tokenCount, 1) });
                }
                currentName = '';
                currentScore = 0;
                tokenCount = 0;
            }
        }

        // Flush last
        if (currentName.trim().length > 1) {
            persons.push({ name: currentName.trim(), score: currentScore / Math.max(tokenCount, 1) });
        }

        // Filter by confidence threshold
        return persons.filter(p => p.score > 0.7 && p.name.split(' ').length >= 2);
    }

    /**
     * Convert a NER-detected person into a structured contact.
     * Attempts to extract title context from surrounding text.
     */
    private static buildContactFromNerPerson(
        person: { name: string; score: number },
        sourceText: string,
        sourceSection: string
    ): ExtractedContact | null {
        const name = person.name.trim();
        if (name.length < 4) return null;

        // Try to find a title near the name in the surrounding text
        const nameIdx = sourceText.toLowerCase().indexOf(name.toLowerCase());
        let title: string | undefined;
        let decisionMakerScore = 20;

        if (nameIdx !== -1) {
            // Look at 150 chars around the name for title context
            const snippet = sourceText.substring(Math.max(0, nameIdx - 20), Math.min(sourceText.length, nameIdx + 150));
            const titleMatch = snippet.match(/(?:–|-|,|\n)\s*([A-Z][a-zA-Z\s&,]{5,60}?)(?:\n|$)/);
            if (titleMatch) {
                title = titleMatch[1].trim();
            }
        }

        // Score decision maker based on title
        const lowerTitle = (title || '').toLowerCase();
        if (LEADERSHIP_TITLE_KWS.some(kw => lowerTitle.includes(kw))) {
            decisionMakerScore = 80;
        } else if (title) {
            decisionMakerScore = 50;
        }

        const category: 'LEADERSHIP' | 'TEAM' = decisionMakerScore >= 70 ? 'LEADERSHIP' : 'TEAM';

        return {
            name,
            title,
            source: `ner:${sourceSection}`,
            category,
            confidence: Math.round(person.score * 100),
            isDecisionMaker: decisionMakerScore >= 70,
            decisionMakerScore,
        };
    }

    /**
     * Best-effort enrichment: if only one personal email was found, attach it to
     * the top leadership contact. Same for phone numbers.
     */
    private static enrichContactsWithBusinessData(
        contacts: ExtractedContact[],
        business: BusinessContacts,
        _websiteUrl: string
    ): ExtractedContact[] {
        const personalEmails = business.emails.filter(e => e.type === 'personal');

        return contacts.map((contact, idx) => {
            const enriched = { ...contact };

            // Assign a personal email to the first leadership contact if unambiguous
            if (!enriched.email && personalEmails.length === 1 && idx === 0) {
                enriched.email = personalEmails[0].email;
            }

            // Assign a phone if only one is found and contact has none
            if (!enriched.phone && business.phones.length === 1 && idx === 0) {
                enriched.phone = business.phones[0];
            }

            return enriched;
        });
    }
}
