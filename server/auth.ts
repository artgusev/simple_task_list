import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import express, { type Request, type RequestHandler } from 'express';
import { HttpError, object, requiredText } from './validate.js';

/**
 * Optional single-user password protection for the API.
 *
 * With a password configured, every /api request needs the session cookie, which holds
 * an HMAC-signed, time-limited token. Tokens are stateless: nothing is stored on the
 * server, so a restart keeps everyone signed in, and "sign out" only clears the cookie.
 * Changing the password (or SESSION_SECRET) changes the signing key and so signs every
 * device out.
 */

export const COOKIE_NAME = 'ws_session';
export const SESSION_DAYS = 30;
const SESSION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;
/** Cookies are only ever sent to the API, so the login page and static files never see them. */
const COOKIE_PATH = '/api';

export const LOGIN_WINDOW_MS = 60_000;
export const LOGIN_MAX_FAILURES = 5;

export interface AuthOptions {
  /** APP_PASSWORD. Unset or empty leaves the API open. */
  password?: string;
  /** SESSION_SECRET. Optional extra key material for signing tokens. */
  secret?: string;
}

export interface Auth {
  /** True when a password is configured. */
  readonly enabled: boolean;
  /** GET /session, POST /login, POST /logout: reachable without a session. */
  readonly router: express.Router;
  /** Rejects requests without a valid session cookie (does nothing when not enabled). */
  readonly guard: RequestHandler;
}

export function createAuth({ password, secret }: AuthOptions): Auth {
  if (!password) {
    const router = express.Router();
    router.get('/session', (_req, res) => {
      res.set('Cache-Control', 'no-store');
      res.json({ protected: false, authenticated: true });
    });
    router.post('/login', () => {
      throw new HttpError(400, 'Password protection is off');
    });
    router.post('/logout', (_req, res) => {
      res.status(204).end();
    });
    return { enabled: false, router, guard: (_req, _res, next) => next() };
  }

  const passwordDigest = sha256(password);
  // scrypt keeps a captured cookie from being turned into an offline guess at the password:
  // each candidate costs a full key derivation. Mixing in SESSION_SECRET (as the salt)
  // makes that attack impossible without it. Computed once, at startup.
  const key = scryptSync(password, `working-stack-session:${secret ?? ''}`, 32);
  const limiter = new LoginLimiter();

  const isAuthenticated = (req: Request): boolean => {
    const token = readCookie(req, COOKIE_NAME);
    return token !== undefined && verifyToken(key, token);
  };

  const router = express.Router();

  router.get('/session', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ protected: true, authenticated: isAuthenticated(req) });
  });

  router.post('/login', (req, res) => {
    res.set('Cache-Control', 'no-store');
    const ip = clientIp(req);
    const wait = limiter.retryAfter(ip);
    if (wait > 0) {
      res.set('Retry-After', String(wait));
      throw new HttpError(429, `Too many attempts. Try again in ${wait} second${wait === 1 ? '' : 's'}.`);
    }
    const attempt = requiredText(object(req.body), 'password', { max: 1024 });
    // Comparing digests keeps the comparison constant-time even when the lengths differ.
    if (!timingSafeEqual(sha256(attempt), passwordDigest)) {
      limiter.recordFailure(ip);
      throw new HttpError(401, 'Wrong password');
    }
    limiter.clear(ip);
    res.cookie(COOKIE_NAME, issueToken(key), {
      httpOnly: true,
      sameSite: 'lax',
      secure: isHttps(req),
      maxAge: SESSION_MS,
      path: COOKIE_PATH,
    });
    res.json({ protected: true, authenticated: true });
  });

  router.post('/logout', (req, res) => {
    res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: 'lax', secure: isHttps(req), path: COOKIE_PATH });
    res.status(204).end();
  });

  const guard: RequestHandler = (req, res, next) => {
    if (isAuthenticated(req)) {
      next();
      return;
    }
    res.set('Cache-Control', 'no-store');
    res.status(401).json({ error: 'Unauthorized' });
  };

  return { enabled: true, router, guard };
}

// ---------- Tokens ----------

/** `<expires>.<nonce>.<signature>`: expiry in ms since the epoch, a random nonce, and the HMAC of both. */
function issueToken(key: Buffer, now = Date.now()): string {
  const payload = `${now + SESSION_MS}.${randomBytes(16).toString('base64url')}`;
  return `${payload}.${sign(key, payload)}`;
}

function verifyToken(key: Buffer, token: string, now = Date.now()): boolean {
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [expires, nonce, signature] = parts;
  if (!/^\d{1,16}$/.test(expires) || Number(expires) <= now) return false;
  const expected = Buffer.from(sign(key, `${expires}.${nonce}`));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

function sign(key: Buffer, payload: string): string {
  return createHmac('sha256', key).update(payload).digest('base64url');
}

function sha256(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

// ---------- Requests ----------

function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() !== name) continue;
    const value = part.slice(eq + 1).trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return undefined;
}

/** True when the request came over HTTPS, directly or through a proxy that says so. */
function isHttps(req: Request): boolean {
  if (req.secure) return true;
  const forwarded = req.headers['x-forwarded-proto'];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim();
  return first === 'https';
}

function clientIp(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}

// ---------- Brute-force limiting ----------

/** Remembers recent failed logins per address; nothing is kept for addresses that behave. */
class LoginLimiter {
  private failures = new Map<string, number[]>();

  /** Seconds the address has to wait before the next attempt, or 0 when it may try now. */
  retryAfter(ip: string, now = Date.now()): number {
    const recent = this.recent(ip, now);
    if (recent.length < LOGIN_MAX_FAILURES) return 0;
    return Math.max(1, Math.ceil((recent[0] + LOGIN_WINDOW_MS - now) / 1000));
  }

  recordFailure(ip: string, now = Date.now()): void {
    if (this.failures.size >= 10_000) this.sweep(now);
    this.failures.set(ip, [...this.recent(ip, now), now]);
  }

  clear(ip: string): void {
    this.failures.delete(ip);
  }

  private recent(ip: string, now: number): number[] {
    return (this.failures.get(ip) ?? []).filter((at) => at > now - LOGIN_WINDOW_MS);
  }

  private sweep(now: number): void {
    for (const [ip, times] of this.failures) {
      if (!times.some((at) => at > now - LOGIN_WINDOW_MS)) this.failures.delete(ip);
    }
  }
}

/** One line for the startup log. */
export function describeAuth(auth: Auth): string {
  return auth.enabled
    ? `Password protection: on (sessions last ${SESSION_DAYS} days)`
    : 'Password protection: off (set APP_PASSWORD to require a login)';
}
