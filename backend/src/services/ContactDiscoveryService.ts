import { supabase } from '../config/supabase.js';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { ContactRepository } from '../db/repositories/ContactRepository.js';
import { ContactInsert } from '../types/contact.js';
import { EmailDiscoveryService } from './EmailDiscoveryService.js';
import { PhoneVerificationService } from './PhoneVerificationService.js';
import { WebsiteNormalizationService } from './WebsiteNormalizationService.js';
import { normalizeUrl } from '../utils/url.js';

const WORKERS_DIR = path.resolve(process.cwd(), '..', 'workers', 'src');

let PYTHON_PATH = process.env.PYTHON_PATH || '';
if (!PYTHON_PATH) {
  const venvWin = path.resolve(process.cwd(), '..', 'workers', 'venv', 'Scripts', 'python.exe');
  const venvLinux = path.resolve(process.cwd(), '..', 'workers', 'venv', 'bin', 'python');
  if (fs.existsSync(venvWin)) PYTHON_PATH = venvWin;
  else if (fs.existsSync(venvLinux)) PYTHON_PATH = venvLinux;
  else PYTHON_PATH = 'python';
}
interface ContactCandidate {
  name: string;
  email?: string;
  phone?: string;
  title?: string;
  department?: string;
  linkedin?: string;
  decision_maker_score: number;
  decision_maker: boolean;
  confidence_score: number;
  category?: 'validated' | 'probable';
  candidate_type?: 'PERSON' | 'BUSINESS_SECTION' | 'CTA' | 'MENU_ITEM' | 'MARKETING_COPY';
  reasons: string[];
  source?: string;
  sectionType?: string;
  hasImage?: boolean;
  hasLinkedin?: boolean;
  hasEmail?: boolean;
  hasPhone?: boolean;
  contactCategory?: 'LEADERSHIP_CONTACT' | 'TEAM_CONTACT' | 'UNKNOWN_CONTACT';
}

const DECISION_MAKER_KEYWORDS: Record<string, number> = {
  'founder': 100, 'co-founder': 95, 'ceo': 95, 'owner': 95, 
  'chief executive': 95, 'managing director': 90, 'director': 90,
  'partner': 85, 'managing partner': 85, 'president': 90, 'vice president': 75,
  'vp': 75, 'cto': 90, 'cio': 90, 'coo': 90, 'cfo': 90, 'medical director': 90,
  'general manager': 70, 'gm': 70, 'branch manager': 70, 'regional manager': 70,
  'operations manager': 70, 'head of operations': 75, 'sales manager': 70,
  'marketing manager': 70, 'head of marketing': 75, 'business development manager': 70,
  'store manager': 70, 'clinic head': 80, 'hr manager': 70,
  'doctor': 80, 'psychiatrist': 80, 'clinical psychologist': 80,
  'psychologist': 80, 'dentist': 80,
  'manager': 70, 'head': 70,
  'consultant': 60, 'principal': 60, 'lead': 50, 'supervisor': 45,
  'coordinator': 30, 'executive': 30, 'associate': 20,
};

const REJECT_KEYWORDS = [
  'company', 'agency', 'services', 'centre', 'center', 
  'foundation', 'associates', 'pvt ltd', 'private limited', 
  'group', 'support', 'info', 'hello', 'contact', 'admin', 'sales',
  'llc', 'inc', 'ltd', 'limited', 'corporation', 'corp', 'team',
  'office', 'help', 'no-reply', 'noreply', 'billing', 'accounts',
  // New brand/company/non-human keywords
  'systems', 'technologies', 'technology', 'solutions', 'networks', 
  'ventures', 'capital', 'holdings', 'industry', 'industries', 
  'enterprise', 'enterprises', 'partner', 'partners', 'consulting', 
  'consultancy', 'academy', 'institute', 'institutes', 'university', 
  'college', 'school', 'schools', 'trust', 'board', 'council', 
  'clinic', 'clinics', 'hospital', 'hospitals', 'dental', 'medical', 
  'healthcare', 'care', 'therapy', 'therapies', 'wellness', 'studio', 
  'studios', 'lab', 'labs', 'hub', 'hubs', 'club', 'clubs', 'society', 
  'association', 'alliance', 'network', 'brand', 'brands', 'app', 
  'apps', 'application', 'applications', 'device', 'devices', 
  'hardware', 'equipment', 'material', 'materials', 'goods', 'item', 
  'items', 'press', 'media', 'news', 'blog', 'forum', 'channel', 
  'channels', 'publish', 'publishing', 'publication', 'publications',
  'award', 'awards', 'prize', 'prizes', 'medal', 'medals', 'honour', 
  'honours', 'honor', 'honors', 'shri', 'padma', 'ratna', 'nobel',
  'coach', 'coaches', 'coaching', 'train', 'trainer', 'trainers', 
  'training', 'course', 'courses', 'class', 'classes'
];

function hasBrandCasing(word: string): boolean {
  if (/[a-z][A-Z]/.test(word)) {
    if (/^(mac|mc)[A-Z]/i.test(word)) {
      return false;
    }
    return true;
  }
  return false;
}

// Phase 1 V5.1: Product/Platform/Feature/Action term blacklist
// Any candidate whose name contains one of these terms is definitively NOT a human
const PRODUCT_TERMS = new Set([
  // Software product names
  'crm', 'analytics', 'vault', 'publish', 'oneauth', 'books', 'creator',
  'mail', 'desk', 'assist', 'campaign', 'workflow', 'automation',
  // Platform / Infrastructure
  'platform', 'product', 'service', 'solution', 'suite', 'cloud', 'hub',
  'studio', 'portal', 'engine', 'framework', 'api', 'sdk', 'plugin',
  // Action / Setup words that appear as product names
  'setup', 'guide', 'install', 'deploy', 'configure', 'integrate',
  'dashboard', 'console', 'admin', 'panel', 'module', 'extension',
  // Zoho-specific and similar SaaS products
  'invoice', 'inventory', 'recruit', 'survey', 'connect', 'cliq',
  'meeting', 'webinar', 'sign', 'learn', 'projects', 'sprints', 'bigin',
  'catalyst', 'appsmith', 'qengine', 'orchestly', 'directory',
  // Generic product categories
  'app', 'software', 'tool', 'system', 'payment', 'billing', 'subscription',
  'enterprise', 'professional', 'premium', 'ultimate', 'basic', 'starter',
]);

