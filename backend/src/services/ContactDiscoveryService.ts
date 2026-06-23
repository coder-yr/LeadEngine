import { supabase } from '../config/supabase.js';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { ContactRepository } from '../db/repositories/ContactRepository.js';
import { ContactInsert } from '../types/contact.js';
import { EmailDiscoveryService } from './EmailDiscoveryService.js';
import { PhoneVerificationService } from './PhoneVerificationService.js';
import { WebsiteNormalizationService } from './WebsiteNormalizationService.js';

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
  confidence_score: number;
  source?: string;
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
  'office', 'help', 'no-reply', 'noreply', 'billing', 'accounts'
];

const ALLOWED_LONG_NAME_PREFIXES = ['dr.', 'mr.', 'mrs.', 'ms.', 'prof.', 'dr'];
const MARKETING_PHRASES = [
  'call now', 'get started', 'learn more', 'read more', 'contact us',
  'shop now', 'buy now', 'team member', 'executive profiles', 'apple fellow',
  'visit store', 'book appointment', 'book now', 'start today', 'free consultation',
  'click here', 'our team', 'about us', 'find out more', 'schedule'
];

export function isValidHumanName(name: string, email?: string): { isValid: boolean; reason?: string } {
  if (name === 'Business Contact') return { isValid: true };
  if (!name || name.trim().length < 2) return { isValid: false, reason: 'Name too short or empty' };

  const lower = name.toLowerCase();

  // Reject keyword matches
  for (const keyword of REJECT_KEYWORDS) {
    if (lower.includes(keyword)) return { isValid: false, reason: `Contains rejected keyword: ${keyword}` };
  }
  for (const phrase of MARKETING_PHRASES) {
    if (lower.includes(phrase)) return { isValid: false, reason: `Contains marketing phrase: ${phrase}` };
  }

  // Must contain alphabetic characters
  if (!/[a-zA-Z]/.test(name)) return { isValid: false, reason: 'Contains no alphabetic characters' };

  // Reject names containing numbers (Critical Rule #3)
  if (/\d/.test(name)) return { isValid: false, reason: 'Contains numbers' };

  // Reject URLs or Emails in name
  if (name.includes('http') || name.includes('www.') || name.includes('.com') || name.includes('@')) {
    return { isValid: false, reason: 'Contains URL or email' };
  }

  // Reject if > 5 words
  const words = name.trim().split(/\s+/);
  if (words.length > 5) {
    const hasAllowedPrefix = ALLOWED_LONG_NAME_PREFIXES.some(prefix => lower.includes(prefix));
    if (!hasAllowedPrefix) {
      return { isValid: false, reason: 'Too many words and no allowed prefix' };
    }
  }

  // Quality Filter: Reject pipe-separated text or other obviously non-human characters
  if (name.includes('|')) return { isValid: false, reason: 'Contains pipe character' };

  return { isValid: true };
}

