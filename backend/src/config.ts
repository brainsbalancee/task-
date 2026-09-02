import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
/** Repo-root-relative paths keep the app runnable from any cwd. */
const backendRoot = path.resolve(here, '..');

const resolve = (p: string) => (path.isAbsolute(p) ? p : path.resolve(backendRoot, p));

export type EngineName = 'sqlite' | 'elastic';

const engine = (process.env.SEARCH_ENGINE ?? 'sqlite').toLowerCase();
if (engine !== 'sqlite' && engine !== 'elastic') {
  throw new Error(`SEARCH_ENGINE must be "sqlite" or "elastic", received "${engine}"`);
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  csvPath: resolve(process.env.DATA_CSV ?? '../data/linkedin_profiles.csv'),
  /**
   * Committed synthetic stand-in, used when the real dataset is not present.
   * Keeps a fresh clone runnable without shipping anyone's personal data.
   */
  sampleCsvPath: resolve('../data/sample_profiles.csv'),
  sqlitePath: resolve(process.env.SQLITE_PATH ?? './data/profiles.db'),
  engine: engine as EngineName,
  elastic: {
    node: process.env.ELASTIC_NODE ?? 'http://localhost:9200',
    index: process.env.ELASTIC_INDEX ?? 'profiles',
  },
  /** Hard ceiling so a client cannot ask for the whole table in one call. */
  maxPageSize: 100,
} as const;
