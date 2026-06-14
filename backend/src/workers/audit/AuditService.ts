import * as cheerio from 'cheerio';
import { AuditResult, AuditIssue } from './types.js';

export class AuditService {
  private async fetchWithTimeout(url: string, timeoutMs: number = 10000): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { signal: controller.signal as any });
      clearTimeout(id);
      return response;
    } catch (err) {
      clearTimeout(id);
      throw err;
    }
  }

  async auditWebsite(url: string): Promise<AuditResult> {
    if (!url.startsWith('http')) {
      url = `https://${url}`;
    }

    let sslEnabled = false;
    let html = '';
    let response: Response | null = null;
    
    const issues: AuditIssue[] = [];
    
    try {
      response = await this.fetchWithTimeout(url);
      sslEnabled = url.startsWith('https') && response.ok;
      html = await response.text();
    } catch (e: any) {
      // Failed to load HTTPS, try HTTP if we appended HTTPS ourselves
      if (url.startsWith('https://')) {
        const fallbackUrl = url.replace('https://', 'http://');
        try {
          response = await this.fetchWithTimeout(fallbackUrl);
          sslEnabled = false;
          html = await response.text();
        } catch (fallbackError: any) {
           throw new Error(`Website unreachable: ${e.message}`);
        }
      } else {
        throw new Error(`Website unreachable: ${e.message}`);
      }
    }
    
    if (!sslEnabled) {
      issues.push({ type: 'security', message: 'Website does not support HTTPS/SSL securely.', severity: 'high' });
    }

    const $ = cheerio.load(html);
    
    // SEO Checks
    let seoScore = 0;
    const title = $('title').text().trim();
    if (title) {
      seoScore += 30;
    } else {
      issues.push({ type: 'seo', message: 'Missing <title> tag', severity: 'high' });
    }
    
    const metaDescription = $('meta[name="description"]').attr('content')?.trim();
    if (metaDescription) {
      seoScore += 30;
    } else {
      issues.push({ type: 'seo', message: 'Missing meta description', severity: 'medium' });
    }
    
    const h1 = $('h1').text().trim();
    if (h1) {
      seoScore += 20;
    } else {
      issues.push({ type: 'seo', message: 'Missing <h1> tag', severity: 'medium' });
    }
    
    // Check if canonical exists
    if ($('link[rel="canonical"]').length > 0) {
      seoScore += 20;
    } else {
      issues.push({ type: 'seo', message: 'Missing canonical link', severity: 'low' });
    }

    // Widgets and conversion elements
    const hasContactForm = $('form').length > 0;
    if (!hasContactForm) {
      issues.push({ type: 'conversion', message: 'No contact forms detected', severity: 'medium' });
    }

    const htmlString = html.toLowerCase();
    const hasWhatsAppWidget = htmlString.includes('wa.me') || 
                              htmlString.includes('api.whatsapp.com') || 
                              htmlString.includes('whatsapp');
                              
    if (!hasWhatsAppWidget) {
      issues.push({ type: 'conversion', message: 'No WhatsApp widget detected', severity: 'low' });
    }

    // Mobile Viewport
    const viewport = $('meta[name="viewport"]').attr('content');
    const mobileFriendly = !!viewport && viewport.includes('width=device-width');
    if (!mobileFriendly) {
      issues.push({ type: 'performance', message: 'Missing mobile viewport meta tag', severity: 'high' });
    }

    // Rough page speed proxy (DOM complexity and heavy elements)
    let pageSpeedEstimate = 100;
    if ($('img:not([loading="lazy"])').length > 5) pageSpeedEstimate -= 20;
    if ($('script[src]').length > 10) pageSpeedEstimate -= 20;
    if ($('*').length > 1500) pageSpeedEstimate -= 20; // Extremely large DOM
    
    if (pageSpeedEstimate < 80) {
      issues.push({ type: 'performance', message: 'Large DOM size or excessive synchronous scripts/images detected', severity: 'medium' });
    }
    
    // Social Links
    const socialLinksFound: string[] = [];
    const socialDomains = ['linkedin.com', 'twitter.com', 'facebook.com', 'instagram.com', 'youtube.com'];
    
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href')?.toLowerCase() || '';
      for (const domain of socialDomains) {
        if (href.includes(domain) && !socialLinksFound.some(l => l.includes(domain))) {
          socialLinksFound.push(href);
        }
      }
    });

    let auditSummary = `The website scored ${seoScore}/100 for SEO. `;
    if (!sslEnabled) auditSummary += 'It lacks a valid SSL certificate. ';
    if (mobileFriendly) auditSummary += 'It appears to be mobile-friendly. ';
    else auditSummary += 'It lacks mobile responsiveness tags. ';
    if (!hasContactForm && !hasWhatsAppWidget) auditSummary += 'It lacks strong lead conversion widgets.';
    else auditSummary += 'It has lead conversion elements in place.';
    
    return {
      url,
      seoScore,
      mobileFriendly,
      sslEnabled,
      pageSpeedEstimate,
      hasContactForm,
      hasWhatsAppWidget,
      socialLinksFound,
      auditSummary,
      issues
    };
  }
}
