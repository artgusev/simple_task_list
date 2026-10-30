import type { DatabaseSync } from 'node:sqlite';
import type { AppData, Comment, Project, ProjectPatch, Task, TaskPatch } from '../shared/types.js';
import { transaction } from './db.js';
import type { Codec } from './encryption.js';

/** The database plus the codec that seals and opens its text columns. */
export interface Store {
  readonly db: DatabaseSync;
  readonly codec: Codec;
}

type Row = Record<string, unknown>;
type Param = string | number | null | Uint8Array;

function rows(db: DatabaseSync, sql: string, ...params: Param[]): Row[] {
  return db.prepare(sql).all(...params) as unknown as Row[];
}

function row(db: DatabaseSync, sql: string, ...params: Param[]): Row | null {
  return (db.prepare(sql).get(...params) as unknown as Row | undefined) ?? null;
}

function toProject({ codec }: Store, r: Row): Project {
  const id = String(r.id);
  return {
    id,
    name: codec.open('projects', 'name', id, r.name),
    color: r.color as Project['color'],
    createdAt: String(r.created_at),
  };
}

function toComment({ codec }: Store, r: Row): Comment {
  const id = String(r.id);
  return { id, text: codec.open('comments', 'text', id, r.text), createdAt: String(r.created_at) };
}

function toTask({ codec }: Store, r: Row, comments: Comment[]): Task {
  const id = String(r.id);
  return {
    id,
    projectId: String(r.project_id),
    title: codec.open('tasks', 'title', id, r.title),
    description: codec.open('tasks', 'description', id, r.description),
    deadline: r.deadline == null ? null : String(r.deadline),
    startedAt: String(r.started_at),
    createdAt: String(r.created_at),
    context: codec.open('tasks', 'context', id, r.context),
    comments,
    doneAt: r.done_at == null ? null : String(r.done_at),
    order: Number(r.position),
  };
}

// ---------- Reads ----------

export function getAll(store: Store): AppData {
  const { db } = store;
  const projects = rows(db, 'SELECT * FROM projects ORDER BY position, rowid').map((r) => toProject(store, r));
  const byTask = new Map<string, Comment[]>();
  for (const r of rows(db, 'SELECT * FROM comments ORDER BY created_at, rowid')) {
    const taskId = String(r.task_id);
    const list = byTask.get(taskId) ?? [];
    list.push(toComment(store, r));
    byTask.set(taskId, list);
  }
  const tasks = rows(db, 'SELECT * FROM tasks ORDER BY position, rowid').map((r) =>
    toTask(store, r, byTask.get(String(r.id)) ?? []),
  );
  return { projects, tasks };
}

export function getProject(store: Store, id: string): Project | null {
  const r = row(store.db, 'SELECT * FROM projects WHERE id = ?', id);
  return r ? toProject(store, r) : null;
}

export function getTask(store: Store, id: string): Task | null {
  const r = row(store.db, 'SELECT * FROM tasks WHERE id = ?', id);
  if (!r) return null;
  const comments = rows(store.db, 'SELECT * FROM comments WHERE task_id = ? ORDER BY created_at, rowid', id).map(
    (c) => toComment(store, c),
  );
  return toTask(store, r, comments);
}

export function nextTaskPosition({ db }: Store): number {
  const r = row(db, 'SELECT COALESCE(MAX(position), -1) + 1 AS next FROM tasks');
  return Number(r?.next ?? 0);
}

// ---------- Projects ----------

export function insertProject({ db, codec }: Store, project: Project): void {
  db.prepare(
    `INSERT INTO projects (id, name, color, created_at, position)
     VALUES (?, ?, ?, ?, (SELECT COALESCE(MAX(position), -1) + 1 FROM projects))`,
  ).run(project.id, codec.seal('projects', 'name', project.id, project.name), project.color, project.createdAt);
}

export function updateProject(store: Store, id: string, patch: ProjectPatch): Project | null {
  const { db, codec } = store;
  const sets: string[] = [];
  const params: Param[] = [];
  if (patch.name !== undefined) {
    sets.push('name = ?');
    params.push(codec.seal('projects', 'name', id, patch.name));
  }
  if (patch.color !== undefined) {
    sets.push('color = ?');
    params.push(patch.color);
  }
  if (sets.length > 0) {
    params.push(id);
    db.prepare(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  }
  return getProject(store, id);
}

export function deleteProject({ db }: Store, id: string): boolean {
  // Tasks and their comments go with the project (ON DELETE CASCADE).
  return db.prepare('DELETE FROM projects WHERE id = ?').run(id).changes > 0;
}

// ---------- Tasks ----------

const TASK_COLUMNS: Record<keyof TaskPatch, string> = {
  projectId: 'project_id',
  title: 'title',
  description: 'description',
  deadline: 'deadline',
  startedAt: 'started_at',
  createdAt: 'created_at',
  context: 'context',
  doneAt: 'done_at',
  order: 'position',
};

/** The task fields that hold free text and so go through the codec. */
const SEALED_TASK_FIELDS: ReadonlySet<keyof TaskPatch> = new Set(['title', 'description', 'context']);

export function insertTask(store: Store, task: Task): void {
  const { db, codec } = store;
  db.prepare(
    `INSERT INTO tasks (id, project_id, title, description, deadline, started_at, created_at, context, done_at, position)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    task.id,
    task.projectId,
    codec.seal('tasks', 'title', task.id, task.title),
    codec.seal('tasks', 'description', task.id, task.description),
    task.deadline,
    task.startedAt,
    task.createdAt,
    codec.seal('tasks', 'context', task.id, task.context),
    task.doneAt,
    task.order,
  );
  for (const comment of task.comments) insertComment(store, task.id, comment);
}

export function updateTask(store: Store, id: string, patch: TaskPatch): Task | null {
  const { db, codec } = store;
  const sets: string[] = [];
  const params: Param[] = [];
  for (const key of Object.keys(TASK_COLUMNS) as Array<keyof TaskPatch>) {
    const value = patch[key];
    if (value === undefined) continue;
    const column = TASK_COLUMNS[key];
    sets.push(`${column} = ?`);
    params.push(SEALED_TASK_FIELDS.has(key) ? codec.seal('tasks', column, id, String(value)) : value);
  }
  if (sets.length > 0) {
    params.push(id);
    db.prepare(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  }
  return getTask(store, id);
}

export function deleteTask({ db }: Store, id: string): boolean {
  return db.prepare('DELETE FROM tasks WHERE id = ?').run(id).changes > 0;
}

// ---------- Comments ----------

export function insertComment({ db, codec }: Store, taskId: string, comment: Comment): void {
  db.prepare('INSERT INTO comments (id, task_id, text, created_at) VALUES (?, ?, ?, ?)').run(
    comment.id,
    taskId,
    codec.seal('comments', 'text', comment.id, comment.text),
    comment.createdAt,
  );
}

export function deleteComment({ db }: Store, taskId: string, id: string): boolean {
  return db.prepare('DELETE FROM comments WHERE id = ? AND task_id = ?').run(id, taskId).changes > 0;
}

// ---------- Whole dataset ----------

/** Replaces everything in one transaction (sample data, imports). */
export function replaceAll(store: Store, data: AppData): void {
  const { db } = store;
  transaction(db, () => {
    db.exec('DELETE FROM comments');
    db.exec('DELETE FROM tasks');
    db.exec('DELETE FROM projects');
    for (const project of data.projects) insertProject(store, project);
    for (const task of data.tasks) insertTask(store, task);
  });
}
