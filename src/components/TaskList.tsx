import type { Project, Task } from '../types';
import { TaskCard } from './TaskCard';

interface Props {
  project: Project;
  /** Tasks of this project, already in list order. */
  tasks: Task[];
  showDone: boolean;
  onOpenTask: (taskId: string) => void;
}

export function TaskList({ project, tasks, showDone, onOpenTask }: Props) {
  const open = tasks.filter((t) => !t.doneAt);
  const done = tasks.filter((t) => t.doneAt);

  return (
    <section className="list" aria-label={`${project.name} tasks`}>
      {open.map((t) => (
        <TaskCard key={t.id} task={t} project={project} onOpen={onOpenTask} />
      ))}
      {open.length === 0 && (
        <p className="hint">
          {done.length > 0 ? 'Everything in this project is done.' : 'No tasks yet. Press + to add the first one.'}
        </p>
      )}
      {showDone && done.map((t) => <TaskCard key={t.id} task={t} project={project} onOpen={onOpenTask} />)}
      {open.length > 0 && (
        <p className="hint">
          {open.length} open {open.length === 1 ? 'task' : 'tasks'} · new tasks land at the bottom
        </p>
      )}
    </section>
  );
}
