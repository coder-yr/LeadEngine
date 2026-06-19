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
  source?: string;
}

const DECISION_MAKER_KEYWORDS: Record<string, number> = {
  'founder': 100, 'co-founder': 95, 'ceo': 95, 'owner': 95, 
  'chief executive': 95, 'managing director': 90, 'director': 90,
  'partner': 85, 'doctor': 80, 'psychiatrist': 80, 'psychologist': 80,
  'vp': 75, 'vice president': 75, 'manager': 70, 
  'head': 70, 'general manager': 70, 'gm': 70,
  'consultant': 60, 'principal': 60, 'lead': 50, 'supervisor': 45,
  'coordinator': 30, 'executive': 30, 'associate': 20,
};

const REJECT_KEYWORDS = [
  'company', 'agency', 'services', 'clinic', 'centre', 'center', 
  'foundation', 'associates', 'pvt ltd', 'private limited', 
  'hospital', 'healthcare', 'counselling', 'counseling', 
  'psychology', 'therapies', 'mental health', 'diagnostics', 
  'laboratory', 'labs', 'real estate', 'marketing', 
  'travels', 'insurance', 'solutions', 'technologies', 'group',
  'support', 'info', 'hello', 'contact', 'admin', 'sales',
  'llc', 'inc', 'ltd', 'limited', 'corporation', 'corp', 'team'
];

const ALLOWED_LONG_NAME_PREFIXES = ['dr.', 'mr.', 'mrs.', 'ms.', 'prof.', 'dr'];

export function isValidHumanName(name: string, email?: string): { isValid: boolean; reason?: string } {
  if (!name || name.trim().length < 2) return { isValid: false, reason: 'Name too short or empty' };

  const lower = name.toLowerCase();

  // Reject generic emails like info@, support@, hello@
  if (email) {
    const emailPrefix = email.split('@')[0].toLowerCase();
    const genericPrefixes = ['info', 'support', 'hello', 'contact', 'admin', 'sales', 'office', 'help'];
    if (genericPrefixes.includes(emailPrefix)) {
      return { isValid: false, reason: 'Generic email prefix' };
    }
  }

  // Reject keyword matches
  for (const keyword of REJECT_KEYWORDS) {
    if (lower.includes(keyword)) return { isValid: false, reason: `Contains rejected keyword: ${keyword}` };
  }

  // Reject if too many words, unless allowed prefix
  const words = name.trim().split(/\s+/);
  if (words.length > 4) {
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
      const fullName = scraped.full_name || scraped.name || `${scraped.first_name || ''} ${scraped.last_name || ''}`.trim();
      if (!fullName) {
        console.log(`[VALIDATION REJECTED] Rejected Name: [Missing Name] | Reason: Missing Contact Data`);
        continue;
      }
      
      // Skip if already in candidates by exact name (case-insensitive) or exact email
      if (candidates.some(c => 
        c.name.toLowerCase() === fullName.toLowerCase() || 
        (scraped.email && c.email === scraped.email)
      )) {
        continue;
      }

      // Validate human name
      const validation = isValidHumanName(fullName, scraped.email);
      if (!validation.isValid) {
        console.log(`[VALIDATION REJECTED] Rejected Name: ${fullName} | Reason: ${validation.reason}`);
        continue;
      }
      
      if (fullName.toLowerCase() === company.name.toLowerCase()) {
        continue;
      }

      let confidence = 50;
      if (scraped.source === 'website_team_page' || scraped.source === 'website_leadership_page') {
        confidence = 100;
      } else if (scraped.source === 'website_about_page') {
        confidence = 90;
      } else if (scraped.source === 'website_homepage') {
        confidence = 70;
      }

      candidates.push({
        name: fullName,
        email: scraped.email || undefined,
        phone: scraped.phone || undefined,
        title: scraped.title || undefined,
        department: scraped.department || undefined,
        linkedin: scraped.linkedin_url || undefined,
        decision_maker_score: confidence || this.scoreDecisionMaker(scraped.title),
        source: scraped.source || undefined,
      });
    }

    // Convert candidates to ContactInsert and use ContactRepository
    const contactRepo = new ContactRepository();
    const emailDiscoveryService = new EmailDiscoveryService();
    const phoneVerificationService = new PhoneVerificationService();
    const contactInserts: ContactInsert[] = [];

    for (const candidate of candidates) {
      const validation = isValidHumanName(candidate.name);
      if (!validation.isValid) {
        continue; // double check before insert
      }

      const nameParts = candidate.name.split(' ');
      const firstName = nameParts[0] || candidate.name;
      const lastName = nameParts.slice(1).join(' ') || '-';

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
        is_decision_maker: candidate.decision_maker_score >= 80,
        is_primary_contact: false,
        status: 'new',
        email_verified: emailVerified,
        email_verified_at: emailVerifiedAt,
        phone_verified: phoneVerified,
        phone_verified_at: phoneVerifiedAt,
        source: candidate.source || null,
        confidence_score: candidate.decision_maker_score,
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
    console.log(`Pages Crawled: ${pythonMetrics['Pages Crawled'] || 0}`);
    console.log(`Characters Processed: ${pythonMetrics['Characters Processed'] || 0}`);
    console.log(`AI Calls: ${pythonMetrics['AI Calls'] || 0}`);
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
   * Spawns the free_contact_discovery_v3.py Python script.
   */
  private scrapeWithFreeV3(companyName: string, website: string, metrics: any): Promise<{contacts: any[], metrics: any, exitCode: number | null, rawStdout: string}> {
    return new Promise((resolve, reject) => {
      const args = ['free_contact_discovery_v3.py', '--company', companyName, '--website', website];

      const pythonProcess = spawn(PYTHON_PATH, args, {
        cwd: WORKERS_DIR,
      });

      let timeoutId: NodeJS.Timeout;
      timeoutId = setTimeout(() => {
        metrics.timeoutCount++;
        pythonProcess.kill('SIGKILL');
        resolve({ contacts: [], metrics: {}, exitCode: -1, rawStdout: 'TIMEOUT' });
      }, 300000); // 300 seconds timeout per company

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