export class ContactDiscoveryService {
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
        candidates.push({
          name: rawData['Contact Person'],
          phone: result.raw_phone || undefined,
          email: result.raw_email || undefined,
          title: rawData['Designation'] || undefined,
          decision_maker_score: this.scoreDecisionMaker(rawData['Designation']),
          confidence_score: 80,
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
            confidence_score: 60,
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
    let finalWebsiteUrl = company.website_url;

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
    
    for (const scraped of allScrapedContacts) {
      let fullName = scraped.full_name || scraped.name || `${scraped.first_name || ''} ${scraped.last_name || ''}`.trim();
      let email = scraped.email || undefined;
      let phone = scraped.phone || undefined;
      let linkedin = scraped.linkedin_url || undefined;
      let title = scraped.title || undefined;

      let isBusinessContact = false;

      if (!fullName) {
        if (!email && !phone && !linkedin) {
          console.log(`[VALIDATION REJECTED] Rejected Name: [Missing Name] | Reason: Missing Contact Data`);
          continue;
        }
        isBusinessContact = true;
        fullName = 'Business Contact';
        title = undefined;
      } else {
        const validation = isValidHumanName(fullName, email);
        if (!validation.isValid) {
          if (!email && !phone && !linkedin) {
            console.log(`[VALIDATION REJECTED] Rejected Name: ${fullName} | Reason: ${validation.reason}`);
            continue;
          }
          console.log(`[VALIDATION FALLBACK] Name: ${fullName} fell back to Business Contact | Reason: ${validation.reason}`);
          isBusinessContact = true;
          fullName = 'Business Contact';
          title = undefined;
        }
      }
      
      // Skip if already in candidates by exact name (case-insensitive) or exact email
      if (isBusinessContact && candidates.some(c => c.name === 'Business Contact' && c.email === email && c.phone === phone && c.linkedin === linkedin)) {
        continue;
      }
      if (!isBusinessContact && candidates.some(c => 
        c.name.toLowerCase() === fullName.toLowerCase() || 
        (email && c.email === email)
      )) {
        continue;
      }
      
      if (fullName.toLowerCase() === company.name.toLowerCase()) {
        continue;
      }

      // Rule #5: Confidence
      let confidence = 50;
      if (!isBusinessContact && title && (email || phone)) confidence = 95;
      else if (!isBusinessContact && title && !email && !phone) confidence = 80;
      else if (isBusinessContact && (email || phone)) confidence = 60;
      else if (!email && !phone && linkedin) confidence = 50;

      let dmScore = isBusinessContact ? 20 : this.scoreDecisionMaker(title);

      candidates.push({
        name: fullName,
        email: email,
        phone: phone,
        title: title,
        department: scraped.department || undefined,
        linkedin: linkedin,
        decision_maker_score: dmScore,
        confidence_score: confidence,
        source: scraped.source || undefined,
      });
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
        const validation = isValidHumanName(candidate.name);
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
  async testDiscovery(url: string, options: { quickAudit?: boolean } = { quickAudit: false }): Promise<{ contacts: any[], metrics: any, debug: any }> {
    const metrics = { timeoutCount: 0, websiteScrapeTime: 0 };
    let allScrapedContacts: any[] = [];
    let pythonMetrics: any = {};
    
    try {
      const startTime = Date.now();
      let companyName = "Unknown Company";
      try { companyName = new URL(url).hostname.replace('www.', ''); } catch (e) {}
      
      const timeoutMs = options.quickAudit ? 20000 : 120000;
      const enrichmentResult = await this.scrapeWithFreeV3(companyName, url, metrics, timeoutMs, options);
      allScrapedContacts = enrichmentResult.contacts || [];
      pythonMetrics = enrichmentResult.metrics || {};
      metrics.websiteScrapeTime = Date.now() - startTime;
    } catch (e) {
      console.error('Test Discovery failed:', e);
    }

    const candidates: any[] = [];
    const validationDebug = {
      pythonContactsFound: allScrapedContacts.length,
      contactsAfterValidation: 0,
      contactsRejected: 0,
      decisionMakersFound: 0,
      decisionMakersRejected: 0,
      rejectionReasons: {
        invalidName: 0,
        marketingPhrase: 0,
        missingContactInfo: 0,
        duplicate: 0
      },
      rejectedContacts: [] as any[]
    };

    for (const scraped of allScrapedContacts) {
      let fullName = scraped.full_name || scraped.name || `${scraped.first_name || ''} ${scraped.last_name || ''}`.trim();
      let email = scraped.email || undefined;
      let phone = scraped.phone || undefined;
      let linkedin = scraped.linkedin_url || undefined;
      let title = scraped.title || undefined;
      let isBusinessContact = false;

      const isDecisionMaker = this.scoreDecisionMaker(title) >= 80;

      if (!fullName) {
        if (!email && !phone && !linkedin) {
          validationDebug.contactsRejected++;
          validationDebug.rejectionReasons.missingContactInfo++;
          validationDebug.rejectedContacts.push({ originalName: fullName, originalTitle: title, reason: 'Missing Name & Contact Info' });
          if (isDecisionMaker) validationDebug.decisionMakersRejected++;
          continue;
        }
        isBusinessContact = true;
        fullName = 'Business Contact';
        title = undefined;
      } else {
        const validation = isValidHumanName(fullName, email);
        if (!validation.isValid) {
          validationDebug.contactsRejected++;
          if (validation.reason?.includes('marketing')) validationDebug.rejectionReasons.marketingPhrase++;
          else validationDebug.rejectionReasons.invalidName++;
          
          validationDebug.rejectedContacts.push({ originalName: fullName, originalTitle: title, email, reason: validation.reason });
          if (isDecisionMaker) validationDebug.decisionMakersRejected++;

          if (!email && !phone && !linkedin) continue;
          isBusinessContact = true;
          fullName = 'Business Contact';
          title = undefined;
        }
      }
      
      if (isBusinessContact && candidates.some(c => c.name === 'Business Contact' && c.email === email && c.phone === phone && c.linkedin === linkedin)) {
        validationDebug.contactsRejected++;
        validationDebug.rejectionReasons.duplicate++;
        validationDebug.rejectedContacts.push({ originalName: fullName, originalTitle: title, reason: 'Duplicate Business Contact' });
        continue;
      }
      if (!isBusinessContact && candidates.some(c => c.name.toLowerCase() === fullName.toLowerCase() || (email && c.email === email))) {
        validationDebug.contactsRejected++;
        validationDebug.rejectionReasons.duplicate++;
        validationDebug.rejectedContacts.push({ originalName: fullName, originalTitle: title, reason: 'Duplicate Exact Match' });
        continue;
      }

      candidates.push({
        name: fullName,
        email: email,
        phone: phone,
        title: title,
        linkedin: linkedin,
        decision_maker: !isBusinessContact && isDecisionMaker,
      });

      validationDebug.contactsAfterValidation++;
      if (!isBusinessContact && isDecisionMaker) validationDebug.decisionMakersFound++;
    }

    return { 
      contacts: candidates, 
      metrics: { ...pythonMetrics, websiteScrapeTime: metrics.websiteScrapeTime, timeoutCount: metrics.timeoutCount },
      debug: { contactDiscovery: validationDebug }
    };
  }

  /**
   * Spawns the free_contact_discovery_v3.py Python script.
   */
  private scrapeWithFreeV3(companyName: string, website: string, metrics: any, timeoutMs: number = 300000, options: { quickAudit?: boolean } = {}): Promise<{contacts: any[], metrics: any, exitCode: number | null, rawStdout: string}> {
    return new Promise((resolve, reject) => {
      const args = ['free_contact_discovery_v3.py', '--company', companyName, '--website', website];
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
        resolve({ contacts: [], metrics: {}, exitCode: -1, rawStdout: 'TIMEOUT' });
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
        if (code !== 0) {
          if (signal === 'SIGTERM' || signal === 'SIGKILL') {
            console.error(`Free Contact Discovery v3 timed out after 60s and was killed.`);
          } else {
            console.error(`Free Contact Discovery v3 exited with code ${code}`);
            console.error(`stderr: ${stderr}`);
          }
          resolve({ contacts: [], metrics: {}, exitCode: code, rawStdout: stdout });
          return;
        }

        try {
          const jsonStart = stdout.indexOf('{');
          const jsonEnd = stdout.lastIndexOf('}') + 1;
          if (jsonStart !== -1 && jsonEnd !== -1) {
            const jsonStr = stdout.slice(jsonStart, jsonEnd);
            const parsed = JSON.parse(jsonStr);
            resolve({ contacts: parsed.contacts || [], metrics: parsed.metrics || {}, exitCode: code, rawStdout: stdout });
          } else {
            resolve({ contacts: [], metrics: {}, exitCode: code, rawStdout: stdout });
          }
        } catch (parseError) {
          console.error(`Failed to parse Free Contact Discovery v3 output: ${parseError}`);
          resolve({ contacts: [], metrics: {}, exitCode: code, rawStdout: stdout });
        }
      });

      pythonProcess.on('error', (err) => {
        console.error(`Failed to spawn Free Contact Discovery v3: ${err.message}`);
        resolve({ contacts: [], metrics: {}, exitCode: -2, rawStdout: `SPAWN ERROR: ${err.message}` });
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

    for (const [keyword, score] of Object.entries(DECISION_MAKER_KEYWORDS)) {
      if (lower.includes(keyword)) return score;
    }

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
