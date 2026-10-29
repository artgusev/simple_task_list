import type { DatabaseSync } from 'node:sqlite';
import type { AppData, Comment, Project, ProjectPatch, Task, TaskPatch } from '../shared/types.js';
import { transaction } from './db.js';

type Row = Record<string, unknown>;

function rows(db: DatabaseSync, sql: string, ...params: Array<string | number | null>): Row[] {
  return db.prepare(sql).all(...params) as unknown as Row[];
}

function row(db: DatabaseSync, sql: string, ...params: Array<string | number | null>): Row | null {
  return (db.prepare(sql).get(...params) as unknown as Row | undefined) ?? null;
}

function toProject(r: Row): Project {
  return {
    id: String(r.id),
    name: String(r.name),
    color: r.color as Project['color'],
    createdAt: String(r.created_at),
  };
}

function toComment(r: Row): Comment {
  return { id: String(r.id), text: String(r.text), createdAt: String(r.created_at) };
}

function toTask(r: Row, comments: Comment[]): Task {
  return {
    id: String(r.id),
    projectId: String(r.project_id),
    title: String(r.title),
    description: String(r.description ?? ''),
    deadline: r.deadline == null ? null : String(r.deadline),
    startedAt: String(r.started_at),
    createdAt: String(r.created_at),
    context: String(r.context ?? ''),
    comments,
    doneAt: r.done_at == null ? null : String(r.done_at),
    order: Number(r.position),
  };
}

// ---------- Reads ----------

export function getAll(db: DatabaseSync): AppData {
  const projects = rows(db, 'SELECT * FROM projects ORDER BY position, rowid').map(toProject);
  const byTask = new Map<string, Comment[]>();
  for (const r of rows(db, 'SELECT * FROM comments ORDER BY created_at, rowid')) {
    const taskId = String(r.task_id);
    const list = byTask.get(taskId) ?? [];
    list.push(toComment(r));
    byTask.set(taskId, list);
  }
  const tasks = rows(db, 'SELECT * FROM tasks ORDER BY position, rowid').map((r) =>
    toTask(r, byTask.get(String(r.id)) ?? []),
  );
  return { projects, tasks };
}

export function getProject(db: DatabaseSync, id: string): Project | null {
  const r = row(db, 'SELECT * FROM projects WHERE id = ?', id);
  return r ? toProject(r) : null;
}

export function getTask(db: DatabaseSync, id: string): Task | null {
  const r = row(db, 'SELECT * FROM tasks WHERE id = ?', id);
  if (!r) return null;
  const comments = rows(db, 'SELECT * FROM comments WHERE task_id = ? ORDER BY created_at, rowid', id).map(toComment);
  return toTask(r, comments);
}

export function nextTaskPosition(db: DatabaseSync): number {
  const r = row(db, 'SELECT COALESCE(MAX(position), -1) + 1 AS next FROM tasks');
  return Number(r?.next ?? 0);
}

// ---------- Projects ----------

export function insertProject(db: DatabaseSync, project: Project): void {
  db.prepare(
    `INSERT INTO projects (id, name, color, created_at, position)
     VALUES (?, ?, ?, ?, (SELECT COALESCE(MAX(position), -1) + 1 FROM projects))`,
  ).run(project.id, project.name, project.color, project.createdAt);
}

export function updateProject(db: DatabaseSync, id: string, patch: ProjectPatch): Project | null {
  const sets: string[] = [];
  const params: Array<string | number | null> = [];
  if (patch.name !== undefined) {
    sets.push('name = ?');
    params.push(patch.name);
  }
  if (patch.color !== undefined) {
    sets.push('color = ?');
    params.push(patch.color);
  }
  if (sets.length > 0) {
    params.push(id);
    db.prepare(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  }
  return getProject(db, id);
}

export function deleteProject(db: DatabaseSync, id: string): boolean {
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

export function insertTask(db: DatabaseSync, task: Task): void {
  db.prepare(
    `INSERT INTO tasks (id, project_id, title, description, deadline, started_at, created_at, context, done_at, position)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    task.id,
    task.projectId,
    task.title,
    task.description,
    task.deadline,
    task.startedAt,
    task.createdAt,
    task.context,
    task.doneAt,
    task.order,
  );
  for (const comment of task.comments) insertComment(db, task.id, comment);
}

export function updateTask(db: DatabaseSync, id: string, patch: TaskPatch): Task | null {
  const sets: string[] = [];
  const params: Array<string | number | null> = [];
  for (const key of Object.keys(TASK_COLUMNS) as Array<keyof TaskPatch>) {
    const value = patch[key];
    if (value === undefined) continue;
    sets.push(`${TASK_COLUMNS[key]} = ?`);
    params.push(value);
  }
  if (sets.length > 0) {
    params.push(id);
    db.prepare(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  }
  return getTask(db, id);
}

export function deleteTask(db: DatabaseSync, id: string): boolean {
  return db.prepare('DELETE FROM tasks WHERE id = ?').run(id).changes > 0;
}

// ---------- Comments ----------

export function insertComment(db: DatabaseSync, taskId: string, comment: Comment): void {
  db.prepare('INSERT INTO comments (id, task_id, text, created_at) VALUES (?, ?, ?, ?)').run(
    comment.id,
    taskId,
    comment.text,
    comment.createdAt,
  );
}

export function deleteComment(db: DatabaseSync, taskId: string, id: string): boolean {
  return db.prepare('DELETE FROM comments WHERE id = ? AND task_id = ?').run(id, taskId).changes > 0;
}

// ---------- Whole dataset ----------

/** Replaces everything in one transaction (sample data, imports). */
export function replaceAll(db: DatabaseSync, data: AppData): void {
  transaction(db, () => {
    db.exec('DELETE FROM comments');
    db.exec('DELETE FROM tasks');
    db.exec('DELETE FROM projects');
    for (const project of data.projects) insertProject(db, project);
    for (const task of data.tasks) insertTask(db, task);
  });
}
