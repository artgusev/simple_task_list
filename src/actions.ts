import type { AppData, Comment, Project, ProjectPatch, Task, TaskPatch } from './types';

/** Every change to the data, applied locally first and then sent to the server. */
export type Action =
  | { type: 'project/add'; project: Project }
  | { type: 'project/update'; id: string; patch: ProjectPatch }
  | { type: 'project/delete'; id: string }
  | { type: 'task/add'; task: Task }
  | { type: 'task/update'; id: string; patch: TaskPatch }
  | { type: 'task/delete'; id: string }
  | { type: 'comment/add'; taskId: string; comment: Comment }
  | { type: 'comment/delete'; taskId: string; commentId: string }
  | { type: 'data/replace'; data: AppData };
