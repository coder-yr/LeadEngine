import { SupabaseClient } from '@supabase/supabase-js';
import {
  intelligenceQueue,
  websiteAuditQueue,
  aiInsightsQueue,
  contactDiscoveryQueue,
  leadScoringQueue,
  websiteIntelligenceQueue,
  identityResolutionQueue,
} from '../orchestration/Queues.js';

export interface QueueHealth {
  waiting: number;
  active: number;
  failed: number;
  completed?: number;
}

export interface ServiceHealth {
  status: 'ok' | 'degraded' | 'down';
  latency_ms?: number;
  details?: Record<string, unknown>;
}

export interface SourceReliability {
  source_name: string;
  reliability_score: number;
  total_runs: number;
  successful_runs: number;
  blocked_runs: number;
  last_success_at: string | null;
  status: 'ok' | 'blocked' | 'degraded' | 'unknown';
}

export interface PipelineCounts {
  DISCOVERED: number;
  IDENTITY_RESOLVED: number;
  WEBSITE_FOUND: number;
  WEBSITE_CRAWLED: number;
  CONTACTS_FOUND: number;
  AUDIT_COMPLETE: number;
  LEAD_SCORED: number;
  READY: number;
  avg_discovery_time_sec: number;
}

export interface HealthDashboard {
  timestamp: string;
  overall_status: 'healthy' | 'degraded' | 'critical';
  services: {
    redis: ServiceHealth;
    postgresql: ServiceHealth;
    ollama: ServiceHealth;
    local_ai: ServiceHealth;
  };
  queues: Record<string, QueueHealth>;
  sources: SourceReliability[];
  pipeline: PipelineCounts;
}

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const LOCAL_AI_URL = process.env.LOCAL_AI_URL || 'http://localhost:8000';

/**
 * HealthService — Aggregates status of all platform components.
 * Polls Redis, PostgreSQL, Ollama, LocalAI, BullMQ queues, and sources.
 */
export class HealthService {
  constructor(private readonly supabase: SupabaseClient) {}

  async getDashboard(): Promise<HealthDashboard> {
    const [services, queues, sources, pipeline] = await Promise.allSettled([
      this.checkServices(),
      this.checkQueues(),
      this.checkSources(),
      this.checkPipeline(),
    ]);

    const resolvedServices =
      services.status === 'fulfilled'
        ? services.value
        : { redis: { status: 'down' as const }, postgresql: { status: 'down' as const }, ollama: { status: 'down' as const }, local_ai: { status: 'down' as const } };

    const resolvedQueues = queues.status === 'fulfilled' ? queues.value : {};
    const resolvedSources = sources.status === 'fulfilled' ? sources.value : [];
    const resolvedPipeline =
      pipeline.status === 'fulfilled' ? pipeline.value : ({} as PipelineCounts);

    // Compute overall status
    const hasDown = Object.values(resolvedServices).some((s) => s.status === 'down');
    const hasDegraded = Object.values(resolvedServices).some((s) => s.status === 'degraded');
    const overallStatus = hasDown ? 'critical' : hasDegraded ? 'degraded' : 'healthy';

    return {
      timestamp: new Date().toISOString(),
      overall_status: overallStatus,
      services: resolvedServices as HealthDashboard['services'],
      queues: resolvedQueues,
      sources: resolvedSources,
      pipeline: resolvedPipeline,
    };
  }

  private async checkServices(): Promise<HealthDashboard['services']> {
    const [redis, postgresql, ollama, localAi] = await Promise.allSettled([
      this.pingRedis(),
      this.pingPostgres(),
      this.pingOllama(),
      this.pingLocalAI(),
    ]);

    return {
      redis:       redis.status === 'fulfilled' ? redis.value : { status: 'down' },
      postgresql:  postgresql.status === 'fulfilled' ? postgresql.value : { status: 'down' },
      ollama:      ollama.status === 'fulfilled' ? ollama.value : { status: 'down' },
      local_ai:    localAi.status === 'fulfilled' ? localAi.value : { status: 'down' },
    };
  }

  private async pingRedis(): Promise<ServiceHealth> {
    const start = Date.now();
    try {
      // Ping via BullMQ's underlying Redis connection
      await intelligenceQueue.client.then((c) => c.ping());
      return { status: 'ok', latency_ms: Date.now() - start };
    } catch {
      return { status: 'down', latency_ms: Date.now() - start };
    }
  }

  private async pingPostgres(): Promise<ServiceHealth> {
    const start = Date.now();
    try {
      const { error } = await this.supabase
        .from('companies')
        .select('id')
        .limit(1);
      if (error) throw error;
      return { status: 'ok', latency_ms: Date.now() - start };
    } catch (err: any) {
      return { status: 'down', latency_ms: Date.now() - start, details: { error: err.message } };
    }
  }

