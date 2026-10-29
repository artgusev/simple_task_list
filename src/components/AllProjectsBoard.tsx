import type { Project, Task } from '../types';
import { TaskCard } from './TaskCard';

interface Props {
  projects: Project[];
  /** Tasks grouped by project id, each list already in order. */
  tasksByProject: Map<string, Task[]>;
  showDone: boolean;
  onOpenTask: (taskId: string) => void;
}

export function AllProjectsBoard({ projects, tasksByProject, showDone, onOpenTask }: Props) {
  return (
    <div className="board" aria-label="All projects">
      {projects.map((project) => {
        const tasks = tasksByProject.get(project.id) ?? [];
        const open = tasks.filter((t) => !t.doneAt);
        const done = tasks.filter((t) => t.doneAt);
        return (
          <section className="column" key={project.id} aria-label={project.name}>
            <h2 className="column__head">
              <span className="dot" data-color={project.color} aria-hidden="true" />
              <span className="column__name">{project.name}</span>
              <span className="count">{open.length}</span>
            </h2>
            <div className="column__body">
              {open.map((t) => (
                <TaskCard key={t.id} task={t} project={project} compact onOpen={onOpenTask} />
              ))}
              {open.length === 0 && (
                <p className="hint hint--column">{done.length > 0 ? 'All done.' : 'No tasks yet.'}</p>
              )}
              {showDone && done.map((t) => <TaskCard key={t.id} task={t} project={project} compact onOpen={onOpenTask} />)}
            </div>
          </section>
        );
      })}
    </div>
  );
}
