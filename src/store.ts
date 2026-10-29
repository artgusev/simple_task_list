import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { Action } from './actions';
import { api } from './api';
import { SyncQueue } from './sync';
import type { AppData, Task } from './types';

export const EMPTY_DATA: AppData = { projects: [], tasks: [] };

/** The order value that puts a new task at the bottom of every list. */
export function nextOrder(tasks: Task[]): number {
  return tasks.reduce((max, t) => Math.max(max, t.order), -1) + 1;
}

export function reducer(state: AppData, action: Action): AppData {
  switch (action.type) {
    case 'project/add':
      return { ...state, projects: [...state.projects, action.project] };
    case 'project/update':
      return {
        ...state,
        projects: state.projects.map((p) => (p.id === action.id ? { ...p, ...action.patch } : p)),
      };
    case 'project/delete':
      return {
        projects: state.projects.filter((p) => p.id !== action.id),
        tasks: state.tasks.filter((t) => t.projectId !== action.id),
      };
    case 'task/add':
      return { ...state, tasks: [...state.tasks, action.task] };
    case 'task/update':
      return {
        ...state,
        tasks: state.tasks.map((t) => (t.id === action.id ? { ...t, ...action.patch } : t)),
      };
    case 'task/delete':
      return { ...state, tasks: state.tasks.filter((t) => t.id !== action.id) };
    case 'comment/add':
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.taskId ? { ...t, comments: [...t.comments, action.comment] } : t,
        ),
      };
    case 'comment/delete':
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.taskId
            ? { ...t, comments: t.comments.filter((c) => c.id !== action.commentId) }
            : t,
        ),
      };
    case 'data/replace':
      return action.data;
  }
}

/** 'loading' until the first fetch answers; 'offline' when that first fetch failed. */
export type LoadStatus = 'loading' | 'ready' | 'offline';

export interface AppStore {
  data: AppData;
  status: LoadStatus;
  /** The last save or load error, cleared by a successful reload. */
  error: string | null;
  /** Applies the change locally right away and queues it for the server. */
  dispatch: (action: Action) => void;
  /** Fetches the server's copy and replaces local state with it. */
  reload: () => Promise<void>;
  /** Sends edits that are still waiting for the typing pause. */
  flush: () => void;
}

export function useAppData(): AppStore {
  const [data, apply] = useReducer(reducer, EMPTY_DATA);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const queueRef = useRef<SyncQueue | null>(null);
  if (queueRef.current === null) {
    queueRef.current = new SyncQueue({ onError: (e) => setError(e.message) });
  }
  const queue = queueRef.current;

  const reload = useCallback(async () => {
    try {
      const fresh = await api.getData();
      apply({ type: 'data/replace', data: fresh });
      setStatus('ready');
      setError(null);
    } catch (e) {
      setStatus((current) => (current === 'ready' ? current : 'offline'));
      setError(e instanceof Error ? e.message : 'Could not load data');
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Pick up changes made on other devices when this tab or window comes back, and
  // don't lose edits that were still waiting to be sent when the page closes.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible' && !queue.busy) void reload();
    };
    const onPageHide = () => queue.flush(true);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [queue, reload]);

  const dispatch = useCallback(
    (action: Action) => {
      apply(action);
      queue.push(action);
    },
    [queue],
  );

  const flush = useCallback(() => queue.flush(), [queue]);

  return { data, status, error, dispatch, reload, flush };
}
