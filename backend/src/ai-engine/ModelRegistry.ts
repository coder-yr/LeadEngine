/**
 * Defines the specific models used across the AI Platform.
 */
export const ModelRegistry = {
    ner: 'dslim/bert-base-NER',
    classification: 'ModernBERT-large-zeroshot-v2.0',
    embedding: 'BAAI/bge-small-en-v1.5',
    quickAudit: 'qwen2.5:3b',
    deepAnalysis: 'qwen3:8b', // Assuming a qwen3 model or fallback to qwen2.5:7b
    outreach: 'qwen3:8b',
};

export type ModelTaskType = keyof typeof ModelRegistry;
