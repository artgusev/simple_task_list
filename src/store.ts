import { useEffect, useReducer, type Dispatch } from 'react';
import type { AppData, Comment, Project, Task } from './types';

const STORAGE_KEY = 'working-stack:v1';

export type Action =
  | { type: 'project/add'; project: Project }
  | { type: 'project/update'; id: string; patch: Partial<Omit<Project, 'id'>> }
  | { type: 'project/delete'; id: string }
  | { type: 'task/add'; task: Task }
  | { type: 'task/update'; id: string; patch: Partial<Omit<Task, 'id'>> }
  | { type: 'task/delete'; id: string }
  | { type: 'comment/add'; taskId: string; comment: Comment }
  | { type: 'comment/delete'; taskId: string; commentId: string }
  | { type: 'data/replace'; data: AppData };

export const EMPTY_DATA: AppData = { projects: [], tasks: [] };

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_DATA;
    const parsed = JSON.parse(raw) as Partial<AppData> | null;
    return {
      projects: Array.isArray(parsed?.projects) ? parsed.projects : [],
      tasks: Array.isArray(parsed?.tasks) ? parsed.tasks : [],
    };
  } catch {
    return EMPTY_DATA;
  }
}

export function saveData(data: AppData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage can be unavailable (private mode, quota). The app keeps working in memory.
  }
}

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

export function useAppData(): [AppData, Dispatch<Action>] {
  const [data, dispatch] = useReducer(reducer, undefined, loadData);
  useEffect(() => {
    saveData(data);
  }, [data]);
  return [data, dispatch];
}
