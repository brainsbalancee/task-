import cors from 'cors';
import express, { type Express } from 'express';
import { config } from './config.js';
import { createRouter } from './api/routes.js';
import { errorHandler, notFoundHandler } from './api/middleware/errors.js';
import type { SearchEngine } from './search/engine.js';

/**
 * Builds the Express app around an already-initialised engine.
 *
 * Kept separate from `index.ts` so tests can mount the app on an ephemeral port
 * (or a stub engine) without starting the real server.
 */
export function createApp(engine: SearchEngine): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(cors({ origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',') }));
  app.use(express.json({ limit: '256kb' }));

  // Minimal request log: method, path, status, duration.
  app.use((req, res, next) => {
    const started = performance.now();
    res.on('finish', () => {
      const ms = (performance.now() - started).toFixed(1);
      console.log(`${req.method} ${req.originalUrl} → ${res.statusCode} (${ms}ms)`);
    });
    next();
  });

  app.use('/api', createRouter(engine));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
