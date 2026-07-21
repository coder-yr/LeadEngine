import { Response } from 'express';
import { createTraceLogger } from '../utils/logger.js';
import { supabase } from '../config/supabase.js';

export interface AnalysisProgressEvent {
  companyId: string;
  jobId: string;
  stage: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  progress: number;
  message?: string;
  error?: string;
}

export class AnalysisProgressService {
  // Map of companyId -> array of connected SSE clients
  private static clients = new Map<string, Response[]>();

  /**
   * Add a client to the SSE stream for a specific company
   */
  static addClient(companyId: string, res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    // Flush headers to establish connection immediately
    res.flushHeaders();

    if (!this.clients.has(companyId)) {
      this.clients.set(companyId, []);
    }
    this.clients.get(companyId)!.push(res);

    // Send initial connection event
    res.write(`data: ${JSON.stringify({ type: 'CONNECTED', companyId })}\n\n`);

    // Handle client disconnect
    res.on('close', () => {
      this.removeClient(companyId, res);
    });
  }

  /**
   * Remove a client when they disconnect
   */
  private static removeClient(companyId: string, res: Response) {
    const companyClients = this.clients.get(companyId);
    if (companyClients) {
      const index = companyClients.indexOf(res);
      if (index !== -1) {
        companyClients.splice(index, 1);
      }
      if (companyClients.length === 0) {
        this.clients.delete(companyId);
      }
    }
  }

  /**
   * Broadcast an event to all clients listening to a specific company
   */
  static async broadcastProgress(event: AnalysisProgressEvent) {
    const { logger } = createTraceLogger(event.companyId);
    logger.debug({ event }, 'Broadcasting analysis progress');

    // Always update DB first
    await supabase.from('companies').update({
      analysis_progress: event,
      updated_at: new Date().toISOString(),
    }).eq('id', event.companyId);

    // Then broadcast to connected clients
    const companyClients = this.clients.get(event.companyId);
    if (companyClients) {
      const dataString = `data: ${JSON.stringify(event)}\n\n`;
      companyClients.forEach(res => {
        try {
          res.write(dataString);
        } catch (e) {
          logger.error('Failed to write to SSE client');
        }
      });
    }
  }
}
