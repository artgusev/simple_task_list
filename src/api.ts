import type { AppData, Comment, Project, ProjectPatch, Task, TaskPatch } from './types';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface RequestOptions {
  /** Lets the request finish even when the page is being closed. */
  keepalive?: boolean;
}

async function request<T>(method: string, path: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      keepalive: options.keepalive,
    });
  } catch {
    throw new ApiError(0, 'Could not reach the server');
  }
  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`.trim();
    try {
      const data = (await response.json()) as { error?: unknown };
      if (typeof data.error === 'string') message = data.error;
    } catch {
      // Not a JSON error body; keep the status text.
    }
    throw new ApiError(response.status, message);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  getData: () => request<AppData>('GET', '/api/data'),
  replaceData: (data: AppData) => request<AppData>('PUT', '/api/data', data),

  createProject: (project: Project) => request<Project>('POST', '/api/projects', project),
  updateProject: (id: string, patch: ProjectPatch) => request<Project>('PATCH', `/api/projects/${id}`, patch),
  deleteProject: (id: string) => request<void>('DELETE', `/api/projects/${id}`),

  createTask: (task: Task) => request<Task>('POST', '/api/tasks', task),
  updateTask: (id: string, patch: TaskPatch, options?: RequestOptions) =>
    request<Task>('PATCH', `/api/tasks/${id}`, patch, options),
  deleteTask: (id: string) => request<void>('DELETE', `/api/tasks/${id}`),

  createComment: (taskId: string, comment: Comment) =>
    request<Comment>('POST', `/api/tasks/${taskId}/comments`, comment),
  deleteComment: (taskId: string, commentId: string) =>
    request<void>('DELETE', `/api/tasks/${taskId}/comments/${commentId}`),
};
