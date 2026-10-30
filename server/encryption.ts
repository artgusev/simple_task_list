import type { DatabaseSync } from 'node:sqlite';
import { Cipher, DecryptError, deriveKey, newSalt } from './crypto.js';
import { compact, transaction } from './db.js';

/**
 * Encryption at rest for everything the user writes.
 *
 * With DB_ENCRYPTION_KEY set, the text columns (project names, task titles, descriptions,
 * context and comments) are stored as AES-256-GCM ciphertext; ids, dates, colours and
 * ordering stay readable so the schema and queries do not change. The key is derived from
 * the configured passphrase with scrypt and a salt kept in the `meta` table, next to a
 * "key check" value that proves a given passphrase is the right one before anything is
 * touched.
 *
 * A plain database is encrypted in one transaction the first time the server starts with
 * a key. Going back, or changing the key, is done with dbtool.ts while the server is stopped.
 */

export type EncryptedTable = 'projects' | 'tasks' | 'comments';

/** The columns that hold user-written text. */
export const ENCRYPTED_COLUMNS: Readonly<Record<EncryptedTable, readonly string[]>> = {
  projects: ['name'],
  tasks: ['title', 'description', 'context'],
  comments: ['text'],
};

export interface Codec {
  readonly enabled: boolean;
  /** Turns a value into what is stored in `table.column` for the row `id`. */
  seal(table: EncryptedTable, column: string, id: string, value: string): string | Buffer;
  /** Turns a stored value back into text. */
  open(table: EncryptedTable, column: string, id: string, stored: unknown): string;
}

/** Plain text: values are stored as they are. */
export const PLAIN: Codec = {
  enabled: false,
  seal: (_table, _column, _id, value) => value,
  open: (_table, _column, _id, stored) => String(stored ?? ''),
};

/** A configuration or key problem; the message is written for the person running the server. */
export class EncryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EncryptionError';
  }
}

const aad = (table: string, column: string, id: string) => `${table}.${column}:${id}`;

function encryptedCodec(cipher: Cipher): Codec {
  return {
    enabled: true,
    seal: (table, column, id, value) => cipher.seal(value, aad(table, column, id)),
    open: (table, column, id, stored) => {
      if (!(stored instanceof Uint8Array)) {
        throw new EncryptionError(`${table}.${column} of row ${id} is not encrypted; the database is inconsistent`);
      }
      try {
        return cipher.open(stored, aad(table, column, id));
      } catch (error) {
        if (error instanceof DecryptError) {
          throw new EncryptionError(`Could not decrypt ${table}.${column} of row ${id}: ${error.message}`);
        }
        throw error;
      }
    },
  };
}

// ---------- State kept in the meta table ----------

const MODE_ROW = 'encryption';
const SALT_ROW = 'kdf_salt';
const CHECK_ROW = 'key_check';
const MODE_ON = 'aes-256-gcm';
const CHECK_AAD = 'meta.key_check';
const CHECK_TEXT = 'working-stack';

function readMeta(db: DatabaseSync, key: string): unknown {
  const r = db.prepare('SELECT value FROM meta WHERE key = ?').get(key) as { value: unknown } | undefined;
  return r?.value;
}

function writeMeta(db: DatabaseSync, key: string, value: string | Buffer): void {
  db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run(key, value);
}

function clearMeta(db: DatabaseSync): void {
  db.prepare('DELETE FROM meta WHERE key IN (?, ?, ?)').run(MODE_ROW, SALT_ROW, CHECK_ROW);
}

export function isEncrypted(db: DatabaseSync): boolean {
  return readMeta(db, MODE_ROW) === MODE_ON;
}

type Log = (message: string) => void;

// ---------- Entry points ----------

/**
 * Picks the codec for this database from its state and the configured key. A plain
 * database is encrypted right here the first time a key is configured.
 */
export function setupEncryption(db: DatabaseSync, passphrase: string | undefined, log: Log = console.log): Codec {
  const key = passphrase || undefined;
  if (!isEncrypted(db)) {
    return key ? encryptDatabase(db, key, log) : PLAIN;
  }
  if (!key) {
    throw new EncryptionError('This database is encrypted. Set DB_ENCRYPTION_KEY to the key it was encrypted with.');
  }
  return openEncrypted(db, key);
}

