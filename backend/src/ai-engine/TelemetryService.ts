/**
 * Tracks AI request performance, latency, and usage.
 */
import { AiConfig } from './AiConfig.js';

export class TelemetryService {
    static trackEvent(event: string, meta: any = {}) {
        if (!AiConfig.telemetry.enabled) return;
        console.log(`[Telemetry] ${event}`, JSON.stringify({
            timestamp: new Date().toISOString(),
            ...meta
        }));
    }

    static trackError(event: string, error: any) {
        if (!AiConfig.telemetry.enabled) return;
        console.error(`[Telemetry Error] ${event}`, error);
    }
}

