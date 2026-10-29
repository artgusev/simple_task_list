import { describeDeadline, describeInWork } from '../lib/dates';
import type { Project, Task } from '../types';
import { CalendarIcon, CheckIcon, ClockIcon } from './icons';

interface Props {
  task: Task;
  project: Project;
  /** Compact cards are used in the all-projects columns. */
  compact?: boolean;
  onOpen: (taskId: string) => void;
}

export function TaskCard({ task, project, compact = false, onOpen }: Props) {
  const deadline = describeDeadline(task.deadline);
  const inWork = describeInWork(task.startedAt);
  const done = task.doneAt !== null;
  const className = ['card', compact ? 'card--compact' : '', done ? 'card--done' : ''].filter(Boolean).join(' ');
  const projectPill = (
    <span className="pill pill--project" data-color={project.color}>
      {project.name}
    </span>
  );

  return (
    <button type="button" className={className} onClick={() => onOpen(task.id)}>
      <span className="card__head">
        <span className="card__title">{task.title || 'Untitled task'}</span>
        {!compact && projectPill}
      </span>
      {task.description && <span className="card__desc">{task.description}</span>}
      <span className="card__meta">
        {done ? (
          <span className="pill pill--done">
            <CheckIcon size={13} />
            Done
          </span>
        ) : (
          <>
            <span className={`pill pill--${deadline.tone}`}>
              <CalendarIcon size={13} />
              {deadline.label}
            </span>
            <span className="pill">
              <ClockIcon size={13} />
              {inWork.short}
            </span>
          </>
        )}
        {compact && projectPill}
      </span>
    </button>
  );
}
