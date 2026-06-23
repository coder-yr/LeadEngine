import * as cheerio from 'cheerio';
import { Ollama } from 'ollama';
import { AuditResult, AuditIssue } from './types.js';

export class AuditService {
  private readonly ollamaClient: Ollama;

  constructor() {
    this.ollamaClient = new Ollama({ host: process.env.OLLAMA_API_URL || 'http://localhost:11434' });
  }
  private async fetchWithTimeout(url: string, timeoutMs: number = 10000): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { 
        signal: controller.signal as any,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      clearTimeout(id);
      return response;
    } catch (err) {
      clearTimeout(id);
      throw err;
    }
  }

  private async findSecondaryPageAndFetch(baseUrl: string, timeoutMs: number): Promise<string> {
    const CANDIDATES = ['/contact', '/contact-us', '/about', '/services', '/service'];
    
    const checkCandidate = async (path: string) => {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), Math.min(2000, timeoutMs)); 
      try {
        const url = new URL(path, baseUrl).toString();
        const res = await fetch(url, { method: 'HEAD', signal: controller.signal as any });
        clearTimeout(id);
        if (res.ok) return url;
        throw new Error('Not found');
      } catch (e) {
        clearTimeout(id);
        throw e;
      }
    };

    try {
      const validUrl = await Promise.any(CANDIDATES.map(checkCandidate));
      const response = await this.fetchWithTimeout(validUrl, timeoutMs);
      const text = await response.text();
      return text;
    } catch (e) {
      return ''; 
    }
  }

  async auditWebsite(url: string, options: { quickAudit?: boolean } = { quickAudit: false }): Promise<AuditResult> {
    const totalStart = performance.now();
    let fetchTimeMs = 0;
    let parseTimeMs = 0;
    let aiTimeMs = 0;

    if (!url.startsWith('http')) {
      url = `https://${url}`;
    }

    let sslEnabled = false;
    let html = '';
    let response: Response | null = null;
    
    const issues: AuditIssue[] = [];
    
    const fetchStart = performance.now();
    const fetchTimeout = options.quickAudit ? 5000 : 10000;
    
    try {
      const [homeResponse, secondaryHtml] = await Promise.all([
        this.fetchWithTimeout(url, fetchTimeout),
        this.findSecondaryPageAndFetch(url, fetchTimeout)
      ]);
      
      sslEnabled = url.startsWith('https') && homeResponse.ok;
      const homeHtml = await homeResponse.text();
      html = homeHtml + "\n<!-- SECONDARY PAGE -->\n" + secondaryHtml;
    } catch (e: any) {
      if (url.startsWith('https://')) {
        const fallbackUrl = url.replace('https://', 'http://');
        try {
          const [fallbackResponse, secondaryHtml] = await Promise.all([
            this.fetchWithTimeout(fallbackUrl, fetchTimeout),
            this.findSecondaryPageAndFetch(fallbackUrl, fetchTimeout)
          ]);
          sslEnabled = false;
          const homeHtml = await fallbackResponse.text();
          html = homeHtml + "\n<!-- SECONDARY PAGE -->\n" + secondaryHtml;
        } catch (fallbackError: any) {
           throw new Error(`Website unreachable: ${e.message}`);
        }
      } else {
        throw new Error(`Website unreachable: ${e.message}`);
      }
    }
    fetchTimeMs = Math.round(performance.now() - fetchStart);
    
    if (!sslEnabled) {
      issues.push({ type: 'security', message: 'Website does not support HTTPS/SSL securely.', severity: 'high' });
    }

    const parseStart = performance.now();
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

    const hasCrm = htmlString.includes('hubspot') || htmlString.includes('salesforce') || htmlString.includes('zoho');
    const hasBookingSystem = htmlString.includes('calendly') || htmlString.includes('fresha') || htmlString.includes('booking') || htmlString.includes('setmore');
    const hasChatbot = htmlString.includes('intercom') || htmlString.includes('drift') || htmlString.includes('crisp') || htmlString.includes('tawk') || htmlString.includes('tidio');
    const hasAnalytics = htmlString.includes('google-analytics') || htmlString.includes('gtag') || htmlString.includes('fbq');

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
    
    parseTimeMs = Math.round(performance.now() - parseStart);

    let auditDebug: any = {};

    // Extract raw text for LLM parsing
    let extractedCompanyInfo = undefined;
    if (!options.quickAudit) {
      const aiStart = performance.now();
      try {
        // Step 1: Remove Non-Content Elements
        $('script, style, noscript, iframe, svg, canvas').remove();
        $('nav, footer, header').remove();

        // Step 2: Prioritize Main Content
        let websiteText =
          $('main').text().trim() ||
          $('article').text().trim() ||
          $('[role="main"]').text().trim() ||
          $('body').text().trim();

        // Step 3: Clean Text
        websiteText = websiteText
          .replace(/\s+/g, ' ')
          .replace(/\n+/g, ' ')
          .trim();

        // Step 4: Smart Truncation
        const textForAI = websiteText.slice(0, 8000);

        // Step 5: Add Debug Metrics
        auditDebug.htmlLength = $.html().length;
        auditDebug.cleanTextLength = websiteText.length;
        auditDebug.textSentToOllamaLength = textForAI.length;
        auditDebug.textPreview = textForAI.substring(0, 200);

        // Step 6: Validate Content Before AI
        if (websiteText.length < 300 || websiteText.split(' ').length < 50) {
          console.warn('Low-quality website content extracted');
        }

      if (textForAI.length > 100) {
        const prompt = `You are a Business Intelligence Extraction Engine.

Your job is to analyze website content and extract structured business information.

IMPORTANT RULES:

1. Do NOT invent, assume, hallucinate, or guess information.
2. Only use information explicitly present in the provided text.
3. Use best-effort classification.
Examples:
psychologist, therapy, counselling, psychiatrist → Mental Health
dentist, dental clinic → Dental
lawyer, advocate, law firm → Legal
ecommerce, online store → Retail
software, SaaS, platform → Technology
Only return null when absolutely no evidence exists.
4. Return valid JSON only.
5. Industry must be selected from the predefined industry list.
6. If multiple industries match, choose the strongest match.
7. Confidence scores must be 0-100.

INDUSTRY LIST:

* Healthcare
* Mental Health
* Dental
* Medical Clinic
* Hospital
* Education
* Coaching & Training
* Real Estate
* Construction
* Interior Design
* Architecture
* Legal Services
* Accounting & Finance
* Insurance
* Information Technology
* Software / SaaS
* Cybersecurity
* Digital Marketing
* Advertising Agency
* E-commerce
* Retail
* Wholesale
* Manufacturing
* Logistics & Transportation
* Automotive
* Hospitality
* Restaurant & Food Services
* Travel & Tourism
* Beauty & Cosmetics
* Fitness & Gym
* Sports
* Event Management
* Photography & Media
* NGO / Non-Profit
* Government
* Telecommunications
* Electronics
* Home Services
* Professional Services
* Consulting
* Other

TASKS:

1. Determine Industry
2. Generate a concise business description
3. Detect business location if explicitly mentioned
4. Detect services offered
5. Detect business model (B2B, B2C, Both, Unknown)
6. Detect target audience
7. Estimate company size if explicitly mentioned
8. Recommend LeadEngine services based on website weaknesses

RECOMMENDED SERVICES:

* Website Development
* Website Redesign
* SEO
* Google Ads
* Social Media Marketing
* CRM Development
* WhatsApp Automation
* AI Chatbot
* Booking System Setup
* Marketing Automation
* Lead Generation System
* Analytics Setup

RETURN FORMAT:

{
  "industry": "Industry Name or null",
  "industry_confidence": 0,
  "business_description": "Short description or null",
  "location": "City, Country or null",
  "business_model": "B2B/B2C or null",
  "target_audience": "Audience or null",
  "services_offered": ["Service 1", "Service 2"],
  "company_size": "Size or null"
}

WEBSITE CONTENT:

${textForAI}
`;
        auditDebug.ollama = { promptPreview: prompt.substring(0, 500) + '... (truncated)' };
        console.log("========== TEXT SENT TO OLLAMA ==========");
        console.log(textForAI);
        console.log("TEXT LENGTH:", textForAI.length);
        console.log("========================================");

        const response = await this.ollamaClient.generate({
          model: 'qwen2.5:3b', // Using qwen2.5:3b as default
          prompt: prompt,
          format: 'json',
          stream: false,
        });

        auditDebug.ollama.rawOllamaResponse = response.response;

        try {
          // Sanitize markdown if the LLM wraps the response
          let cleanJson = response.response;
          if (cleanJson.startsWith('\`\`\`json')) {
             cleanJson = cleanJson.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
          } else if (cleanJson.startsWith('\`\`\`')) {
             cleanJson = cleanJson.replace(/\`\`\`/g, '').trim();
          }

          const parsedInfo = JSON.parse(cleanJson);
          auditDebug.ollama.parsedJson = parsedInfo;

          extractedCompanyInfo = {
            city: parsedInfo.location ? String(parsedInfo.location).split(',')[0].trim() : undefined,
            state_province: parsedInfo.location && String(parsedInfo.location).includes(',') ? String(parsedInfo.location).split(',')[1]?.trim() : undefined,
            country: undefined,
            employee_count: parsedInfo.company_size || undefined,
            industry: parsedInfo.industry || undefined,
            industry_confidence: parseInt(parsedInfo.industry_confidence) || undefined,
            description: parsedInfo.business_description || undefined,
            business_model: parsedInfo.business_model || undefined,
            target_audience: parsedInfo.target_audience || undefined,
            services_offered: parsedInfo.services_offered || []
          };
        } catch (parseError: any) {
          auditDebug.ollama.parseError = parseError.message;
          console.warn('Failed to parse JSON from Ollama:', parseError.message);
        }
        }
      } catch (e: any) {
        if (!auditDebug.ollama) auditDebug.ollama = {};
        auditDebug.ollama.parseError = e.message;
        console.warn('Failed to extract company info using Ollama:', e.message);
      }
      aiTimeMs = Math.round(performance.now() - aiStart);
    }
    
    const totalTimeMs = Math.round(performance.now() - totalStart);
    
    return {
      url,
      seoScore,
      mobileFriendly,
      sslEnabled,
      pageSpeedEstimate,
      hasContactForm,
      hasWhatsAppWidget,
      hasCrm,
      hasBookingSystem,
      hasChatbot,
      hasAnalytics,
      socialLinksFound,
      auditSummary,
      issues,
      extractedCompanyInfo,
      fetchTimeMs,
      parseTimeMs,
      aiTimeMs,
      totalTimeMs,
      debug: auditDebug
    };
  }
}
