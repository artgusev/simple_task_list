import type { Action } from './actions';
import { api } from './api';
import type { TaskPatch } from './types';

/** Typing in the task editor dispatches on every keystroke; patches are merged and sent after this pause. */
const PATCH_DELAY_MS = 400;

interface Handlers {
  onError: (error: Error) => void;
}

/**
 * Sends actions to the server one after another, in the order they were dispatched,
 * so a task is always created before it is updated or deleted.
 */
export class SyncQueue {
  private chain: Promise<void> = Promise.resolve();
  private pendingPatches = new Map<string, TaskPatch>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private active = 0;

  constructor(private readonly handlers: Handlers) {}

  /** True while something is still being sent or waiting to be sent. */
  get busy(): boolean {
    return this.active > 0 || this.pendingPatches.size > 0;
  }

  push(action: Action): void {
    if (action.type === 'task/update') {
      const merged = { ...(this.pendingPatches.get(action.id) ?? {}), ...action.patch };
      this.pendingPatches.set(action.id, merged);
      this.schedulePatchFlush();
      return;
    }
    // Anything else waits for pending edits first, so ordering stays intact.
    this.flush();
    this.enqueue(() => perform(action));
  }

  /** Sends every pending edit now. With `keepalive`, requests survive the page closing. */
  flush(keepalive = false): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    for (const [id, patch] of this.pendingPatches) {
      this.enqueue(() => api.updateTask(id, patch, { keepalive }));
    }
    this.pendingPatches.clear();
  }

  private schedulePatchFlush(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.flush();
    }, PATCH_DELAY_MS);
  }

  private enqueue(job: () => Promise<unknown>): void {
    this.active++;
    this.chain = this.chain
      .then(job)
      .then(
        () => undefined,
        (error: unknown) => {
          this.handlers.onError(error instanceof Error ? error : new Error(String(error)));
        },
      )
      .finally(() => {
        this.active--;
      });
  }
}

function perform(action: Action): Promise<unknown> {
  switch (action.type) {
    case 'project/add':
      return api.createProject(action.project);
    case 'project/update':
      return api.updateProject(action.id, action.patch);
    case 'project/delete':
      return api.deleteProject(action.id);
    case 'task/add':
      return api.createTask(action.task);
    case 'task/update':
      return api.updateTask(action.id, action.patch);
    case 'task/delete':
      return api.deleteTask(action.id);
    case 'comment/add':
      return api.createComment(action.taskId, action.comment);
    case 'comment/delete':
      return api.deleteComment(action.taskId, action.commentId);
    case 'data/replace':
      return api.replaceData(action.data);
  }
}
