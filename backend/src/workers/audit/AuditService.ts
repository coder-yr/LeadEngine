import * as cheerio from 'cheerio';
import { AuditResult, AuditIssue } from './types.js';
import { normalizeUrl } from '../../utils/url.js';

export class AuditService {
  private readonly ollamaApiUrl: string;

  constructor() {
    this.ollamaApiUrl = process.env.OLLAMA_API_URL || 'http://localhost:11434';
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

  private async fetchHighValuePages(baseUrl: string, html: string, timeoutMs: number): Promise<string[]> {
    const $ = cheerio.load(html);
    const links = new Set<string>();
    
    $('a[href]').each((_, el) => {
        const href = $(el).attr('href');
        const text = $(el).text().toLowerCase();
        if (!href) return;
        
        if (text.includes('about') || text.includes('service') || text.includes('solution') || 
            text.includes('practice') || text.includes('department') || text.includes('program') ||
            href.includes('about') || href.includes('service') || href.includes('solution') || href.includes('practice-areas')) {
            try {
                const url = new URL(href, baseUrl).toString();
                if (url.startsWith(baseUrl)) { // Same domain
                    links.add(url);
                }
            } catch (e) {}
        }
    });

    // Score and sort links. Prefer short urls and those containing "about" or "service"
    const sortedLinks = Array.from(links).sort((a, b) => a.length - b.length);
    const targetUrls = sortedLinks.slice(0, 2);
    
    const pages: string[] = [];
    await Promise.all(targetUrls.map(async (url) => {
        try {
            const res = await this.fetchWithTimeout(url, timeoutMs);
            if (res.ok) {
                const pageHtml = await res.text();
                pages.push(`\n<!-- PAGE: ${url} -->\n${pageHtml}`);
            }
        } catch (e) {}
    }));
    
    return pages;
  }

  async auditWebsite(url: string, options: { quickAudit?: boolean } = { quickAudit: false }): Promise<AuditResult> {
    const totalStart = performance.now();
    let fetchTimeMs = 0;
    let parseTimeMs = 0;
    let aiTimeMs = 0;

    url = normalizeUrl(url);

    let sslEnabled = false;
    let html = '';
    let response: Response | null = null;
    
    const issues: AuditIssue[] = [];
    
    const fetchStart = performance.now();
    const fetchTimeout = options.quickAudit ? 15000 : 30000;
    
    try {
      const homeResponse = await this.fetchWithTimeout(url, fetchTimeout);
      sslEnabled = url.startsWith('https') && homeResponse.ok;
      const homeHtml = await homeResponse.text();
      const secondaryPages = await this.fetchHighValuePages(url, homeHtml, fetchTimeout);
      html = homeHtml + secondaryPages.join('');
    } catch (e: any) {
      if (url.startsWith('https://')) {
        const fallbackUrl = url.replace('https://', 'http://');
        try {
          const fallbackResponse = await this.fetchWithTimeout(fallbackUrl, fetchTimeout);
          sslEnabled = false;
          const homeHtml = await fallbackResponse.text();
          const secondaryPages = await this.fetchHighValuePages(fallbackUrl, homeHtml, fetchTimeout);
          html = homeHtml + secondaryPages.join('');
        } catch (fallbackError: any) {
           console.warn(`Website unreachable on both https and http: ${url}`);
           html = '';
           issues.push({ type: 'performance', message: 'Website is unreachable or blocking bots. Audit is limited.', severity: 'high' });
        }
      } else {
         console.warn(`Website unreachable: ${url}`);
         html = '';
         issues.push({ type: 'performance', message: 'Website is unreachable or blocking bots. Audit is limited.', severity: 'high' });
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
        $('[id*="cookie"], [class*="cookie"], [id*="consent"], [class*="consent"]').remove();
        $('script, style, noscript, iframe, svg, canvas, img, video').remove();
        $('nav, footer, header').remove();

        // Step 2: Prioritize Main Content
        const h1h2 = $('h1, h2').map((_, el) => $(el).text().trim()).get().join(' | ');
        const metaDesc = $('meta[name="description"]').attr('content') || '';
        const heroText = $('.hero, #hero').text().trim();
        
        let bodyText = $('main').text().trim() || $('article').text().trim() || $('[role="main"]').text().trim() || $('body').text().trim();
        
        // Remove repeated text blocks (naive dedup)
        const textLines = bodyText.split('\n').map(l => l.trim()).filter(l => l.length > 20);
        const uniqueLines = Array.from(new Set(textLines));
        bodyText = uniqueLines.join(' ');

        // Step 3: Combine and Clean Text
        let websiteText = `META: ${metaDesc}\nHEADINGS: ${h1h2}\nHERO: ${heroText}\nBODY: ${bodyText}`
          .replace(/\s+/g, ' ')
          .trim();

        // Step 4: Smart Truncation (Avoid OOM on smaller GPUs)
        const textForAI = websiteText.slice(0, 6000);

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

1. Use semantic understanding. Do not rely on keyword matching.
2. If enough evidence exists, choose the closest industry from the exact list below.
3. NEVER return UNKNOWN unless confidence is genuinely 0.
4. Return valid JSON only.
5. Provide evidence as an array of explicit phrases or concepts found in the text that support your decision.
6. Confidence scores must be 0-100.

INDUSTRY LIST (You MUST choose EXACTLY one of these or null):
- Healthcare
- Mental Health
- Dental
- Legal
- Education
- Technology
- Marketing
- Finance
- Insurance
- Real Estate
- Ecommerce
- Manufacturing
- Hospitality
- Travel
- Fitness
- Automotive
- Construction
- Retail
- Consulting
- Recruitment
- Nonprofit
- Government
- Other

TASKS:
1. Determine Industry
2. Generate a concise business description
3. Detect business location if explicitly mentioned
4. Detect services offered
5. Detect business model (B2B, B2C, Both, Unknown)
6. Detect target audience
7. Estimate company size if explicitly mentioned

RETURN FORMAT:

{
  "industry": "Industry Name or null",
  "confidence": 95,
  "evidence": ["evidence 1", "evidence 2"],
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

        const modelName = 'qwen2.5:3b'; // Using qwen2.5:3b as default
        let modelReloads = 0;
        try {
          const psRes = await fetch(`${this.ollamaApiUrl}/api/ps`);
          if (psRes.ok) {
            const psData = await psRes.json() as any;
            const isLoaded = psData.models?.some((m: any) => m.name === modelName);
            if (!isLoaded) {
              modelReloads = 1;
            }
          }
        } catch (e) {
          // Ignore ps error
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 90000); // 90 seconds max
        let res;
        try {
          res = await fetch(`${this.ollamaApiUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal as any,
            body: JSON.stringify({
              model: modelName,
              prompt: prompt,
              format: 'json',
              stream: false,
              keep_alive: '24h',
              options: {
                num_ctx: 4096
              }
            })
          });
        } finally {
          clearTimeout(timeoutId);
        }

        if (!res.ok) {
          throw new Error(`Ollama HTTP error! status: ${res.status}`);
        }

        const response = await res.json() as any;

        auditDebug.ollama.rawOllamaResponse = response.response;

        const requestTimeMs = Math.round((response.total_duration || 0) / 1000000);
        const tokensPerSecond = (response.eval_count && response.eval_duration) ? ((response.eval_count / (response.eval_duration / 1000000000))).toFixed(2) : 0;
        auditDebug.ollama.instrumentation = {
          ollamaPersistent: true,
          modelLoaded: true,
          modelReloads: modelReloads,
          requestTimeMs: requestTimeMs,
          ollama_request_time: requestTimeMs,
          model_load_time: Math.round((response.load_duration || 0) / 1000000),
          prompt_tokens: response.prompt_eval_count || 0,
          completion_tokens: response.eval_count || 0,
          tokens_per_second: Number(tokensPerSecond)
        };

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
            confidence: parseInt(parsedInfo.confidence) || undefined,
            evidence: Array.isArray(parsedInfo.evidence) ? parsedInfo.evidence : [],
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
