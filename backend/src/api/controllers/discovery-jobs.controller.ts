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
      const jobId = await discoveryService.startDiscovery({
        keyword: input.keyword,
        city: input.city,
        sources: input.sources,
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
      const { data, total } = await jobRepo.getAll(query.limit, query.offset);
      
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
      const job = await jobRepo.getById(jobId);
      
      if (!job) {
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
      const includeDeduplicates = req.query.include_deduplicates === 'true';
      
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
      const stats = await jobRepo.getStats();
      res.json(stats);
    } catch (error: any) {
      console.error('Error fetching stats:', error);
      res.status(500).json({ error: 'Failed to fetch stats' });
    }
  }
}