// Phase 2 V5.1: Executive titles that prove a contact is a real decision-maker
const EXECUTIVE_TITLE_KEYWORDS = [
  'founder', 'co-founder', 'cofounder', 'ceo', 'coo', 'cto', 'cfo', 'cmo',
  'president', 'vice president', 'director', 'vp', 'head of', 'head,',
  'managing director', 'managing partner', 'partner', 'owner', 'chairperson',
  'doctor', 'dr.', 'dentist', 'psychiatrist', 'psychologist', 'consultant',
  'manager', 'lead', 'principal', 'chief'
];

const ALLOWED_LONG_NAME_PREFIXES = ['dr.', 'mr.', 'mrs.', 'ms.', 'prof.', 'dr'];
const MARKETING_PHRASES = [
  'call now', 'get started', 'learn more', 'read more', 'contact us',
  'shop now', 'buy now', 'team member', 'executive profiles', 'apple fellow',
  'visit store', 'book appointment', 'book now', 'start today', 'free consultation',
  'click here', 'our team', 'about us', 'find out more',];

const BUSINESS_SECTION_PHRASES = [
  "web development", "paid advertising", "content creation", "service area",
  "client outcomes", "how we win", "our origin", "case studies", "testimonials",
  "success stories", "frequently asked questions", "about us", "services",
  "precision over volume", "radical transparency", "products", "pricing",
  "solutions", "partners", "trusted partners", "features", "benefits",
  "why choose us", "our approach", "our process", "privacy policy"
];

const CTA_PHRASES = [
  "click here", "buy now", "subscribe", "download", "get a quote", "sign up", "register"
];

const REJECTED_CONTACT_PHRASES = [
  "our story",
  "our doctors",
  "our clinics",
  "our team",
  "our services",
  "our partners",
  "our locations",
  "about us",
  "contact us",
  "learn more",
  "read more",
  "book appointment",
  "schedule appointment",
  "find a doctor",
  "find doctor",
  "meet our doctors",
  "know more",
  "explore more",
  "view all",
  "our treatments",
  "our specialties",
  "dental care",
  "mental health",
  "healthcare services",
  "our approach",
  "our mission",
  "our vision"
];

