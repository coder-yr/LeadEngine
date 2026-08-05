import Redis from 'ioredis';
import { redisConfig } from '../config/redis.js';
import { EmbeddingGateway, EmbeddingVector } from './EmbeddingGateway.js';
import { TelemetryService } from './TelemetryService.js';
import { WebsiteDocument } from './WebsiteIntelligenceService.js';

// ─── Redis TTL ────────────────────────────────────────────────────────────────

const EMBEDDING_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CompanyEmbedding {
    companyId: string;
    url: string;
    industry: string;
    profileVector: EmbeddingVector;      // Full company profile embedding
    servicesVector?: EmbeddingVector;    // Services/products embedding
    industryVector?: EmbeddingVector;    // Industry label embedding (for similarity)
    generatedAt: string;
    model: string;
}

export interface SimilarCompany {
    companyId: string;
    url: string;
    industry: string;
    similarity: number;
}

// ─── Text builders for different embedding purposes ──────────────────────────

function buildProfileText(doc: WebsiteDocument, industry: string): string {
    const parts: string[] = [];
    if (doc.meta?.title) parts.push(doc.meta.title);
    if (doc.meta?.description) parts.push(doc.meta.description);
    if (doc.hero) parts.push(doc.hero);
    if (doc.about) parts.push(doc.about.substring(0, 300));
    if (industry && industry !== 'Unknown') parts.push(`Industry: ${industry}`);
    return parts.join('. ').substring(0, 512);
}

function buildServicesText(doc: WebsiteDocument): string {
    const parts: string[] = [];
    if (doc.services?.length > 0) parts.push(...doc.services.slice(0, 5).map(s => s.substring(0, 100)));
    if (doc.products?.length > 0) parts.push(...doc.products.slice(0, 3).map(p => p.substring(0, 100)));
    return parts.join('. ').substring(0, 512);
}

// ─── Main Service ─────────────────────────────────────────────────────────────

export class KnowledgeEngineService {
    private static redis = new Redis(redisConfig as any);

    /**
     * Generates and stores embeddings for a company profile.
     * Embeddings are derived from the WebsiteDocument — no DB calls needed.
     */
    static async embedCompany(
        companyId: string,
        doc: WebsiteDocument,
        industry: string = 'Unknown'
    ): Promise<CompanyEmbedding> {
        const start = Date.now();
        TelemetryService.trackEvent('knowledge_engine_embed_start', { companyId, url: doc.url });

        const profileText = buildProfileText(doc, industry);
        const servicesText = buildServicesText(doc);
        const industryText = industry !== 'Unknown' ? `${industry} company` : '';

        // Batch embed all at once to minimize API calls
        const textsToEmbed = [profileText];
        if (servicesText.trim().length > 10) textsToEmbed.push(servicesText);
        if (industryText) textsToEmbed.push(industryText);

        const vectors = await EmbeddingGateway.generateEmbeddings(textsToEmbed);

        const embedding: CompanyEmbedding = {
            companyId,
            url: doc.url,
            industry,
            profileVector: vectors[0],
            servicesVector: vectors[1],
            industryVector: vectors[2],
            generatedAt: new Date().toISOString(),
            model: 'BAAI/bge-small-en-v1.5',
        };

        // Store in Redis
        const key = `embedding:company:${companyId}`;
        await KnowledgeEngineService.redis.set(key, JSON.stringify(embedding), 'EX', EMBEDDING_TTL_SECONDS);

        // Also index by URL for lookup
        await KnowledgeEngineService.redis.set(
            `embedding:url:${doc.url}`,
            companyId,
            'EX',
            EMBEDDING_TTL_SECONDS
        );

        // Track in the global company index (set of all embedded company IDs)
        await KnowledgeEngineService.redis.sadd('embedding:company_index', companyId);

        TelemetryService.trackEvent('knowledge_engine_embed_complete', {
            companyId,
            dimensions: vectors[0].length,
            batchSize: textsToEmbed.length,
            latencyMs: Date.now() - start,
        });

        return embedding;
    }

