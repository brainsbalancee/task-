import type { Request, Response } from 'express';
import type { SearchEngine } from '../../search/engine.js';
import { HttpError, asyncHandler } from '../middleware/errors.js';
import {
  facetQuerySchema,
  profileParamsSchema,
  searchQuerySchema,
  suggestQuerySchema,
} from '../validators/search.schema.js';

/**
 * HTTP layer.
 *
 * Controllers do three things only: validate input, call the engine, shape the
 * response. They receive the engine by injection, so they are identical whether
 * the request is served by SQLite or Elasticsearch — and trivial to unit-test
 * with a stub engine.
 */
export function createSearchController(engine: SearchEngine) {
  return {
    /** GET /api/search — keyword + filters + sort + pagination. */
    search: asyncHandler(async (req: Request, res: Response) => {
      const query = searchQuerySchema.parse(req.query);
      const result = await engine.search(query);
      res.json({
        data: result.items,
        meta: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          pages: result.pages,
          tookMs: result.tookMs,
          engine: result.engine,
          // Echoed back so the client can restore state from a shared URL.
          query: { q: query.q, filters: query.filters, sort: query.sort, skillMatch: query.skillMatch },
          // Only present when ?explain=1 was passed.
          ...(result.explain ? { explain: result.explain } : {}),
        },
      });
    }),

    /** GET /api/suggest?q=eng — type-ahead across skills, titles, companies, names. */
    suggest: asyncHandler(async (req: Request, res: Response) => {
      const { q, limit } = suggestQuerySchema.parse(req.query);
      const suggestions = await engine.suggest(q, limit);
      res.json({ data: suggestions, meta: { q, total: suggestions.length } });
    }),

    /** GET /api/profiles/:id — the complete profile document. */
    getProfile: asyncHandler(async (req: Request, res: Response) => {
      const { id } = profileParamsSchema.parse(req.params);
      const profile = await engine.getProfile(id);
      if (!profile) throw HttpError.notFound(`No profile with id "${id}"`);
      res.json({ data: profile });
    }),

    /** GET /api/facets?field=skills&q=go — values + counts to populate filters. */
    facets: asyncHandler(async (req: Request, res: Response) => {
      const { field, q, limit } = facetQuerySchema.parse(req.query);
      const values = await engine.facets(field, { q, limit });
      res.json({ data: values, meta: { field, total: values.length } });
    }),

    /** GET /api/stats — dataset size, used by the landing page counters. */
    stats: asyncHandler(async (_req: Request, res: Response) => {
      res.json({ data: await engine.stats() });
    }),
  };
}
