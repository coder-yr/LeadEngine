import { LocalAiGateway } from './LocalAiGateway.js';
import { TelemetryService } from './TelemetryService';

export type EmbeddingVector = number[];

export class EmbeddingGateway {
    /**
     * Generate embeddings for one or more text inputs.
     * BAAI/bge-small-en-v1.5 returns a 384-dimensional float vector per input.
     * Fallback to local Ollama embeddings when HuggingFace is offline/down.
     */
    static async generateEmbeddings(texts: string[]): Promise<EmbeddingVector[]> {
        const start = Date.now();
        try {
            const result = await LocalAiGateway.query('embedding', {
                inputs: texts.length === 1 ? texts[0] : texts,
            });

            TelemetryService.trackEvent('embedding_success', {
                count: texts.length,
                latencyMs: Date.now() - start,
            });

            if (texts.length === 1) {
                if (Array.isArray(result) && Array.isArray(result[0])) {
                    return [result[0] as number[]];
                }
                return [result as number[]];
            }

            return result as EmbeddingVector[];
        } catch (error) {
            TelemetryService.trackError('embedding_error', { error, count: texts.length });
            // Return empty vectors on hard failure
            return texts.map(() => Array(384).fill(0));
        }
    }



    /**
     * Generate a single embedding vector for one text.
     */
    static async embed(text: string): Promise<EmbeddingVector> {
        const results = await this.generateEmbeddings([text]);
        return results[0];
    }

    static cosineSimilarity(a: EmbeddingVector, b: EmbeddingVector): number {
        if (!a || !b || a.length !== b.length) {
            console.warn(`[EmbeddingGateway] Vector dimension mismatch: ${a?.length} vs ${b?.length}. Returning 0.`);
            return 0;
        }
        let dot = 0, normA = 0, normB = 0;
        for (let i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        const denominator = Math.sqrt(normA) * Math.sqrt(normB);
        if (denominator === 0) return 0;
        return dot / denominator;
    }
}
