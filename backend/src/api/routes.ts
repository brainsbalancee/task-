import { Router } from 'express';
import type { SearchEngine } from '../search/engine.js';
import { createSearchController } from './controllers/search.controller.js';
import { facetFields, sortKeys } from './validators/search.schema.js';

/** Wires the REST surface. One place to see every endpoint the API exposes. */
export function createRouter(engine: SearchEngine): Router {
  const router = Router();
  const controller = createSearchController(engine);

  router.get('/health', (_req, res) => {
    res.json({ status: 'ok', engine: engine.name, uptimeSec: Math.round(process.uptime()) });
  });

  // Self-describing index, so the API can be explored without leaving it.
  router.get('/', (_req, res) => {
    res.json({
      name: 'task API',
      version: '1.0.0',
      endpoints: {
        'GET /api/health': 'Liveness probe',
        'GET /api/search': 'Keyword search + filters. See `parameters` below.',
        'GET /api/profiles/:id': 'Full profile document',
        'GET /api/facets': 'Filter values with counts (?field=skills&q=go&limit=20)',
        'GET /api/suggest': 'Type-ahead across skills, titles, companies and names (?q=eng)',
        'GET /api/stats': 'Dataset totals',
      },
      parameters: {
        q: 'keyword; supports "exact phrase" and -excluded terms',
        skill: 'repeatable or comma-separated',
        title: 'job-title substring',
        company: 'current or past employer',
        industry: 'exact industry',
        country: 'exact country',
        level: 'seniority, e.g. senior / manager / director / vp / cxo',
        degree: 'e.g. bachelors / masters / mba',
        school: 'school-name substring',
        minExp: 'minimum years of experience',
        maxExp: 'maximum years of experience',
        skillMatch: 'any (default) | all',
        sort: sortKeys.join(' | '),
        explain: 'set to 1 to receive the execution trace (parsed query, filters, ranking, SQL)',
        page: 'default 1',
        limit: 'default 20, max 100',
      },
      facetFields,
    });
  });

  router.get('/search', controller.search);
  router.get('/facets', controller.facets);
  router.get('/suggest', controller.suggest);
  router.get('/stats', controller.stats);
  router.get('/profiles/:id', controller.getProfile);

  return router;
}
