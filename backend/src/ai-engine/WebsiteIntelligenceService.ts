
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import Redis from 'ioredis';
import { redisConfig } from '../config/redis.js';
import { TelemetryService } from './TelemetryService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const redis = new Redis(redisConfig as any);

import { QueueEvents } from 'bullmq';
import { websiteExecuteQueue } from '../orchestration/Queues.js';

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
            const result = await this.runPythonCrawlerViaQueue(normalizedUrl);
            
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

    private static async runPythonCrawlerViaQueue(url: string): Promise<WebsiteDocument> {
        const queueEvents = new QueueEvents('website.execute.queue', { connection: redisConfig });
        
        // Use a unique ID for this ad-hoc test
        const jobId = `test-audit-${Date.now()}`;
        
        const job = await websiteExecuteQueue.add('run-website-intelligence-adhoc', {
            url,
            pipelineId: jobId, // dummy
            companyId: null,
            traceId: jobId
        }, { jobId });

        try {
            // Wait up to 60 seconds
            const result = await job.waitUntilFinished(queueEvents, 60000);
            
            if (result.status === 'error' || result.status === 'failed') {
                throw new Error(result.error || 'Crawler failed');
            }
            
            return result as WebsiteDocument;
        } finally {
            await queueEvents.close();
        }
    }
}

