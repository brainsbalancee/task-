import { createApp } from './app.js';
import { config } from './config.js';
import { createSearchEngine } from './search/factory.js';

async function main(): Promise<void> {
  const engine = await createSearchEngine();
  const app = createApp(engine);

  const server = app.listen(config.port, () => {
    console.log(`\n  task API`);
    console.log(`  ├─ engine  ${engine.name}`);
    console.log(`  ├─ cors    ${config.corsOrigin}`);
    console.log(`  └─ http://localhost:${config.port}/api\n`);
  });

  // Close the DB / ES client cleanly so `npm run dev` restarts don't leak handles.
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received, shutting down…`);
    server.close();
    await engine.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error(`\n✗ Failed to start:\n${(err as Error).message}\n`);
  process.exit(1);
});