function looksLikeHumanName(name: string): boolean {
  // Strip out numeric suffixes (like registration IDs or phone numbers that sometimes bleed in)
  const cleanName = name.replace(/[\d\(\)\-\+]/g, '').trim();
  const words = cleanName.split(/\s+/).filter(w => w.length > 0);

  if (words.length < 2 || words.length > 4)
      return false;

  // Allow letters, dots, hyphens, and apostrophes
  return words.every(word =>
      /^[A-Za-z\.'-]+$/.test(word)
  );
}

function normalizeContactName(name: string): string {
  let cleanName = name.replace(/[\d\(\)\-\+]/g, '').trim();
  // Strip trailing titles like ", CEO" or " - Director"
  cleanName = cleanName.replace(/[,|\-].*/g, '');
  // Strip parens like "(Founder)"
  cleanName = cleanName.replace(/\(.*\)/g, '');
  
  const words = cleanName.trim().split(/\s+/);
  // Strip single-letter initials at the end if there are at least 2 other words
  if (words.length >= 3 && words[words.length - 1].length === 1) {
    words.pop();
  }
  
  cleanName = words.join(' ');
  // Strip titles like Dr, Mr, Ms
  cleanName = cleanName.replace(/\b(dr\.?|mr\.?|mrs\.?|ms\.?|prof\.?)\b/gi, '');
  
  // Strip remaining punctuation
  cleanName = cleanName.replace(/[^a-zA-Z\s-]/g, '').replace(/\s+/g, ' ').trim();
  
  return cleanName;
}

function isValidTitle(title?: string): boolean {
  if (!title) return true;
  const lower = title.toLowerCase().trim();
  if (lower.length > 80) return false;
  
  const descriptivePhrases = [
    'to help', 'insights that', 'our client', 'we are', 'helping you', 
    'award on', 'award—on', 'on our', 'for our', 'from our'
  ];
  if (descriptivePhrases.some(phrase => lower.includes(phrase))) {
    return false;
  }
  
  const words = lower.split(/\s+/);
  if (words.length > 8 && !lower.includes('director of') && !lower.includes('head of') && !lower.includes('vice president of')) {
    return false;
  }
  return true;
}

export function isValidHumanName(name: string, email?: string, websiteUrl?: string): { isValid: boolean; reason?: string } {
  if (name === 'Business Contact') return { isValid: true };
  if (!name || name.trim().length < 2) return { isValid: false, reason: 'Name too short or empty' };

  const lower = name.toLowerCase();

  // 1. Check domain token if websiteUrl is provided
  if (websiteUrl) {
    try {
      const hostname = websiteUrl.replace(/https?:\/\//, '').split('/')[0].split(':')[0];
      const parts = hostname.split('.');
      if (parts.length > 0) {
        const domainToken = parts[0].toLowerCase();
        if (domainToken.length > 2 && domainToken !== 'www') {
          const nameWords = lower.split(/\s+/);
          if (nameWords.includes(domainToken)) {
            return { isValid: false, reason: 'NAME_CONTAINS_DOMAIN_BRAND' };
          }
        }
      }
    } catch (e) {}
  }

  // 2. Check country suffix at the end of the name
  const words = name.trim().split(/\s+/).filter(w => w.length > 0);
  if (words.length >= 2) {
    const lastWordLower = words[words.length - 1].toLowerCase();
    const countrySuffixes = ['india', 'uk', 'us', 'usa', 'uae'];
    if (countrySuffixes.includes(lastWordLower)) {
      return { isValid: false, reason: 'COMPANY_COUNTRY_SUFFIX_DETECTED' };
    }
  }

  // 3. Reject product/platform/feature names FIRST (highest priority)
  // Each word of the candidate name is checked individually against PRODUCT_TERMS
  for (const word of words) {
    const lowerWord = word.toLowerCase();
    const cleanWord = lowerWord.replace(/[^a-z]/g, '');
    if (cleanWord.length > 1 && PRODUCT_TERMS.has(cleanWord)) {
      return { isValid: false, reason: 'PRODUCT_NAME_DETECTED' };
    }
    
    // 4. CamelCase/PascalCase brand check
    if (hasBrandCasing(word)) {
      return { isValid: false, reason: 'BRAND_CASING_DETECTED' };
    }
  }

  // Reject keyword matches
  const nameWords = lower.split(/\s+/).map(w => w.replace(/[^a-z]/g, ''));
  for (const keyword of REJECT_KEYWORDS) {
    if (nameWords.includes(keyword)) {
      return { isValid: false, reason: `Contains rejected keyword: ${keyword}` };
    }
  }

  for (const phrase of MARKETING_PHRASES) {
    if (lower.includes(phrase)) return { isValid: false, reason: `MARKETING_ITEM_DETECTED` };
  }
  for (const phrase of REJECTED_CONTACT_PHRASES) {
    if (lower.includes(phrase)) return { isValid: false, reason: `MENU_ITEM_DETECTED` };
  }

  // Strict human name detection
  if (!looksLikeHumanName(name)) {
    return { isValid: false, reason: `Not a valid human name format` };
  }

  // Quality Filter: Reject pipe-separated text or other obviously non-human characters
  if (name.includes('|')) return { isValid: false, reason: 'Contains pipe character' };

  return { isValid: true };
}

export class ContactDiscoveryService {
  private processScrapedContacts(allScrapedContacts: any[], pythonMetrics: any = {}, websiteUrl?: string): { candidates: ContactCandidate[], validationDebug: any } {
    const validationDebug = {
      pythonContactsFound: allScrapedContacts.length,
      contactsAfterValidation: 0,
      contactsRejected: 0,
      decisionMakersFound: 0,
      decisionMakersRejected: 0,
      candidateContacts: allScrapedContacts.length,
      candidatesFromTeam: 0,
      candidatesFromLeadership: 0,
      candidatesFromTestimonials: 0,
      candidatesFromLinkedin: 0,
      rejectedBySectionFilter: 0,
      rejectedByHumanValidator: 0,
      rejectedAsServiceBlocks: 0,
      rejectedAsMarketingContent: 0,
      rejectedAsProductNames: 0,       // V5.1 Phase 1
      rejectedAsUnknownPersons: 0,     // V5.1 Phase 2
      validatedContacts: 0,
      rejectedContacts: [] as any[],
      
      // New Python Pre-Gen Metrics
      rawTextNodesScanned: pythonMetrics.rawTextNodesScanned || 0,
      profileContainersDetected: pythonMetrics.profileContainersDetected || 0,
      candidatesGenerated: pythonMetrics.candidatesGenerated || allScrapedContacts.length,
      candidatesRejectedPreGeneration: pythonMetrics.candidatesRejectedPreGeneration || 0,
      candidatesRejectedAsPhone: pythonMetrics.candidatesRejectedAsPhone || 0,
      candidatesRejectedAsCTA: pythonMetrics.candidatesRejectedAsCTA || 0,
      candidatesRejectedAsMarketing: pythonMetrics.candidatesRejectedAsMarketing || 0,
      candidatesRejectedAsPlaceholder: pythonMetrics.candidatesRejectedAsPlaceholder || 0,
      candidatesRejectedAsProductNames: pythonMetrics.rejectedAsProductNames || 0,
      sectionLabelsRejected: pythonMetrics.sectionLabelsRejected || 0,
      linkedinOwnershipFailures: pythonMetrics.linkedinOwnershipFailures || 0,
      scoreClampEvents: 0,
      duplicatesMerged: 0
    };

    const initialCandidates: ContactCandidate[] = [];

    for (const scraped of allScrapedContacts) {
      const name = (scraped.name || scraped.full_name || "Business Contact").trim();
      const title = scraped.title || undefined;
      const email = scraped.email || undefined;
      const phone = scraped.phone || undefined;
      const linkedin = scraped.linkedin || scraped.linkedin_url || undefined;
      const sectionType = scraped.sectionType || 'UNKNOWN';
      
      const hasImage = scraped.hasImage || scraped.has_image || false;
      const hasLinkedin = scraped.hasLinkedin || scraped.has_linkedin || !!linkedin;
      const hasEmail = scraped.hasEmail || scraped.has_email || !!email;
      const hasPhone = scraped.hasPhone || scraped.has_phone || !!phone;

      if (sectionType === 'TEAM_SECTION') validationDebug.candidatesFromTeam++;
      if (sectionType === 'LEADERSHIP_SECTION') validationDebug.candidatesFromLeadership++;
      if (sectionType === 'TESTIMONIAL_CARD') validationDebug.candidatesFromTestimonials++;
      if (sectionType === 'LINKEDIN_PROFILE') validationDebug.candidatesFromLinkedin++;

      // Rejections based on explicit section mapping in Python or generic
      if (['SERVICE_SECTION', 'FEATURE_SECTION'].includes(sectionType)) {
        validationDebug.rejectedAsServiceBlocks++;
        validationDebug.contactsRejected++;
        validationDebug.rejectedContacts.push({ originalName: name, originalTitle: title, reason: "SERVICE_BLOCK", score: -100, candidate_type: 'BUSINESS_SECTION' });
        continue;
      }
      if (['CTA_SECTION', 'FAQ_SECTION'].includes(sectionType)) {
        validationDebug.rejectedAsMarketingContent++;
        validationDebug.contactsRejected++;
        validationDebug.rejectedContacts.push({ originalName: name, originalTitle: title, reason: "MARKETING_CONTENT", score: -100, candidate_type: 'MARKETING_COPY' });
        continue;
      }

      // Title Quality Check
      if (title && !isValidTitle(title)) {
        validationDebug.contactsRejected++;
        validationDebug.rejectedAsMarketingContent++;
        validationDebug.rejectedContacts.push({ originalName: name, originalTitle: title, reason: "INVALID_TITLE_DETECTED", score: -100, candidate_type: 'MARKETING_COPY' });
        continue;
      }

      let score = 0;
      const reasons: string[] = [];
      let rejectReason: string | null = null;
      let rejectScore = 0;
      let candidateType: 'PERSON' | 'BUSINESS_SECTION' | 'CTA' | 'MENU_ITEM' | 'MARKETING_COPY' = 'PERSON';

      const lowerName = name.toLowerCase();

      // Negative Signals
      if (BUSINESS_SECTION_PHRASES.some(phrase => lowerName.includes(phrase))) {
        rejectScore = -80;
        rejectReason = "SERVICE_NAME";
        candidateType = 'BUSINESS_SECTION';
      } else if (CTA_PHRASES.some(phrase => lowerName.includes(phrase))) {
        rejectScore = -100;
        rejectReason = "CTA";
        candidateType = 'CTA';
      } else if (REJECTED_CONTACT_PHRASES.some(phrase => lowerName.includes(phrase))) {
        rejectScore = -100;
        rejectReason = "MENU_ITEM";
        candidateType = 'MENU_ITEM';
      } else if (MARKETING_PHRASES.some(phrase => lowerName.includes(phrase))) {
        rejectScore = -80;
        rejectReason = "MARKETING_PHRASE";
        candidateType = 'MARKETING_COPY';
      } else if (name !== "Business Contact") {
        const validation = isValidHumanName(name, email, websiteUrl);
        if (!validation.isValid) {
          rejectScore = -100;
          rejectReason = validation.reason || "INVALID_HUMAN_NAME";
          candidateType = 'MARKETING_COPY';
        }
      } else if (name.includes('|')) {
        rejectScore = -80;
        rejectReason = "INVALID_CHARACTERS";
      }

      if (rejectReason) {
         validationDebug.contactsRejected++;
         validationDebug.rejectedByHumanValidator++;
         if (rejectReason === "SERVICE_NAME") validationDebug.rejectedAsServiceBlocks++;
         else if (['CTA', 'MARKETING_PHRASE', 'GENERIC_PLACEHOLDER', 'INVALID_TITLE_DETECTED'].includes(rejectReason)) validationDebug.rejectedAsMarketingContent++;
         else if (['PRODUCT_NAME_DETECTED', 'NAME_CONTAINS_DOMAIN_BRAND', 'COMPANY_COUNTRY_SUFFIX_DETECTED', 'BRAND_CASING_DETECTED'].includes(rejectReason)) validationDebug.rejectedAsProductNames++;
         
         validationDebug.rejectedContacts.push({ originalName: name, originalTitle: title, reason: rejectReason, score: rejectScore, candidate_type: candidateType });
         continue;
      }

      // Positive Signals
      if (name !== "Business Contact") {
        score += 30;
        reasons.push("Human name detected");
      }
      if (title && title.trim().length > 0) {
        score += 25;
        reasons.push("Professional title detected");
      }
      if (sectionType === 'LEADERSHIP_SECTION') {
        score += 20;
        reasons.push("Appears in leadership section");
      }
      if (sectionType === 'TEAM_SECTION') {
        score += 20;
        reasons.push("Appears in team section");
      }
      if (hasLinkedin || sectionType === 'LINKEDIN_PROFILE') {
        score += 20;
        reasons.push("LinkedIn profile present");
      }
      if (hasEmail) {
        score += 20;
        reasons.push("Email address present");
      }
      if (sectionType === 'PROFILE_CARD' || sectionType === 'AUTHOR_CARD') {
        score += 15;
        reasons.push("Appears in profile card");
      }
      if (hasImage) {
        score += 15;
        reasons.push("Profile image present");
      }
      if (hasPhone) {
        score += 10;
        reasons.push("Phone number present");
      }
      
      let finalScore = score;
      if (finalScore > 100) {
        finalScore = 100;
        validationDebug.scoreClampEvents++;
      }

      if (finalScore < 40) {
        validationDebug.contactsRejected++;
        validationDebug.rejectedByHumanValidator++;
        validationDebug.rejectedContacts.push({ originalName: name, originalTitle: title, reason: "LOW_CONFIDENCE", score: finalScore, candidate_type: candidateType });
        continue;
      }

      // Clean the final name by stripping out any trailing registration numbers or phone numbers
      const cleanName = normalizeContactName(name);

      const dmScore = cleanName === "Business Contact" ? 20 : this.scoreDecisionMaker(title);
      const isDecisionMaker = dmScore >= 60;
      
      // Phase 2 V5.1: Executive Evidence Requirement
      // A contact needs either:
      //   (a) A recognized leadership section type, OR
      //   (b) An executive-level title
      // Without one of these, they are UNKNOWN_PERSON and are rejected.
      const sectionProven = ['TEAM_SECTION', 'LEADERSHIP_SECTION', 'PROFILE_CARD', 'AUTHOR_CARD', 'TESTIMONIAL_CARD', 'FALLBACK_RELATIONSHIP_SCAN'].includes(sectionType);
      const lowerTitle = (title || '').toLowerCase();
      const titleProven = EXECUTIVE_TITLE_KEYWORDS.some(kw => lowerTitle.includes(kw));
      
      if (cleanName !== 'Business Contact' && !sectionProven && !titleProven) {
        validationDebug.contactsRejected++;
        validationDebug.rejectedAsUnknownPersons++;
        validationDebug.rejectedContacts.push({ originalName: name, originalTitle: title, reason: 'UNKNOWN_PERSON_NO_EVIDENCE', score: finalScore, candidate_type: candidateType });
        continue;
      }

      let contactCategory = 'UNKNOWN_CONTACT';
      if (dmScore >= 60 || (title && title.toLowerCase().match(/(founder|ceo|coo|cto|cfo|cmo|director|president|vp|partner|owner|chairperson|managing)/))) {
        contactCategory = 'LEADERSHIP_CONTACT';
      } else if (title && title.trim() !== '') {
        contactCategory = 'TEAM_CONTACT';
      }

      // Phase 5 V5.1: Confidence Score Clamping by contact category
      let clampedScore = finalScore;
      if (contactCategory === 'LEADERSHIP_CONTACT' && clampedScore < 70) {
        clampedScore = 70;
        validationDebug.scoreClampEvents++;
      } else if (contactCategory === 'TEAM_CONTACT' && clampedScore < 50) {
        clampedScore = 50;
        validationDebug.scoreClampEvents++;
      }

      initialCandidates.push({
        name: cleanName,
        email,
        phone,
        title,
        linkedin,
        decision_maker_score: dmScore,
        decision_maker: isDecisionMaker,
        confidence_score: clampedScore,
        category: 'validated',
        candidate_type: candidateType,
        sectionType: sectionType,
        reasons: reasons,
        source: scraped.sourceUrl || scraped.source,
        contactCategory
      } as any);
    }

    // Intelligent Deduplication
    const deduplicated = new Map<string, ContactCandidate>();

    for (const c of initialCandidates) {
      const normalizedKey = c.name.toLowerCase();

      if (deduplicated.has(normalizedKey)) {
        validationDebug.duplicatesMerged++;
        const existing = deduplicated.get(normalizedKey)!;
        
        // Merge attributes prioritizing richest metadata
        const merged: ContactCandidate = {
          name: existing.name.length > c.name.length ? existing.name : c.name, // Keep the richer name
          email: existing.email || c.email,
          phone: existing.phone || c.phone,
          title: (existing.title && existing.title.length > (c.title?.length || 0)) ? existing.title : c.title,
          linkedin: existing.linkedin || c.linkedin,
          decision_maker_score: Math.max(existing.decision_maker_score, c.decision_maker_score),
          decision_maker: existing.decision_maker || c.decision_maker,
          confidence_score: Math.max(existing.confidence_score, c.confidence_score),
          category: 'validated',
          candidate_type: existing.candidate_type || c.candidate_type,
          sectionType: existing.sectionType || c.sectionType,
          reasons: Array.from(new Set([...existing.reasons, ...c.reasons])),
          source: existing.source || c.source,
          contactCategory: existing.decision_maker ? existing.contactCategory : c.contactCategory
        } as any;
        
        deduplicated.set(normalizedKey, merged);
      } else {
        deduplicated.set(normalizedKey, c);
      }
    }

    const finalCandidates = Array.from(deduplicated.values());
    
    validationDebug.validatedContacts = finalCandidates.length;
    validationDebug.decisionMakersFound = finalCandidates.filter(c => c.decision_maker).length;

    return { candidates: finalCandidates, validationDebug };
  }

  /**
   * Discover and store contacts for a company from its discovery results
   * and any crawled website data.
   */
  async discoverContacts(companyId: string): Promise<number> {
    // Get company data including any contacts already extracted
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('*, discovery_results!discovery_results_company_id_fkey(*)')
      .eq('id', companyId)
      .single();

    if (companyError || !company) {
      console.warn(`ContactDiscovery: Company ${companyId} not found`);
      return 0;
    }

    // Rule #6: Company Filtering
    const SKIP_DOMAINS = ['apple.com', 'google.com', 'microsoft.com', 'meta.com', 'amazon.com', 'samsung.com'];
    if (company.website_url && SKIP_DOMAINS.some(d => company.website_url.toLowerCase().includes(d))) {
      console.log(`[FILTER] Skipping discovery for ${company.name} (${company.website_url}) - SMB targeting only.`);
      return 0;
    }

    const candidates: ContactCandidate[] = [];

    // Extract contacts from discovery results raw_data
    const discoveryResults = company.discovery_results || [];
    for (const result of discoveryResults) {
      const rawData = result.raw_data || {};

      // If IndiaMart/TradeIndia has Contact Person
      if (rawData['Contact Person']) {
        const dmScore = this.scoreDecisionMaker(rawData['Designation']);
        candidates.push({
          name: rawData['Contact Person'],
          phone: result.raw_phone || undefined,
          email: result.raw_email || undefined,
          title: rawData['Designation'] || undefined,
          decision_maker_score: dmScore,
          decision_maker: dmScore >= 80,
          confidence_score: 80,
          reasons: ['Found in Discovery Results']
        });
      }

      // If there's an email in the raw data
      if (result.raw_email) {
        const name = this.extractNameFromEmail(result.raw_email);
        if (name && !candidates.some(c => c.email === result.raw_email)) {
          candidates.push({
            name,
            email: result.raw_email,
            phone: result.raw_phone || undefined,
            decision_maker_score: 20,
            decision_maker: false,
            confidence_score: 60,
            reasons: ['Extracted from email address']
          });
        }
      }
    }

    // Metrics Tracking
    const metrics = {
      contactsFound: candidates.length,
      contactsInserted: 0,
      websiteScrapeTime: 0,
      timeoutCount: 0
    };

    const websiteNormalizer = new WebsiteNormalizationService();
    let isDirectory = false;
    let officialWebsiteFound: string | null = null;
    let contactDiscoveryAllowed = true;
    let finalWebsiteUrl = company.website_url ? normalizeUrl(company.website_url) : null;

    if (finalWebsiteUrl && websiteNormalizer.isDirectoryDomain(finalWebsiteUrl)) {
      isDirectory = true;
      officialWebsiteFound = await websiteNormalizer.extractOfficialWebsite(finalWebsiteUrl);
      
      if (officialWebsiteFound) {
        // Update DB with official website
        await supabase.from('companies').update({ website_url: officialWebsiteFound }).eq('id', companyId);
        finalWebsiteUrl = officialWebsiteFound;
      } else {
        contactDiscoveryAllowed = false;
      }
    }

    console.log('\n--- WEBSITE VALIDATION REPORT ---');
    console.log(`Company: ${company.name}`);
    console.log(`Stored URL: ${company.website_url || 'None'}`);
    console.log(`Is Directory: ${isDirectory ? 'Yes' : 'No'}`);
    console.log(`Official Website Found: ${officialWebsiteFound || (isDirectory ? 'No' : 'N/A')}`);
    console.log(`Contact Discovery Allowed: ${contactDiscoveryAllowed ? 'Yes' : 'No'}`);
    console.log('---------------------------------\n');

    let allScrapedContacts: any[] = [];
    let pythonMetrics: any = {};
    let pythonExitCode = null;
    let pythonRawJson = '';
    
    if (contactDiscoveryAllowed && finalWebsiteUrl) {
      // Run the new Free Contact Discovery v3 pipeline
      const startTime = Date.now();
      const enrichmentResult = await this.scrapeWithFreeV3(company.name, finalWebsiteUrl, metrics);
      allScrapedContacts = enrichmentResult.contacts || [];
      pythonMetrics = enrichmentResult.metrics || {};
      pythonExitCode = enrichmentResult.exitCode;
      pythonRawJson = enrichmentResult.rawStdout;
      metrics.websiteScrapeTime = Date.now() - startTime;
    }
    
    const { candidates: newCandidates } = this.processScrapedContacts(allScrapedContacts, pythonMetrics, finalWebsiteUrl || undefined);
    for (const nc of newCandidates) {
      if (!candidates.some(c => c.name.toLowerCase() === nc.name.toLowerCase() || (nc.email && c.email === nc.email))) {
        if (nc.name.toLowerCase() !== company.name.toLowerCase()) {
          candidates.push(nc);
        }
      }
    }

    // Convert candidates to ContactInsert and use ContactRepository
    const contactRepo = new ContactRepository();
    const emailDiscoveryService = new EmailDiscoveryService();
    const phoneVerificationService = new PhoneVerificationService();
    const contactInserts: ContactInsert[] = [];

    for (const candidate of candidates) {
      let firstName = '';
      let lastName = '-';
      let decisionMakerScore = candidate.decision_maker_score;

      if (candidate.name === 'Business Contact') {
        firstName = 'Business';
        lastName = 'Contact';
        decisionMakerScore = 20;
      } else {
        const validation = isValidHumanName(candidate.name, candidate.email, company.website_url || undefined);
        if (!validation.isValid) {
          continue; // double check before insert
        }
        const nameParts = candidate.name.split(' ');
        firstName = nameParts[0] || candidate.name;
        lastName = nameParts.slice(1).join(' ') || '-';
      }

      let finalEmail = candidate.email || null;
      let emailVerified = false;
      let emailVerifiedAt: Date | null = null;

      // If no email was found during scraping, attempt discovery
      if (!finalEmail && company.website_url) {
        const discoveryResult = await emailDiscoveryService.discoverEmail(firstName, lastName, company.website_url);
        finalEmail = discoveryResult.email;
        emailVerified = discoveryResult.email_verified;
        emailVerifiedAt = discoveryResult.email_verified_at;
      }

      let finalPhone = candidate.phone || null;
      let phoneVerified = false;
      let phoneVerifiedAt: Date | null = null;

      // Validate phone number and check WhatsApp
      if (finalPhone) {
        const phoneResult = await phoneVerificationService.verifyPhone(finalPhone);
        if (phoneResult.e164Format) {
          finalPhone = phoneResult.e164Format; // Normalize to E.164
        }
        
        // We consider the phone verified if it has a valid format and is active on WhatsApp
        if (phoneResult.isValidFormat && phoneResult.isWhatsAppActive) {
          phoneVerified = true;
          phoneVerifiedAt = new Date();
        }
      }

      contactInserts.push({
        company_id: companyId,
        first_name: firstName,
        last_name: lastName,
        email: finalEmail,
        phone: finalPhone,
        title: candidate.title || null,
        department: candidate.department || null,
        linkedin_url: candidate.linkedin || null,
        is_decision_maker: decisionMakerScore >= 80,
        is_primary_contact: false,
        status: 'new',
        email_verified: emailVerified,
        email_verified_at: emailVerifiedAt,
        phone_verified: phoneVerified,
        phone_verified_at: phoneVerifiedAt,
        source: candidate.source || null,
        confidence_score: candidate.confidence_score,
        confidence_reason: candidate.source ? `Matched via ${candidate.source}` : null,
        verification_status: emailVerified || phoneVerified ? 'verified' : 'unverified',
        last_verified_at: emailVerifiedAt || phoneVerifiedAt || null,
      });
    }

    // Insert contacts (deduplication is handled by ContactRepository)
    let insertFailures = 0;
    const createdContacts = [];
    
    for (const c of contactInserts) {
      try {
        const result = await contactRepo.createContact(c);
        createdContacts.push(result);
      } catch (err: any) {
        insertFailures++;
        console.error(`[DB INSERT FAILURE] Contact: ${c.first_name} ${c.last_name} | Reason: ${err.message || JSON.stringify(err)}`);
      }
    }
    
    metrics.contactsInserted = createdContacts.length;

    let decisionMakersCount = contactInserts.filter(c => c.is_decision_maker).length;
    let emailsFound = contactInserts.filter(c => c.email).length;
    let linkedinFound = contactInserts.filter(c => c.linkedin_url).length;

    console.log('\n--- FREE CONTACT DISCOVERY REPORT ---');
    console.log(`Company: ${company.name}`);
    console.log(`Pages Crawled: ${pythonMetrics.pages_crawled || 0}`);
    console.log(`Characters Processed: ${pythonMetrics.characters_processed || 0}`);
    console.log(`AI Calls: ${pythonMetrics.ai_calls || 0}`);
    console.log(`Contacts Found: ${allScrapedContacts.length}`);
    console.log(`Decision Makers: ${decisionMakersCount}`);
    console.log(`Emails Found: ${emailsFound}`);
    console.log(`LinkedIn URLs Found: ${linkedinFound}`);
    console.log(`Contacts Saved: ${metrics.contactsInserted}`);
    console.log(`Processing Time: ${(metrics.websiteScrapeTime / 1000).toFixed(1)}s`);
    console.log('-------------------------------------\n');

    console.log(`ContactDiscovery: Created ${createdContacts.length} contacts for company ${companyId}`);
    return createdContacts.length;
  }

  /**
   * Stateless discovery test for the debug dashboard.
   * Runs the python scraper, maps the names, and returns the contacts without writing to the DB.
   */
  async testDiscovery(url: string, options: { quickAudit?: boolean } = { quickAudit: false }): Promise<{ contacts: any[], businessContacts: any[], socialProfiles: any[], contactPages: any[], metrics: any, debug: any }> {
    const metrics = { timeoutCount: 0, websiteScrapeTime: 0 };
    let allScrapedContacts: any[] = [];
    let businessContacts: any[] = [];
    let socialProfiles: any[] = [];
    let contactPages: any[] = [];
    let pythonMetrics: any = {};
    let pythonSuccess = true;
    let pythonError = '';
    const wasNormalized = true; // Since we always normalize
    
    try {
      url = normalizeUrl(url);
      const startTime = Date.now();
      let companyName = "Unknown Company";
      try { companyName = new URL(url).hostname.replace('www.', ''); } catch (e) {}
      
      const timeoutMs = options.quickAudit ? 20000 : 120000;
      const enrichmentResult = await this.scrapeWithFreeV3(companyName, url, metrics, timeoutMs, options);
      allScrapedContacts = enrichmentResult.contacts || [];
      businessContacts = enrichmentResult.businessContacts || [];
      socialProfiles = enrichmentResult.socialProfiles || [];
      contactPages = enrichmentResult.contactPages || [];
      pythonMetrics = enrichmentResult.metrics || {};
      pythonSuccess = enrichmentResult.success !== false;
      pythonError = enrichmentResult.error || '';
      metrics.websiteScrapeTime = Date.now() - startTime;
    } catch (e) {
      console.error('Test Discovery failed:', e);
      pythonSuccess = false;
      pythonError = 'EXCEPTION';
    }

    const { candidates, validationDebug } = this.processScrapedContacts(allScrapedContacts, pythonMetrics, url);

    let discoveryStatus = "SUCCESS";
    if (!pythonSuccess) {
      if (pythonError === 'TIMEOUT') discoveryStatus = 'TIMEOUT';
      else if (pythonError === 'BLOCKED') discoveryStatus = 'BLOCKED';
      else discoveryStatus = 'FETCH_FAILED';
    } else if (candidates.length === 0) {
      discoveryStatus = 'NO_CONTACTS_FOUND';
    } else if (pythonMetrics.fallbackCandidatesFound > 0 && pythonMetrics.profileContainersDetected === 0) {
      // It heavily relied on fallback
      discoveryStatus = 'SUCCESS'; 
    }

    const extendedMetrics = {
      ...pythonMetrics,
      websiteScrapeTime: metrics.websiteScrapeTime,
      timeoutCount: metrics.timeoutCount,
      urlNormalized: wasNormalized,
      fetchSucceeded: pythonSuccess,
      discoveryStatus: discoveryStatus
    };

    return { 
      contacts: candidates, 
      businessContacts,
      socialProfiles,
      contactPages,
      metrics: extendedMetrics,
      debug: { contactDiscovery: validationDebug }
    };
  }

  /**
   * Spawns the free_contact_discovery_v3.py Python script.
   */
  private scrapeWithFreeV3(companyName: string, website: string, metrics: any, timeoutMs: number = 300000, options: { quickAudit?: boolean } = {}): Promise<{contacts: any[], businessContacts: any[], socialProfiles: any[], contactPages: any[], metrics: any, exitCode: number | null, rawStdout: string, success?: boolean, error?: string}> {
    return new Promise((resolve, reject) => {
      const args = ['free_contact_discovery_v3.py', companyName, website];
      if (options.quickAudit) {
        args.push('--quick');
      }

      const pythonProcess = spawn(PYTHON_PATH, args, {
        cwd: WORKERS_DIR,
      });

      let timeoutId: NodeJS.Timeout;
      timeoutId = setTimeout(() => {
        metrics.timeoutCount++;
        pythonProcess.kill('SIGKILL');
        resolve({ contacts: [], businessContacts: [], socialProfiles: [], contactPages: [], metrics: {}, exitCode: -1, rawStdout: 'TIMEOUT', success: false, error: 'TIMEOUT' });
      }, timeoutMs);

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
        console.log(`[FreeContactDiscoveryV3 Python] ${data.toString().trim()}`);
      });

      pythonProcess.on('close', (code, signal) => {
        clearTimeout(timeoutId);
        if (signal === 'SIGTERM' || signal === 'SIGKILL') {
          console.error(`Free Contact Discovery v3 timed out after 60s and was killed.`);
          resolve({ contacts: [], businessContacts: [], socialProfiles: [], contactPages: [], metrics: {}, exitCode: -1, rawStdout: stdout, success: false, error: 'TIMEOUT' });
          return;
        }

        try {
          const jsonStart = stdout.indexOf('{');
          const jsonEnd = stdout.lastIndexOf('}') + 1;
          if (jsonStart !== -1 && jsonEnd !== -1) {
            const jsonStr = stdout.slice(jsonStart, jsonEnd);
            const parsed = JSON.parse(jsonStr);
            resolve({ 
              contacts: parsed.contacts || [], 
              businessContacts: parsed.businessContacts || [],
              socialProfiles: parsed.socialProfiles || [],
              contactPages: parsed.contactPages || [],
              metrics: parsed.metrics || {}, 
              exitCode: code, 
              rawStdout: stdout, 
              success: parsed.success, 
              error: parsed.error 
            });
          } else {
            console.error(`Free Contact Discovery v3 exited with code ${code}`);
            console.error(`stderr: ${stderr}`);
            resolve({ contacts: [], businessContacts: [], socialProfiles: [], contactPages: [], metrics: {}, exitCode: code, rawStdout: stdout, success: false, error: 'NO_JSON_FOUND' });
          }
        } catch (parseError) {
          console.error(`Failed to parse Free Contact Discovery v3 output: ${parseError}`);
          resolve({ contacts: [], businessContacts: [], socialProfiles: [], contactPages: [], metrics: {}, exitCode: code, rawStdout: stdout, success: false, error: 'PARSE_ERROR' });
        }
      });

      pythonProcess.on('error', (err) => {
        console.error(`Failed to spawn Free Contact Discovery v3: ${err.message}`);
        resolve({ contacts: [], businessContacts: [], socialProfiles: [], contactPages: [], metrics: {}, exitCode: -2, rawStdout: `SPAWN ERROR: ${err.message}`, success: false, error: 'SPAWN_ERROR' });
      });
    });
  }

  /**
   * Spawns the website_contact_scraper.py Python script which uses ScrapeGraphAI.
   */
  private scrapeContactsFromWebsite(website: string, metrics: any): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const args = ['website_contact_scraper.py', '--website', website];

      const pythonProcess = spawn(PYTHON_PATH, args, {
        cwd: WORKERS_DIR,
      });

      let timeoutId: NodeJS.Timeout;
      timeoutId = setTimeout(() => {
        metrics.timeoutCount++;
        pythonProcess.kill('SIGKILL');
        resolve([]);
      }, 120000); // 120 seconds timeout

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
        // Log Python stderr for debugging
        console.log(`[WebsiteContactScraper Python] ${data.toString().trim()}`);
      });

      pythonProcess.on('close', (code, signal) => {
        clearTimeout(timeoutId);
        if (code !== 0) {
          if (signal === 'SIGTERM') {
            console.error(`Website Contact scraper timed out after 120s and was killed.`);
          } else {
            console.error(`Website Contact scraper exited with code ${code}`);
            console.error(`stderr: ${stderr}`);
          }
          resolve([]);
          return;
        }

        try {
          const jsonStart = stdout.indexOf('[');
          const jsonEnd = stdout.lastIndexOf(']') + 1;
          if (jsonStart !== -1 && jsonEnd !== -1) {
            const jsonStr = stdout.slice(jsonStart, jsonEnd);
            const contacts = JSON.parse(jsonStr);
            resolve(contacts);
          } else {
            resolve([]);
          }
        } catch (parseError) {
          console.error(`Failed to parse website contact scraper output: ${parseError}`);
          resolve([]);
        }
      });

      pythonProcess.on('error', (err) => {
        console.error(`Failed to spawn website contact scraper: ${err.message}`);
        resolve([]);
      });
    });
  }

  /**
   * Score a job title for decision-maker likelihood (0-100).
   */
  scoreDecisionMaker(title?: string): number {
    if (!title) return 20;
    const lower = title.toLowerCase().trim();

    if (/(founder|ceo|owner|president|chairman|chief executive)/.test(lower)) return 95;
    if (/(director|partner|managing director|vp|vice president)/.test(lower)) return 80;
    if (/(head|lead|manager|principal)/.test(lower)) return 65;
    if (/(staff|associate|executive|coordinator)/.test(lower)) return 40;

    return 20;
  }

  /**
   * Try to extract a human name from an email address.
   */
  private extractNameFromEmail(email: string): string | null {
    const local = email.split('@')[0];
    if (!local) return null;

    const GENERIC_EMAILS = ['info', 'support', 'hello', 'contact', 'admin', 'sales'];
    if (GENERIC_EMAILS.includes(local.toLowerCase())) return null;

    // Common patterns: first.last, first_last, firstlast
    const cleaned = local
      .replace(/[._-]/g, ' ')
      .replace(/\d+/g, '')
      .trim();

    if (cleaned.length < 2) return null;

    return cleaned
      .split(' ')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }
}
