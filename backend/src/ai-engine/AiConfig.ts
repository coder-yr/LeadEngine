import dotenv from 'dotenv';
dotenv.config();

export const AiConfig = {
    ollama: {
        baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
        defaultTimeout: 60000,
    },
    huggingface: {
        apiKey: process.env.HUGGINGFACE_API_KEY || '',
        baseUrl: process.env.HUGGINGFACE_BASE_URL || 'https://api-inference.huggingface.co/models',
    },
    telemetry: {
        enabled: process.env.AI_TELEMETRY_ENABLED === 'true' || true,
    }
};
