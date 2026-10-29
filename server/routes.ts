import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import express from 'express';
import type { AppData, Comment, Project, ProjectPatch, Task, TaskPatch } from '../shared/types.js';
import * as repo from './repo.js';
import {
  HttpError,
  color,
  id,
  integer,
  isoDate,
  isoDateOrNull,
  list,
  object,
  requiredText,
  text,
  timestamp,
  timestampOrNull,
} from './validate.js';

const now = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);

// ---------- Parsing request bodies into domain objects ----------

function parseProject(input: unknown): Project {
  const body = object(input, 'project');
  return {
    id: id(body) ?? randomUUID(),
    name: requiredText(body, 'name', { allowEmpty: false, max: 200 }).trim(),
    color: color(body) ?? 'blue',
    createdAt: timestamp(body, 'createdAt') ?? now(),
  };
}

function parseProjectPatch(input: unknown): ProjectPatch {
  const body = object(input, 'project');
  const patch: ProjectPatch = {};
  const name = text(body, 'name', { allowEmpty: false, max: 200 });
  if (name !== undefined) patch.name = name.trim();
  const c = color(body);
  if (c !== undefined) patch.color = c;
  if (Object.keys(patch).length === 0) throw new HttpError(400, 'Nothing to update');
  return patch;
}

function parseComment(input: unknown): Comment {
  const body = object(input, 'comment');
  return {
    id: id(body) ?? randomUUID(),
    text: requiredText(body, 'text', { allowEmpty: false, max: 20_000 }),
    createdAt: timestamp(body, 'createdAt') ?? now(),
  };
}

function parseTask(input: unknown, position: number): Task {
  const body = object(input, 'task');
  const comments = body.comments === undefined ? [] : list(body.comments, 'comments').map(parseComment);
  return {
    id: id(body) ?? randomUUID(),
    projectId: requiredText(body, 'projectId', { allowEmpty: false, max: 64 }),
    title: requiredText(body, 'title', { allowEmpty: false, max: 500 }).trim(),
    description: text(body, 'description', { max: 2000 }) ?? '',
    deadline: isoDateOrNull(body, 'deadline') ?? null,
    startedAt: isoDate(body, 'startedAt') ?? today(),
    createdAt: timestamp(body, 'createdAt') ?? now(),
    context: text(body, 'context') ?? '',
    comments,
    doneAt: timestampOrNull(body, 'doneAt') ?? null,
    order: integer(body, 'order') ?? position,
  };
}

function parseTaskPatch(input: unknown): TaskPatch {
  const body = object(input, 'task');
  const patch: TaskPatch = {};
  const projectId = text(body, 'projectId', { allowEmpty: false, max: 64 });
  if (projectId !== undefined) patch.projectId = projectId;
  // An empty title is allowed here: the editor saves while the user is still typing.
  const title = text(body, 'title', { max: 500 });
  if (title !== undefined) patch.title = title;
  const description = text(body, 'description', { max: 2000 });
  if (description !== undefined) patch.description = description;
  const deadline = isoDateOrNull(body, 'deadline');
  if (deadline !== undefined) patch.deadline = deadline;
  const startedAt = isoDate(body, 'startedAt');
  if (startedAt !== undefined) patch.startedAt = startedAt;
  const context = text(body, 'context');
  if (context !== undefined) patch.context = context;
  const doneAt = timestampOrNull(body, 'doneAt');
  if (doneAt !== undefined) patch.doneAt = doneAt;
  const order = integer(body, 'order');
  if (order !== undefined) patch.order = order;
  if (Object.keys(patch).length === 0) throw new HttpError(400, 'Nothing to update');
  return patch;
}

function parseData(input: unknown): AppData {
  const body = object(input, 'data');
  const projects = list(body.projects, 'projects').map(parseProject);
  const known = new Set(projects.map((p) => p.id));
  const tasks = list(body.tasks, 'tasks').map((t, i) => parseTask(t, i));
  for (const task of tasks) {
    if (!known.has(task.projectId)) throw new HttpError(400, `Task "${task.title}" refers to an unknown project`);
  }
  return { projects, tasks };
}

// ---------- Routes ----------

export function createRouter(db: DatabaseSync): express.Router {
  const router = express.Router();

  const requireProject = (projectId: string) => {
    if (!repo.getProject(db, projectId)) throw new HttpError(400, 'Unknown project');
  };

  router.get('/data', (_req, res) => {
    res.json(repo.getAll(db));
  });

  router.put('/data', (req, res) => {
    repo.replaceAll(db, parseData(req.body));
    res.json(repo.getAll(db));
  });

  router.post('/projects', (req, res) => {
    const project = parseProject(req.body);
    if (repo.getProject(db, project.id)) throw new HttpError(409, 'A project with this id already exists');
    repo.insertProject(db, project);
    res.status(201).json(project);
  });

  router.patch('/projects/:id', (req, res) => {
    const patch = parseProjectPatch(req.body);
    const project = repo.updateProject(db, req.params.id, patch);
    if (!project) throw new HttpError(404, 'Project not found');
    res.json(project);
  });

  router.delete('/projects/:id', (req, res) => {
    if (!repo.deleteProject(db, req.params.id)) throw new HttpError(404, 'Project not found');
    res.status(204).end();
  });

  router.post('/tasks', (req, res) => {
    const task = parseTask(req.body, repo.nextTaskPosition(db));
    requireProject(task.projectId);
    if (repo.getTask(db, task.id)) throw new HttpError(409, 'A task with this id already exists');
    repo.insertTask(db, task);
    res.status(201).json(task);
  });

  router.patch('/tasks/:id', (req, res) => {
    const patch = parseTaskPatch(req.body);
    if (patch.projectId !== undefined) requireProject(patch.projectId);
    const task = repo.updateTask(db, req.params.id, patch);
    if (!task) throw new HttpError(404, 'Task not found');
    res.json(task);
  });

  router.delete('/tasks/:id', (req, res) => {
    if (!repo.deleteTask(db, req.params.id)) throw new HttpError(404, 'Task not found');
    res.status(204).end();
  });

  router.post('/tasks/:id/comments', (req, res) => {
    if (!repo.getTask(db, req.params.id)) throw new HttpError(404, 'Task not found');
    const comment = parseComment(req.body);
    repo.insertComment(db, req.params.id, comment);
    res.status(201).json(comment);
  });

  router.delete('/tasks/:id/comments/:commentId', (req, res) => {
    if (!repo.deleteComment(db, req.params.id, req.params.commentId)) throw new HttpError(404, 'Comment not found');
    res.status(204).end();
  });

  return router;
}
