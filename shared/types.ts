// Types shared by the browser client (src/) and the server (server/).

export const PROJECT_COLORS = ['blue', 'orange', 'teal', 'purple', 'pink', 'green', 'amber', 'slate'] as const;
export type ProjectColor = (typeof PROJECT_COLORS)[number];

export interface Project {
  id: string;
  name: string;
  color: ProjectColor;
  createdAt: string;
}

export interface Comment {
  id: string;
  text: string;
  createdAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  /** Calendar date (YYYY-MM-DD) or null when no deadline is set. */
  deadline: string | null;
  /** Calendar date (YYYY-MM-DD): the day work on the task started. "In work" counts from here. */
  startedAt: string;
  createdAt: string;
  /** Long-form notes: background, links, decisions. */
  context: string;
  comments: Comment[];
  doneAt: string | null;
  /** Position in its list. New tasks get the highest order, so they land at the bottom. */
  order: number;
}

export interface AppData {
  projects: Project[];
  tasks: Task[];
}

/** Fields of a task the client may change after creation. */
export type TaskPatch = Partial<Omit<Task, 'id' | 'comments'>>;

/** Fields of a project the client may change after creation. */
export type ProjectPatch = Partial<Pick<Project, 'name' | 'color'>>;
