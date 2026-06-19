import { Router, Request, Response } from 'express';
import { ApolloSearchService, ApolloSearchFilters } from '../../services/ApolloSearchService.js';

const router = Router();
const searchService = new ApolloSearchService();

/**
 * POST /api/search
 * Executes an Apollo-style advanced search against the companies database.
 * Uses POST to easily handle complex filter JSON bodies.
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const filters: ApolloSearchFilters = req.body;
    
    const results = await searchService.search(filters);
    
    res.json({
      success: true,
      data: results.results,
      pagination: results.pagination
    });
  } catch (error: any) {
    console.error('Search API error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'An error occurred while executing the search.'
    });
  }
});

export default router;
