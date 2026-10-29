import type { Project } from '../types';
import { PlusIcon } from './icons';
import { ProjectMenu } from './ProjectMenu';

interface Props {
  projects: Project[];
  counts: Map<string, number>;
  selection: string;
  onSelect: (selection: string) => void;
  onNewProject: () => void;
  onEditProject: (projectId: string) => void;
  /** Present only when the app is password protected. */
  onSignOut?: () => void;
  doneCount: number;
  showDone: boolean;
  onToggleDone: () => void;
  onAdd: () => void;
}

export function TopBar(props: Props) {
  const { doneCount, showDone, onToggleDone, onAdd, ...menu } = props;
  const hasProjects = props.projects.length > 0;
  return (
    <header className="topbar">
      {hasProjects ? (
        <ProjectMenu {...menu} />
      ) : (
        <span className="pill-button pill-button--static">Working Stack</span>
      )}
      <div className="topbar__right">
        {(doneCount > 0 || showDone) && (
          <button type="button" className="link-btn" onClick={onToggleDone} aria-pressed={showDone}>
            {showDone ? 'Hide done' : `Show done (${doneCount})`}
          </button>
        )}
        <button
          type="button"
          className="fab"
          aria-label={hasProjects ? 'Add task' : 'Create project'}
          title={hasProjects ? 'Add task' : 'Create project'}
          onClick={onAdd}
        >
          <PlusIcon size={22} />
        </button>
      </div>
    </header>
  );
}
