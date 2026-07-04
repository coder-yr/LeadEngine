import { LlmGateway } from './LlmGateway';
import { ModelRegistry } from './ModelRegistry';
import { TelemetryService } from './TelemetryService';
import { LeadIntelligenceResult } from './LeadIntelligenceService';

export interface OutreachGenerationParams {
    contactName: string;
    companyName: string;
    leadIntel: LeadIntelligenceResult;
    channel: 'email' | 'whatsapp';
    tone: 'professional' | 'friendly' | 'casual' | 'direct';
    customInstructions?: string;
}

export interface OutreachGenerationResult {
    subject: string | null;
    body: string;
    channel: 'email' | 'whatsapp';
    tone: string;
    modelUsed: string;
    latencyMs: number;
}

function buildOutreachPrompt(params: OutreachGenerationParams): string {
    const { contactName, companyName, leadIntel, channel, tone, customInstructions } = params;

    // Gaps and recommendations context
    const gapsContext = leadIntel.servicesNeeded
        .map(svc => `- ${svc.service}: ${svc.reason} (Expected impact: ${svc.estimatedImpact})`)
        .join('\n');

    const basicInfo = `
- Contact Name: ${contactName}
- Company Name: ${companyName}
- Industry: ${leadIntel.industry}
- Business Model: ${leadIntel.businessModel}
- Company Size: ${leadIntel.companySize}
- Description: ${leadIntel.description}
    `.trim();

    const channelRule = channel === 'email' 
        ? `Write an EMAIL outreach. Provide a subject line starting with 'Subject: ' on the first line, followed by a blank line, and then the email body. Make it short (100-150 words).`
        : `Write a WHATSAPP message. Do NOT provide a subject line. Start directly with the greeting. Keep it extremely short (50-80 words), punchy, and include bullet points or emojis where natural.`;

    const toneRule = {
        professional: 'Keep the tone highly professional, authoritative, and focused on ROI and strategic impact.',
        friendly: 'Keep the tone warm, welcoming, relationship-focused, and supportive.',
        casual: 'Keep the tone casual, conversational, relaxed, and direct, as if writing to a peer.',
        direct: 'Keep the tone extremely concise, clear, direct, and zero-fluff, focusing straight on the pitch.'
    }[tone];

    return `You are a world-class B2B Sales copywriter. Your goal is to draft a personalized, high-conversion cold outreach message.

COMPANY & CONTACT INFORMATION:
${basicInfo}

GAPS & OPPORTUNITIES IDENTIFIED:
${gapsContext}

RULES:
1. ${channelRule}
2. ${toneRule}
3. Focus on a single high-priority gap/service (e.g. ${leadIntel.servicesNeeded[0]?.service || 'Website Development'}) to avoid overwhelming the recipient.
4. Reference specific, real evidence from their website (e.g. missing SSL, no WhatsApp widget, slow loading).
5. Do NOT use generic placeholders (e.g., [Insert Gap Here], [My Name]). Sign off simply as "LeadEngine Team".
6. End with a clear, low-friction Call to Action (e.g. "Are you open to a quick 5-minute chat next Tuesday?").
${customInstructions ? `7. CUSTOM USER REQUEST: ${customInstructions}` : ''}

Write the message now:`;
}

export class OutreachIntelligenceService {
    /**
     * Generates a personalized email or WhatsApp message using Qwen model.
     */
    static async generateOutreach(params: OutreachGenerationParams): Promise<OutreachGenerationResult> {
        const start = Date.now();
        TelemetryService.trackEvent('outreach_generate_start', {
            companyName: params.companyName,
            channel: params.channel,
            tone: params.tone
        });

        const prompt = buildOutreachPrompt(params);
        const model = ModelRegistry.outreach;

        try {
            const rawResponse = await LlmGateway.generate(model, prompt, {
                options: {
                    temperature: 0.7,
                    num_ctx: 2048,
                    num_predict: 512
                }
            });

            const latencyMs = Date.now() - start;
            const parsed = this.parseOutreachOutput(rawResponse, params.channel);

            TelemetryService.trackEvent('outreach_generate_success', {
                companyName: params.companyName,
                channel: params.channel,
                tone: params.tone,
                latencyMs
            });

            return {
                subject: parsed.subject,
                body: parsed.body,
                channel: params.channel,
                tone: params.tone,
                modelUsed: model,
                latencyMs
            };
        } catch (error: any) {
            TelemetryService.trackError('outreach_generate_error', {
                companyName: params.companyName,
                channel: params.channel,
                error: error.message
            });
            throw error;
        }
    }

    private static parseOutreachOutput(raw: string, channel: 'email' | 'whatsapp'): { subject: string | null; body: string } {
        const lines = raw.split('\n');
        
        if (channel === 'whatsapp') {
            return { subject: null, body: raw.trim() };
        }

        // For emails, check if first line specifies the subject
        let subject = 'Personalized recommendation for ' + lines[0];
        let bodyStartIdx = 0;

        const subjectMatch = lines[0].match(/^subject:\s*(.+)/i);
        if (subjectMatch) {
            subject = subjectMatch[1].trim();
            bodyStartIdx = 1;
        }

        // Reconstruct body
        const bodyLines = lines.slice(bodyStartIdx).join('\n').trim();

        return {
            subject,
            body: bodyLines
        };
    }
}
