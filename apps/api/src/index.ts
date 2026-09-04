import { createServer } from './server';
import { config } from '@priv/config';
import { checkDatabaseConnection } from '@priv/database';

async function main() {
  const port = config.PORT || 4000;
  const app = createServer();

  await checkDatabaseConnection();

  app.listen(port, () => {
    console.log(`🌐 Priv REST API http://localhost:${port} adresinde çalışıyor.`);
  });
}

main().catch((err) => {
  console.error('[API BAŞLATMA HATASI]', err);
  process.exit(1);
});
