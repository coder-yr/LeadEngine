import { LlmGateway } from './LlmGateway.js';
import { NerService } from './NerService.js';
import { ClassificationService } from './ClassificationService.js';
import { EmbeddingGateway } from './EmbeddingGateway.js';
import { KnowledgeEngineService } from './EmbeddingService.js';
import { WebsiteIntelligenceService } from './WebsiteIntelligenceService.js';
import { ContactIntelligenceService } from './ContactIntelligenceService.js';
import { CompanyIntelligenceService } from './CompanyIntelligenceService.js';
import { QuickAuditService } from './QuickAuditService.js';
import { LeadIntelligenceService } from './LeadIntelligenceService.js';
import { OutreachIntelligenceService } from './OutreachIntelligenceService.js';
import { ModelRegistry } from './ModelRegistry.js';
import { PromptRegistry } from './PromptRegistry.js';

/**
 * The central facade for LeadEngine's AI Platform.
 *
 * ── Standard Pipeline ──────────────────────────────────────────────
 *
 *  const doc      = await AiGateway.Website.crawl(url);
 *  const contacts = await AiGateway.Contacts.extractContacts(doc);
 *  const company  = await AiGateway.Company.analyze(doc);
 *  const audit    = await AiGateway.QuickAudit.audit(doc);
 *  const lead     =       AiGateway.Lead.score({ doc, contacts, company, audit });
 *  await AiGateway.Knowledge.embedCompany(id, doc, company.industry.industry);
 *  const outreach = await AiGateway.Outreach.generateOutreach({ contactName, companyName, leadIntel: lead, channel: 'email', tone: 'friendly' });
 *
 * ──────────────────────────────────────────────────────────────────
 */
export class AiGateway {
    // ─── Generative (Ollama Local) ─────────────────────────────────────────────
    static get Llm() { return LlmGateway; }

    // ─── Specialized AI (HuggingFace) ─────────────────────────────────────────
    static get Ner() { return NerService; }
    static get Classification() { return ClassificationService; }
    static get Embedding() { return EmbeddingGateway; }

    // ─── Phase 2: Website ──────────────────────────────────────────────────────
    static get Website() { return WebsiteIntelligenceService; }

    // ─── Phase 3: Contacts ─────────────────────────────────────────────────────
    static get Contacts() { return ContactIntelligenceService; }

    // ─── Phase 4: Company ──────────────────────────────────────────────────────
    static get Company() { return CompanyIntelligenceService; }

    // ─── Phase 5: Knowledge Engine ─────────────────────────────────────────────
    static get Knowledge() { return KnowledgeEngineService; }

    // ─── Phase 6: Quick Audit ──────────────────────────────────────────────────
    static get QuickAudit() { return QuickAuditService; }

    // ─── Phase 7: Lead Intelligence ────────────────────────────────────────────
    static get Lead() { return LeadIntelligenceService; }

    // ─── Phase 8: Outreach AI ──────────────────────────────────────────────────
    static get Outreach() { return OutreachIntelligenceService; }

    // ─── Registries ────────────────────────────────────────────────────────────
    static get Models() { return ModelRegistry; }
    static get Prompts() { return PromptRegistry; }
}

