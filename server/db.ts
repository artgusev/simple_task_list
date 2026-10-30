import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS projects (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  color      TEXT NOT NULL,
  created_at TEXT NOT NULL,
  position   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  deadline    TEXT,
  started_at  TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  context     TEXT NOT NULL DEFAULT '',
  done_at     TEXT,
  position    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS tasks_by_project ON tasks(project_id);

CREATE TABLE IF NOT EXISTS comments (
  id         TEXT PRIMARY KEY,
  task_id    TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  text       TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS comments_by_task ON comments(task_id);

-- Settings about the file itself, such as the encryption state (see encryption.ts).
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value BLOB
);
`;

/** Opens (and creates, if needed) the SQLite file and makes sure the schema exists. */
export function openDatabase(path: string): DatabaseSync {
  const file = resolve(path);
  mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  // Overwrite deleted content with zeros instead of leaving it in free pages.
  db.exec('PRAGMA secure_delete = ON');
  db.exec(SCHEMA);
  return db;
}

/**
 * Rewrites the whole file and empties the write-ahead log, so pages that held earlier
 * content (for example plain text from before encryption) are gone. Cannot run inside
 * a transaction.
 */
export function compact(db: DatabaseSync): void {
  db.exec('VACUUM');
  db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
}

export function transaction<T>(db: DatabaseSync, fn: () => T): T {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
