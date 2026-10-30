import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { openDatabase } from './db.js';
import { EncryptionError, decryptDatabase, encryptDatabase, isEncrypted, rotateKey } from './encryption.js';

/**
 * Maintenance commands for the database file. Stop the server before changing the
 * encryption state: a running server keeps using the key it started with.
 */

const USAGE = `Usage: node dist/server/dbtool.js <command>

Commands:
  status    Say whether the database is encrypted
  encrypt   Encrypt a plain database with DB_ENCRYPTION_KEY
  decrypt   Turn an encrypted database back into plain text (needs DB_ENCRYPTION_KEY)
  rotate    Re-encrypt with DB_ENCRYPTION_KEY_NEW (needs the current DB_ENCRYPTION_KEY)

Environment:
  DB_PATH                The database file (default ./data/working-stack.db)
  DB_ENCRYPTION_KEY      The current key
  DB_ENCRYPTION_KEY_NEW  The new key, for rotate

Stop the server before encrypt, decrypt or rotate.`;

const COMMANDS = ['status', 'encrypt', 'decrypt', 'rotate'] as const;
type Command = (typeof COMMANDS)[number];

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new EncryptionError(`Set ${name} first.`);
  return value;
}

function main(): number {
  const command = process.argv[2] as Command | undefined;
  if (!command || !COMMANDS.includes(command)) {
    console.error(USAGE);
    return 2;
  }
  const dbPath = resolve(process.env.DB_PATH ?? resolve(process.cwd(), 'data', 'working-stack.db'));
  if (!existsSync(dbPath)) {
    console.error(`No database at ${dbPath}`);
    return 1;
  }

  const db = openDatabase(dbPath);
  try {
    switch (command) {
      case 'status':
        console.log(`${dbPath}: ${isEncrypted(db) ? 'encrypted (AES-256-GCM)' : 'plain text'}`);
        break;
      case 'encrypt':
        encryptDatabase(db, requireEnv('DB_ENCRYPTION_KEY'));
        break;
      case 'decrypt':
        decryptDatabase(db, requireEnv('DB_ENCRYPTION_KEY'));
        break;
      case 'rotate':
        rotateKey(db, requireEnv('DB_ENCRYPTION_KEY'), requireEnv('DB_ENCRYPTION_KEY_NEW'));
        break;
    }
    return 0;
  } catch (error) {
    if (error instanceof EncryptionError) {
      console.error(error.message);
      return 1;
    }
    throw error;
  } finally {
    db.close();
  }
}

process.exit(main());
