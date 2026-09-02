import { config, type EngineName } from '../config.js';
import type { SearchEngine } from './engine.js';
import { SqliteSearchEngine } from './sqlite/sqlite.engine.js';

/**
 * Builds the engine named by `SEARCH_ENGINE`.
 *
 * This is the only place in the codebase that knows which implementations
 * exist. Adding a third engine (Postgres full-text, Meilisearch, …) means
 * writing an adapter and adding one case here — no controller changes.
 *
 * The Elasticsearch client is imported lazily so the default SQLite path never
 * pays for loading it.
 */
export async function createSearchEngine(name: EngineName = config.engine): Promise<SearchEngine> {
  switch (name) {
    case 'elastic': {
      const { ElasticSearchEngine } = await import('./elastic/elastic.engine.js');
      const engine = new ElasticSearchEngine();
      await engine.init();
      return engine;
    }
    case 'sqlite':
    default: {
      const engine = new SqliteSearchEngine(config.sqlitePath);
      await engine.init();
      return engine;
    }
  }
}