    /**
     * Retrieve stored embedding for a company.
     */
    static async getEmbedding(companyId: string): Promise<CompanyEmbedding | null> {
        const key = `embedding:company:${companyId}`;
        const cached = await KnowledgeEngineService.redis.get(key);
        if (!cached) return null;
        return JSON.parse(cached) as CompanyEmbedding;
    }

    /**
     * Find the N most similar companies to a given company using cosine similarity.
     * Compares profile vectors across all stored embeddings.
     */
    static async findSimilarCompanies(
        companyId: string,
        topN: number = 5
    ): Promise<SimilarCompany[]> {
        const target = await KnowledgeEngineService.getEmbedding(companyId);
        if (!target) {
            TelemetryService.trackError('knowledge_engine_similarity_error', {
                companyId, reason: 'No embedding found for target company'
            });
            return [];
        }

        // Get all company IDs in the index
        const allIds = await KnowledgeEngineService.redis.smembers('embedding:company_index');

        const similarities: SimilarCompany[] = [];

        for (const id of allIds) {
            if (id === companyId) continue;
            const emb = await KnowledgeEngineService.getEmbedding(id);
            if (!emb) continue;

            const similarity = EmbeddingGateway.cosineSimilarity(target.profileVector, emb.profileVector);

            similarities.push({
                companyId: id,
                url: emb.url,
                industry: emb.industry,
                similarity: Math.round(similarity * 1000) / 1000,
            });
        }

        // Sort by descending similarity and return top N
        return similarities
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, topN);
    }

    /**
     * Check if a company is a likely duplicate of an existing one
     * by comparing profile vector similarity (threshold: 0.92).
     */
    static async checkDuplicate(
        doc: WebsiteDocument,
        industry: string = 'Unknown',
        threshold: number = 0.92
    ): Promise<{ isDuplicate: boolean; matchedCompanyId?: string; similarity?: number }> {
        const profileText = buildProfileText(doc, industry);
        const [candidateVector] = await EmbeddingGateway.generateEmbeddings([profileText]);

        const allIds = await KnowledgeEngineService.redis.smembers('embedding:company_index');

        for (const id of allIds) {
            const emb = await KnowledgeEngineService.getEmbedding(id);
            if (!emb) continue;

            const similarity = EmbeddingGateway.cosineSimilarity(candidateVector, emb.profileVector);
            if (similarity >= threshold) {
                return { isDuplicate: true, matchedCompanyId: id, similarity };
            }
        }

        return { isDuplicate: false };
    }

    /**
     * Semantic search: find companies that match a free-text query
     * (e.g. "dental clinic in Mumbai with WhatsApp").
     */
    static async semanticSearch(
        query: string,
        topN: number = 10
    ): Promise<SimilarCompany[]> {
        const start = Date.now();
        const [queryVector] = await EmbeddingGateway.generateEmbeddings([query]);

        const allIds = await KnowledgeEngineService.redis.smembers('embedding:company_index');
        const results: SimilarCompany[] = [];

        for (const id of allIds) {
            const emb = await KnowledgeEngineService.getEmbedding(id);
            if (!emb) continue;

            const similarity = EmbeddingGateway.cosineSimilarity(queryVector, emb.profileVector);
            results.push({
                companyId: id,
                url: emb.url,
                industry: emb.industry,
                similarity: Math.round(similarity * 1000) / 1000,
            });
        }

        const top = results.sort((a, b) => b.similarity - a.similarity).slice(0, topN);

        TelemetryService.trackEvent('knowledge_engine_semantic_search', {
            query: query.substring(0, 50),
            totalScanned: allIds.length,
            resultsReturned: top.length,
            latencyMs: Date.now() - start,
        });

        return top;
    }

    /**
     * Delete all stored embeddings for a company.
     */
    static async deleteEmbedding(companyId: string): Promise<void> {
        const emb = await KnowledgeEngineService.getEmbedding(companyId);
        if (emb) {
            await KnowledgeEngineService.redis.del(`embedding:url:${emb.url}`);
        }
        await KnowledgeEngineService.redis.del(`embedding:company:${companyId}`);
        await KnowledgeEngineService.redis.srem('embedding:company_index', companyId);
    }
}

