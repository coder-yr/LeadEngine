import dns from 'dns';
import { promises as dnsPromises } from 'dns';
import { parse as parseUrl } from 'url';

export interface EmailDiscoveryResult {
  email: string | null;
  email_verified: boolean;
  email_verified_at: Date | null;
}

export class EmailDiscoveryService {
  /**
   * Generates possible email candidates based on first name, last name, and domain.
   */
  public generateCandidates(firstName: string, lastName: string, domain: string): string[] {
    const fn = firstName.toLowerCase().trim();
    const ln = lastName.toLowerCase().trim();
    const d = domain.toLowerCase().trim();

    if (!fn || !d) {
      return [`info@${d}`, `contact@${d}`, `hello@${d}`, `support@${d}`];
    }

    const candidates = [];
    
    // Core personal formats
    candidates.push(`${fn}@${d}`); // firstname@
    
    if (ln && ln !== '-') {
      candidates.push(`${fn}.${ln}@${d}`); // first.last@
      candidates.push(`${fn[0]}${ln}@${d}`); // f.last@
      candidates.push(`${fn}${ln[0]}@${d}`); // firstl@
      candidates.push(`${fn}${ln}@${d}`); // firstlast@
      candidates.push(`${fn}_${ln}@${d}`); // first_last@
      candidates.push(`${fn[0]}.${ln}@${d}`); // f.last@
    }
    
    // Role based fallbacks
    candidates.push(`contact@${d}`);
    candidates.push(`info@${d}`);

    // Deduplicate
    return [...new Set(candidates)];
  }

  /**
   * Verifies if a domain has MX records, meaning it can receive emails.
   */
  public async verifyDomain(domain: string): Promise<boolean> {
    try {
      const records = await dnsPromises.resolveMx(domain);
      return records && records.length > 0;
    } catch (error) {
      // dns module throws an error if no records are found (ENODATA, ENOTFOUND)
      return false;
    }
  }

  /**
   * Extracts clean domain from a URL
   */
  public extractDomain(websiteUrl: string): string | null {
    if (!websiteUrl) return null;
    
    try {
      let urlStr = websiteUrl.trim().toLowerCase();
      if (!urlStr.startsWith('http://') && !urlStr.startsWith('https://')) {
        urlStr = 'https://' + urlStr;
      }
      const parsed = new URL(urlStr);
      let hostname = parsed.hostname;
      
      // Remove 'www.' if present
      if (hostname.startsWith('www.')) {
        hostname = hostname.substring(4);
      }
      return hostname;
    } catch (err) {
      return null;
    }
  }

  /**
   * Discovers and verifies the best email candidate for a contact.
   * By verifying MX records, we ensure the domain can receive email.
   * If the domain has MX records, we return the primary generated candidate.
   */
  public async discoverEmail(firstName: string, lastName: string, websiteUrl: string): Promise<EmailDiscoveryResult> {
    const domain = this.extractDomain(websiteUrl);
    
    if (!domain) {
      return { email: null, email_verified: false, email_verified_at: null };
    }

    const isValidDomain = await this.verifyDomain(domain);
    
    if (!isValidDomain) {
      // If the domain itself can't receive email, return nothing
      return { email: null, email_verified: false, email_verified_at: null };
    }

    // Since MX records are valid, generate candidates and pick the most likely one
    const candidates = this.generateCandidates(firstName, lastName, domain);
    const topCandidate = candidates[0];

    return {
      email: topCandidate,
      email_verified: true, // Verified at the domain/MX level
      email_verified_at: new Date()
    };
  }
}
