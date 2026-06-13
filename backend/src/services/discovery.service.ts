import { discoveryQueue } from '../workers/discoveryQueue.js';
import { DiscoverySearchInput } from '../api/schemas/discovery.schema.js';

export class DiscoveryService {
  /**
   * Adds a new discovery search job to the queue
   * @param input The discovery search parameters
   * @returns The newly created job ID
   */
  static async queueSearchJob(input: DiscoverySearchInput): Promise<string> {
    const job = await discoveryQueue.add('search-job', input, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    });

    if (!job || !job.id) {
      throw new Error('Failed to create discovery job');
    }

    return job.id.toString();
  }
}
