import { Request, Response } from 'express';
import { DiscoveryJobRepository } from '../../db/repositories/DiscoveryJobRepository.js';
import { DiscoveryResultRepository } from '../../db/repositories/DiscoveryResultRepository.js';
import { DiscoveryService } from '../../services/discovery.service.js';
import { ExportService } from '../../services/ExportService.js';
import { discoverySearchSchema, discoveryJobQuerySchema } from '../schemas/discovery.schema.js';

const jobRepo = new DiscoveryJobRepository();
const resultRepo = new DiscoveryResultRepository();
const discoveryService = new DiscoveryService();
const exportService = new ExportService();

export class DiscoveryJobsController {
  
  static async startDiscovery(req: Request, res: Response) {
    try {
      const input = discoverySearchSchema.parse(req.body);
      // Identity always comes from the verified JWT, never from the request body
      const userId = req.user?.id;

      const jobId = await discoveryService.startDiscovery({
        keyword: input.keyword,
        city: input.city,
        sources: input.sources,
        max_results: input.max_results,
        userId,
      });

      res.status(202).json({
        message: 'Discovery job started',
        jobId,
      });
    } catch (error: any) {
      console.error('Error starting discovery job:', error);
      res.status(400).json({ error: error.message || 'Validation error' });
    }
  }

  static async getJobs(req: Request, res: Response) {
    try {
      const query = discoveryJobQuerySchema.parse(req.query);
      const userId = req.user?.id;

      // Always filter by the requesting user's ID
      const { data, total } = await jobRepo.getAll(query.limit, query.offset, userId);
      
      let filteredData = data;
      if (query.status) {
        filteredData = filteredData.filter(job => job.status === query.status);
      }

      res.json({
        data: filteredData,
        meta: {
          total,
          limit: query.limit,
          offset: query.offset,
        }
      });
    } catch (error: any) {
      console.error('Error fetching jobs:', error);
      res.status(400).json({ error: error.message || 'Validation error' });
    }
  }

  static async getJobById(req: Request, res: Response) {
    try {
      const jobId = req.params.id;
      const userId = req.user?.id;

      // Pass userId for ownership validation
      const job = await jobRepo.getById(jobId, userId);
      
      if (!job) {
        // 404 instead of 403 to avoid leaking whether the job exists
        return res.status(404).json({ error: 'Job not found' });
      }

      res.json(job);
    } catch (error: any) {
      console.error('Error fetching job:', error);
      res.status(500).json({ error: 'Failed to fetch job' });
    }
  }

  static async getJobResults(req: Request, res: Response) {
    try {
      const jobId = req.params.id;
      const userId = req.user?.id;
      const includeDeduplicates = req.query.include_deduplicates === 'true';
      
      // Verify ownership before returning results
      const job = await jobRepo.getById(jobId, userId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      const results = await resultRepo.getByJobId(jobId, includeDeduplicates);
      res.json(results);
    } catch (error: any) {
      console.error('Error fetching job results:', error);
      res.status(500).json({ error: 'Failed to fetch results' });
    }
  }

  static async deleteJob(req: Request, res: Response) {
    try {
      const jobId = req.params.id;
      const userId = req.user?.id;

      // Verify ownership before deleting
      const job = await jobRepo.getById(jobId, userId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      await jobRepo.deleteJob(jobId);
      res.status(204).send();
    } catch (error: any) {
      console.error('Error deleting job:', error);
      res.status(500).json({ error: 'Failed to delete job' });
    }
  }

  static async exportCSV(req: Request, res: Response) {
    try {
      const jobId = req.params.id;
      const userId = req.user?.id;

      const job = await jobRepo.getById(jobId, userId);
      if (!job) return res.status(404).json({ error: 'Job not found' });

      const csvData = await exportService.exportCSV(jobId);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="discovery_results_${jobId}.csv"`);
      res.send(csvData);
    } catch (error: any) {
      console.error('Error exporting CSV:', error);
      res.status(500).json({ error: 'Failed to export CSV' });
    }
  }

  static async exportXLSX(req: Request, res: Response) {
    try {
      const jobId = req.params.id;
      const userId = req.user?.id;

      const job = await jobRepo.getById(jobId, userId);
      if (!job) return res.status(404).json({ error: 'Job not found' });

      const xlsxBuffer = await exportService.exportXLSX(jobId);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="discovery_results_${jobId}.xlsx"`);
      res.send(xlsxBuffer);
    } catch (error: any) {
      console.error('Error exporting XLSX:', error);
      res.status(500).json({ error: 'Failed to export XLSX' });
    }
  }

  static async getStats(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const stats = await jobRepo.getStats(userId);
      res.json(stats);
    } catch (error: any) {
      console.error('Error fetching stats:', error);
      res.status(500).json({ error: 'Failed to fetch stats' });
    }
  }
}
