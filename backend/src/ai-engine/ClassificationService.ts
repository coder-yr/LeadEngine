import { LocalAiGateway } from './LocalAiGateway.js';
import { LlmGateway } from './LlmGateway.js';
import { ModelRegistry } from './ModelRegistry.js';
import { TelemetryService } from './TelemetryService.js';

export interface ZeroShotResult {
    sequence: string;
    labels: string[];
    scores: number[];
}

export class ClassificationService {
    /**
     * Zero-shot classification using the configured HuggingFace model.
     * Fallback to local Ollama classification on network/DNS errors.
     */
    static async classify(text: string, candidateLabels: string[]): Promise<ZeroShotResult> {
        const start = Date.now();
        try {
            const result = await LocalAiGateway.query('classification', {
                inputs: text,
                parameters: {
                    candidate_labels: candidateLabels,
                    multi_label: false,
                },
            }) as any;

            TelemetryService.trackEvent('classification_success', {
                latencyMs: Date.now() - start,
                topLabel: result?.labels?.[0],
                topScore: result?.scores?.[0],
            });

            return result as ZeroShotResult;
        } catch (error) {
            TelemetryService.trackError('classification_error_falling_back', { error });
            return await this.classifyLocal(text, candidateLabels);
        }
    }

    /**
     * Multi-label classification — allows multiple labels to be "true" simultaneously.
     */
    static async classifyMultiLabel(text: string, candidateLabels: string[]): Promise<ZeroShotResult> {
        try {
            const result = await LocalAiGateway.query('classification', {
                inputs: text,
                parameters: {
                    candidate_labels: candidateLabels,
                    multi_label: true,
                },
            });

            return result as ZeroShotResult;
        } catch (error) {
            TelemetryService.trackError('classification_multilabel_error_falling_back', { error });
            return await this.classifyLocal(text, candidateLabels);
        }
    }

    /**
     * Local classification fallback utilizing the loaded Qwen model.
     */
    private static async classifyLocal(text: string, candidateLabels: string[]): Promise<ZeroShotResult> {
        const start = Date.now();
        try {
            const model = ModelRegistry.quickAudit; // Use hot local Qwen model
            const prompt = `You are a zero-shot text classifier.
Classify the following text into EXACTLY one of these candidate labels:
${candidateLabels.join(', ')}

TEXT:
${text.substring(0, 1000)}

Return ONLY the matching label name. Do NOT write any introduction or explanation.`;

            const rawResponse = await LlmGateway.generate(model, prompt, {
                options: { temperature: 0.1 }
            });

            const predictedLabel = rawResponse.trim();
            
            // Match the predicted text against the label list
            const matchedLabel = candidateLabels.find(l => 
                predictedLabel.toLowerCase().includes(l.toLowerCase()) || 
                l.toLowerCase().includes(predictedLabel.toLowerCase())
            ) || candidateLabels[0];

            TelemetryService.trackEvent('classification_local_success', {
                latencyMs: Date.now() - start,
                matchedLabel
            });

            return {
                sequence: text,
                labels: [matchedLabel, ...candidateLabels.filter(l => l !== matchedLabel)],
                scores: [0.9, ...candidateLabels.filter(l => l !== matchedLabel).map(() => 0.1 / Math.max(1, candidateLabels.length - 1))]
            };
        } catch (localError: any) {
            TelemetryService.trackError('classification_local_error', { error: localError.message });
            // Safe fallback
            return {
                sequence: text,
                labels: [candidateLabels[0]],
                scores: [1.0]
            };
        }
    }
}

