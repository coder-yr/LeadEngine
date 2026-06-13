import { Request, Response } from 'express';
import { z } from 'zod';
import { discoverySearchSchema } from '../schemas/discovery.schema.js';
import { DiscoveryService } from '../../services/discovery.service.js';

export class DiscoveryController {
  /**
   * POST /api/discovery/search
   */
  static async search(req: Request, res: Response): Promise<void> {
    try {
      // Validate request body
      const input = discoverySearchSchema.parse(req.body);

      // Queue the job
      const jobId = await DiscoveryService.queueSearchJob(input);

      // Return production-ready response
      res.status(202).json({
        jobId,
        status: 'queued',
        message: 'Discovery search job has been queued successfully.'
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation failed',
          details: error.errors
        });
        return;
      }

      console.error('Error in DiscoveryController.search:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message || 'An unexpected error occurred'
      });
    }
  }
}
