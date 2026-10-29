import type { DatabaseSync } from 'node:sqlite';
import express, { type ErrorRequestHandler } from 'express';
import type { Auth } from './auth.js';
import { createRouter } from './routes.js';
import { HttpError } from './validate.js';

/**
 * The HTTP app: JSON API under /api, and (when a client build exists) the static
 * single-page app for every other GET so deep links reload correctly.
 *
 * Only /api is gated by the session cookie; the client files are public.
 */
export function createApp(db: DatabaseSync, clientDir: string | null, auth: Auth): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '5mb' }));

  app.use('/api', auth.router);
  app.use('/api', auth.guard);
  app.use('/api', createRouter(db));
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  if (clientDir) {
    app.use(express.static(clientDir, { index: false, maxAge: '1h' }));
    app.get(/.*/, (_req, res) => {
      // `root` keeps sendFile from refusing a client directory that sits under a dot-folder.
      res.sendFile('index.html', { root: clientDir, headers: { 'Cache-Control': 'no-cache' } });
    });
  }

  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    const status = statusOf(err);
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status >= 500 ? 'Internal server error' : messageOf(err) });
  };
  app.use(onError);

  return app;
}

function statusOf(err: unknown): number {
  if (err instanceof HttpError) return err.status;
  if (typeof err === 'object' && err !== null) {
    const e = err as { status?: unknown; type?: unknown; message?: unknown };
    if (e.type === 'entity.parse.failed') return 400;
    if (e.type === 'entity.too.large') return 413;
    if (typeof e.message === 'string' && e.message.includes('UNIQUE constraint failed')) return 409;
    if (typeof e.status === 'number' && e.status >= 400 && e.status < 600) return e.status;
  }
  return 500;
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : 'Request failed';
}