  private async pingOllama(): Promise<ServiceHealth> {
    const start = Date.now();
    try {
      const ctrl = new AbortController();
      const id = setTimeout(() => ctrl.abort(), 5000);
      const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: ctrl.signal as any });
      clearTimeout(id);
      const data = await res.json() as any;
      const models = (data.models || []).map((m: any) => m.name);
      return {
        status: res.ok ? 'ok' : 'degraded',
        latency_ms: Date.now() - start,
        details: { models },
      };
    } catch {
      return { status: 'down', latency_ms: Date.now() - start };
    }
  }

  private async pingLocalAI(): Promise<ServiceHealth> {
    const start = Date.now();
    try {
      const ctrl = new AbortController();
      const id = setTimeout(() => ctrl.abort(), 5000);
      const res = await fetch(`${LOCAL_AI_URL}/health`, { signal: ctrl.signal as any });
      clearTimeout(id);
      const data = await res.json() as any;
      return {
        status: res.ok ? 'ok' : 'degraded',
        latency_ms: Date.now() - start,
        details: {
          models_loaded: data.models_loaded || 0,
          registry: data.registry || {},
        },
      };
    } catch {
      return { status: 'down', latency_ms: Date.now() - start };
    }
  }

  private async checkQueues(): Promise<Record<string, QueueHealth>> {
    const namedQueues = [
      { name: 'intelligence-queue',          queue: intelligenceQueue },
      { name: 'identity-resolution-queue',   queue: identityResolutionQueue },
      { name: 'website-intelligence-queue',  queue: websiteIntelligenceQueue },
      { name: 'contact-discovery-queue',     queue: contactDiscoveryQueue },
      { name: 'website-audit-queue',         queue: websiteAuditQueue },
      { name: 'ai-insights-queue',           queue: aiInsightsQueue },
      { name: 'lead-scoring-queue',          queue: leadScoringQueue },
    ];

    const result: Record<string, QueueHealth> = {};
    await Promise.all(
      namedQueues.map(async ({ name, queue }) => {
        try {
          const [waiting, active, failed] = await Promise.all([
            queue.getWaitingCount(),
            queue.getActiveCount(),
            queue.getFailedCount(),
          ]);
          result[name] = { waiting, active, failed };
        } catch {
          result[name] = { waiting: -1, active: -1, failed: -1 };
        }
      })
    );
    return result;
  }

  private async checkSources(): Promise<SourceReliability[]> {
    try {
      const { data, error } = await this.supabase
        .from('source_reliability')
        .select('*')
        .order('reliability_score', { ascending: false });

      if (error || !data) return [];

      return data.map((row: any): SourceReliability => {
        let status: SourceReliability['status'] = 'ok';
        if (row.blocked_runs > 0 && row.total_runs > 0) {
          const blockedRate = row.blocked_runs / row.total_runs;
          if (blockedRate > 0.5) status = 'blocked';
          else if (blockedRate > 0.2) status = 'degraded';
        }
        if (row.reliability_score < 30) status = 'degraded';
        if (row.total_runs === 0) status = 'unknown';

        return {
          source_name: row.source_name,
          reliability_score: row.reliability_score,
          total_runs: row.total_runs,
          successful_runs: row.successful_runs,
          blocked_runs: row.blocked_runs,
          last_success_at: row.last_success_at,
          status,
        };
      });
    } catch {
      return [];
    }
  }

  private async checkPipeline(): Promise<PipelineCounts> {
    try {
      const { data, error } = await this.supabase
        .from('lead_identities')
        .select('stage');

      if (error || !data) return {} as PipelineCounts;

      const counts: Record<string, number> = {
        DISCOVERED: 0,
        IDENTITY_RESOLVED: 0,
        WEBSITE_FOUND: 0,
        WEBSITE_CRAWLED: 0,
        CONTACTS_FOUND: 0,
        AUDIT_COMPLETE: 0,
        LEAD_SCORED: 0,
        READY: 0,
      };

      for (const row of data) {
        if (row.stage in counts) counts[row.stage]++;
      }

      // Calculate average discovery time from stage logs
      const { data: logs } = await this.supabase
        .from('discovery_stages_log')
        .select('duration_ms')
        .eq('to_stage', 'READY')
        .not('duration_ms', 'is', null)
        .limit(100);

      const avgMs =
        logs && logs.length > 0
          ? logs.reduce((sum: number, l: any) => sum + (l.duration_ms || 0), 0) / logs.length
          : 0;

      return {
        ...counts,
        avg_discovery_time_sec: Math.round(avgMs / 1000),
      } as PipelineCounts;
    } catch {
      return {} as PipelineCounts;
    }
  }
}
