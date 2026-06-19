import { URL } from 'url';
import https from 'https';
import http from 'http';

const DIRECTORY_DOMAINS = [
  'dentee.com',
  'practo.com',
  'justdial.com',
  'sulekha.com',
  'indiamart.com',
  'tradeindia.com',
  'yellowpages.com',
  'facebook.com',
  'instagram.com',
  'linkedin.com',
  'twitter.com',
  'x.com',
  'vymaps.com',
  'lybrate.com',
  'clinicspots.com',
  'sehat.com',
  'apollo247.com',
];

export class WebsiteNormalizationService {
  /**
   * Check if the given URL is a known directory or social media listing.
   */
  isDirectoryDomain(urlStr: string): boolean {
    if (!urlStr) return false;
    try {
      // Add protocol if missing so URL parser works
      if (!urlStr.startsWith('http://') && !urlStr.startsWith('https://')) {
        urlStr = 'https://' + urlStr;
      }
      
      const urlObj = new URL(urlStr);
      let hostname = urlObj.hostname.toLowerCase();
      if (hostname.startsWith('www.')) {
        hostname = hostname.substring(4);
      }

      return DIRECTORY_DOMAINS.some(domain => hostname.endsWith(domain));
    } catch (err) {
      console.warn(`[WebsiteNormalization] Invalid URL provided to isDirectoryDomain: ${urlStr}`);
      return false; // If we can't parse it, assume it's not a directory to avoid false positive blocks
    }
  }

  /**
   * Fetch the directory page and attempt to extract an official external website.
   * Uses simple regex over the HTML response.
   */
  async extractOfficialWebsite(directoryUrl: string): Promise<string | null> {
    if (!directoryUrl) return null;
    
    let urlStr = directoryUrl;
    if (!urlStr.startsWith('http://') && !urlStr.startsWith('https://')) {
      urlStr = 'https://' + urlStr;
    }

    // Fast-fail for specific domains that are purely social profiles and unlikely to have easily scrapeable links without auth (like Facebook/Instagram)
    const urlObj = new URL(urlStr);
    const hostname = urlObj.hostname.toLowerCase();
    if (hostname.includes('facebook.com') || hostname.includes('instagram.com') || hostname.includes('linkedin.com')) {
      // Socials require logged-in context usually. We might skip extracting here or we can try anyway.
      // We'll try anyway, but it often fails.
    }

    try {
      const html = await this.fetchWithTimeout(urlStr, 10000); // 10s timeout
      
      // Match all hrefs
      const hrefRegex = /href=["'](https?:\/\/[^"']+)["']/g;
      const matches = [...html.matchAll(hrefRegex)];
      
      for (const match of matches) {
        const link = match[1];
        try {
          const linkUrl = new URL(link);
          const linkHostname = linkUrl.hostname.toLowerCase().replace('www.', '');
          
          // Is it a completely different domain? And NOT another directory domain?
          if (!hostname.includes(linkHostname) && !this.isDirectoryDomain(link)) {
            // Found a candidate! We just return the first valid external link found.
            // Often directories link to the official site near the top.
            // Be careful not to pick up google ads, analytics, fonts, etc.
            if (!linkHostname.includes('google') && !linkHostname.includes('apple') && !linkHostname.includes('android')) {
              return link;
            }
          }
        } catch (e) {
          // ignore invalid urls in hrefs
        }
      }
      
      return null;
    } catch (err: any) {
      console.warn(`[WebsiteNormalization] Failed to extract from ${urlStr}: ${err.message}`);
      return null;
    }
  }

  private fetchWithTimeout(url: string, timeoutMs: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const client = parsedUrl.protocol === 'https:' ? https : http;

      const req = client.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      }, (res) => {
        // Handle redirects
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          let redirectUrl = res.headers.location;
          if (!redirectUrl.startsWith('http')) {
            redirectUrl = new URL(redirectUrl, url).toString();
          }
          resolve(this.fetchWithTimeout(redirectUrl, timeoutMs));
          return;
        }

        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      });

      req.on('error', err => reject(err));

      req.setTimeout(timeoutMs, () => {
        req.destroy();
        reject(new Error('Timeout fetching URL'));
      });
    });
  }
}
