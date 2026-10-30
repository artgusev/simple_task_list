import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { createAuth, describeAuth } from './auth.js';
import { openDatabase } from './db.js';
import { EncryptionError, describeEncryption, setupEncryption } from './encryption.js';
import type { Store } from './repo.js';

const here = dirname(fileURLToPath(import.meta.url));

/** `--port N` on the command line wins over the PORT variable (dev tooling often sets PORT for the UI). */
function portArgument(): string | undefined {
  const index = process.argv.indexOf('--port');
  return index === -1 ? undefined : process.argv[index + 1];
}

const port = Number(portArgument() ?? process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';
const dbPath = process.env.DB_PATH ?? resolve(process.cwd(), 'data', 'working-stack.db');
// After `npm run build` this file lives in dist/server and the client in dist/client.
const clientDir = process.env.CLIENT_DIR ?? resolve(here, '..', 'client');

const db = openDatabase(dbPath);
const store: Store = { db, codec: openCodec() };
const serveClient = existsSync(clientDir);
const auth = createAuth({ password: process.env.APP_PASSWORD, secret: process.env.SESSION_SECRET });
const app = createApp(store, serveClient ? clientDir : null, auth);

const server = app.listen(port, host, () => {
  console.log(`Working Stack API listening on http://${host}:${port}`);
  console.log(`Database: ${resolve(dbPath)}`);
  console.log(
    serveClient
      ? `Serving the client from ${clientDir}`
      : 'No client build found; in development the Vite dev server serves the UI',
  );
  console.log(describeAuth(auth));
  console.log(describeEncryption(store.codec));
});

/** A wrong or missing key is a configuration problem: say so plainly and stop, rather than serve ciphertext. */
function openCodec() {
  try {
    return setupEncryption(db, process.env.DB_ENCRYPTION_KEY);
  } catch (error) {
    if (error instanceof EncryptionError) {
      console.error(`Working Stack cannot start: ${error.message}`);
      db.close();
      process.exit(1);
    }
    throw error;
  }
}

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
