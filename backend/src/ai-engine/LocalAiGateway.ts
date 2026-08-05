import { TelemetryService } from './TelemetryService.js';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

export class LocalAiGateway {
    /**
     * Query the persistent local AI service.
     * @param task 'ner', 'classification', or 'embedding'
     * @param payload Request payload (typically { inputs, parameters })
     */
    static async query(task: string, payload: any): Promise<any> {
        const baseUrl = process.env.LOCAL_AI_SERVICE_URL || 'http://localhost:8001';
        let attempt = 0;
        
        while (attempt < MAX_RETRIES) {
            try {
                const response = await fetch(`${baseUrl}/infer`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ task, payload })
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Local AI Service error: ${response.status} - ${errorText}`);
                }

                return await response.json();
            } catch (error: any) {
                attempt++;
                TelemetryService.trackError('local_ai_service_error', { 
                    task, 
                    attempt, 
                    error: error.message 
                });

                if (attempt >= MAX_RETRIES) {
                    throw error;
                }
                await new Promise(res => setTimeout(res, RETRY_DELAY_MS * attempt));
            }
        }
    }
    
    static async health(): Promise<boolean> {
        const baseUrl = process.env.LOCAL_AI_SERVICE_URL || 'http://localhost:8001';
        try {
            const res = await fetch(`${baseUrl}/health`);
            return res.ok;
        } catch {
            return false;
        }
    }
}

