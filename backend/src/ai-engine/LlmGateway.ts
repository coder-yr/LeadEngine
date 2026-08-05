import { AiConfig } from './AiConfig.js';
import { TelemetryService } from './TelemetryService.js';

export interface LlmGenerateOptions {
    format?: 'json' | string;
    keep_alive?: string;
    stream?: boolean;
    options?: {
        num_ctx?: number;
        num_predict?: number;
        temperature?: number;
        top_p?: number;
        seed?: number;
    };
}

export class LlmGateway {
    /**
     * Generate text using a local Ollama model.
     * Returns the raw response string.
     */
    static async generate(
        model: string,
        prompt: string,
        opts: LlmGenerateOptions = {}
    ): Promise<string> {
        const start = Date.now();
        const timeoutMs = AiConfig.ollama.defaultTimeout;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await fetch(`${AiConfig.ollama.baseUrl}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal as any,
                body: JSON.stringify({
                    model,
                    prompt,
                    stream: false,
                    format: opts.format,
                    keep_alive: opts.keep_alive || '10m',
                    options: opts.options || {},
                })
            });

            if (!response.ok) {
                throw new Error(`Ollama HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json() as any;

            TelemetryService.trackEvent('llm_generate_success', {
                model,
                latencyMs: Date.now() - start,
                promptTokens: data.prompt_eval_count || 0,
                completionTokens: data.eval_count || 0,
                tokensPerSec: data.eval_count && data.eval_duration
                    ? ((data.eval_count / (data.eval_duration / 1e9)).toFixed(1))
                    : 'n/a',
            });

            return data.response as string;
        } catch (error: any) {
            if (error.name === 'AbortError') {
                TelemetryService.trackError('llm_timeout', { model, timeoutMs });
                throw new Error(`Ollama model ${model} timed out after ${timeoutMs}ms`);
            }
            TelemetryService.trackError('llm_generate_error', { model, error: error.message });
            throw error;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    /**
     * Check if a model is currently loaded in Ollama (warm).
     */
    static async isModelLoaded(model: string): Promise<boolean> {
        try {
            const res = await fetch(`${AiConfig.ollama.baseUrl}/api/ps`);
            if (!res.ok) return false;
            const data = await res.json() as any;
            return data.models?.some((m: any) => m.name === model) ?? false;
        } catch {
            return false;
        }
    }
}