/** Derives the key from the stored salt and proves it is the right one. */
export function openEncrypted(db: DatabaseSync, passphrase: string): Codec {
  if (!isEncrypted(db)) throw new EncryptionError('The database is not encrypted.');
  const salt = readMeta(db, SALT_ROW);
  const check = readMeta(db, CHECK_ROW);
  if (!(salt instanceof Uint8Array) || !(check instanceof Uint8Array)) {
    throw new EncryptionError('The database says it is encrypted, but its key material is missing.');
  }
  const cipher = new Cipher(deriveKey(passphrase, salt));
  let proof: string;
  try {
    proof = cipher.open(check, CHECK_AAD);
  } catch (error) {
    if (error instanceof DecryptError) {
      throw new EncryptionError('DB_ENCRYPTION_KEY does not match the key this database was encrypted with.');
    }
    throw error;
  }
  if (proof !== CHECK_TEXT) throw new EncryptionError('The key check value in the database is damaged.');
  return encryptedCodec(cipher);
}

/** Encrypts every text value of a plain database and records the key material. */
export function encryptDatabase(db: DatabaseSync, passphrase: string, log: Log = console.log): Codec {
  if (isEncrypted(db)) throw new EncryptionError('The database is already encrypted.');
  const salt = newSalt();
  const cipher = new Cipher(deriveKey(passphrase, salt));
  const codec = encryptedCodec(cipher);
  const count = transaction(db, () => {
    const n = recode(db, PLAIN, codec);
    writeMeta(db, SALT_ROW, salt);
    writeMeta(db, CHECK_ROW, cipher.seal(CHECK_TEXT, CHECK_AAD));
    writeMeta(db, MODE_ROW, MODE_ON);
    return n;
  });
  // The old pages still hold the plain text until the file is rewritten.
  compact(db);
  log(`Encrypted the database: ${plural(count, 'value')} sealed with AES-256-GCM`);
  return codec;
}

/** Turns an encrypted database back into plain text. */
export function decryptDatabase(db: DatabaseSync, passphrase: string, log: Log = console.log): void {
  const codec = openEncrypted(db, passphrase);
  const count = transaction(db, () => {
    const n = recode(db, codec, PLAIN);
    clearMeta(db);
    return n;
  });
  compact(db);
  log(`Decrypted the database: ${plural(count, 'value')} back in plain text`);
}

/** Re-encrypts everything under a new passphrase (and a new salt). */
export function rotateKey(db: DatabaseSync, current: string, next: string, log: Log = console.log): void {
  const from = openEncrypted(db, current);
  const salt = newSalt();
  const cipher = new Cipher(deriveKey(next, salt));
  const to = encryptedCodec(cipher);
  const count = transaction(db, () => {
    const n = recode(db, from, to);
    writeMeta(db, SALT_ROW, salt);
    writeMeta(db, CHECK_ROW, cipher.seal(CHECK_TEXT, CHECK_AAD));
    return n;
  });
  compact(db);
  log(`Rotated the key: ${plural(count, 'value')} re-encrypted`);
}

/** Rewrites every encrypted column, reading with one codec and writing with the other. Returns the number of values. */
function recode(db: DatabaseSync, from: Codec, to: Codec): number {
  let count = 0;
  for (const table of Object.keys(ENCRYPTED_COLUMNS) as EncryptedTable[]) {
    const columns = ENCRYPTED_COLUMNS[table];
    const select = db.prepare(`SELECT id, ${columns.join(', ')} FROM ${table}`);
    const update = db.prepare(`UPDATE ${table} SET ${columns.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`);
    for (const r of select.all() as Array<Record<string, unknown>>) {
      const id = String(r.id);
      update.run(...columns.map((c) => to.seal(table, c, id, from.open(table, c, id, r[c]))), id);
      count += columns.length;
    }
  }
  return count;
}

function plural(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

/** One line for the startup log. */
export function describeEncryption(codec: Codec): string {
  return codec.enabled
    ? 'Database encryption: on (AES-256-GCM over project names, titles, descriptions, context and comments)'
    : 'Database encryption: off (set DB_ENCRYPTION_KEY to encrypt task content at rest)';
}
