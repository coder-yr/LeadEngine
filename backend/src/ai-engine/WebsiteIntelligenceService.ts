import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import Redis from 'ioredis';
import { redisConfig } from '../config/redis';
import { TelemetryService } from './TelemetryService';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const redis = new Redis(redisConfig as any);

export interface WebsiteDocument {
    url: string;
    pages: string[];
    meta: Record<string, string>;
    hero: string;
    about: string;
    services: string[];
    products: string[];
    leadership: string[];
    testimonials: string[];
    faq: string[];
    footer: { raw?: string };
    rawText?: string;
    contacts: Record<string, any>;
    socialProfiles: Record<string, any>;
    technology: string[];
    businessSignals: string[];
    qualityMetrics: Record<string, any>;
    crawlMetrics: Record<string, any>;
}

export class WebsiteIntelligenceService {
    /**
     * Crawls a website and extracts structured intelligence deterministically.
     * Caches the result in Redis for 24 hours.
     */
    static async crawl(url: string, bypassCache: boolean = false): Promise<WebsiteDocument> {
        const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
        const cacheKey = `website_doc:${normalizedUrl}`;

        if (!bypassCache) {
            const cached = await redis.get(cacheKey);
            if (cached) {
                TelemetryService.trackEvent('website_crawl_cache_hit', { url: normalizedUrl });
                return JSON.parse(cached) as WebsiteDocument;
            }
        }

        TelemetryService.trackEvent('website_crawl_start', { url: normalizedUrl });
        const startTime = Date.now();

        try {
            const result = await this.spawnPythonCrawler(normalizedUrl);
            
            const elapsed = Date.now() - startTime;
            TelemetryService.trackEvent('website_crawl_success', { 
                url: normalizedUrl, 
                latencyMs: elapsed,
                pagesProcessed: result.pages?.length || 0,
                techFound: result.technology?.length || 0,
                signalsFound: result.businessSignals?.length || 0,
                requestsUsed: result.crawlMetrics?.requestsUsed,
                playwrightUsed: result.crawlMetrics?.playwrightUsed
            });

            // Cache for 24 hours (86400 seconds)
            await redis.set(cacheKey, JSON.stringify(result), 'EX', 86400);

            return result;
        } catch (error) {
            TelemetryService.trackError('website_crawl_error', { url: normalizedUrl, error: (error as any).message });
            throw error;
        }
    }

    private static spawnPythonCrawler(url: string): Promise<WebsiteDocument> {
        return new Promise((resolve, reject) => {
            // Resolve virtualenv python path relative to backend src folder (../../../workers/venv)
            let pythonPath = 'python';
            const venvWin = path.resolve(__dirname, '../../../workers/venv/Scripts/python.exe');
            const venvLinux = path.resolve(__dirname, '../../../workers/venv/bin/python');

            if (fs.existsSync(venvWin)) {
                pythonPath = venvWin;
            } else if (fs.existsSync(venvLinux)) {
                pythonPath = venvLinux;
            } else if (process.env.VIRTUAL_ENV) {
                pythonPath = path.join(process.env.VIRTUAL_ENV, 'Scripts', 'python.exe');
            }
                
            const scriptPath = path.resolve(__dirname, '../../../workers/src/website_crawler.py');

            const child = spawn(pythonPath, [scriptPath, url]);

            let stdoutData = '';
            let stderrData = '';

            child.stdout.on('data', (data) => {
                stdoutData += data.toString();
            });

            child.stderr.on('data', (data) => {
                stderrData += data.toString();
            });

            child.on('close', (code) => {
                if (code !== 0) {
                    return reject(new Error(`Crawler exited with code ${code}. Stderr: ${stderrData}`));
                }

                try {
                    // Extract JSON block
                    const jsonMatch = stdoutData.match(/\{[\s\S]*\}/);
                    if (!jsonMatch) {
                        return reject(new Error('No valid JSON returned from crawler.'));
                    }
                    const parsed = JSON.parse(jsonMatch[0]);
                    if (parsed.error) {
                        return reject(new Error(`Crawler script error: ${parsed.error}`));
                    }
                    resolve(parsed as WebsiteDocument);
                } catch (e) {
                    reject(new Error(`Failed to parse crawler output: ${(e as any).message}. Output: ${stdoutData.substring(0, 500)}`));
                }
            });
            
            // 45-second overall safety timeout (python script internal limits are 20s)
            setTimeout(() => {
                child.kill();
                reject(new Error('Crawler process timed out after 45s.'));
            }, 45000);
        });
    }
}
