import { useState, type FormEvent } from 'react';
import { PROJECT_COLORS, type Project, type ProjectColor } from '../types';
import { CloseIcon } from './icons';
import { Modal } from './Modal';

export interface ProjectInput {
  name: string;
  color: ProjectColor;
}

interface Props {
  open: boolean;
  /** The project being edited, or null when creating one. */
  project: Project | null;
  /** Number of tasks that would go with the project if deleted. */
  taskCount: number;
  defaultColor: ProjectColor;
  onClose: () => void;
  onSave: (input: ProjectInput) => void;
  onDelete?: () => void;
}

const COLOR_LABELS: Record<ProjectColor, string> = {
  blue: 'Blue',
  orange: 'Orange',
  teal: 'Teal',
  purple: 'Purple',
  pink: 'Pink',
  green: 'Green',
  amber: 'Amber',
  slate: 'Slate',
};

export function ProjectDialog({ open, onClose, ...form }: Props) {
  return (
    <Modal open={open} onClose={onClose} aria-labelledby="project-dialog-title" className="modal--narrow">
      <ProjectForm onClose={onClose} {...form} />
    </Modal>
  );
}

function ProjectForm({ project, taskCount, defaultColor, onClose, onSave, onDelete }: Omit<Props, 'open'>) {
  const [name, setName] = useState(project?.name ?? '');
  const [color, setColor] = useState<ProjectColor>(project?.color ?? defaultColor);
  const canSubmit = name.trim().length > 0;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    onSave({ name, color });
  }

  function confirmDelete() {
    if (!project || !onDelete) return;
    const tasks = taskCount === 0 ? 'no tasks' : `${taskCount} ${taskCount === 1 ? 'task' : 'tasks'}`;
    if (window.confirm(`Delete "${project.name}" and its ${tasks}? This cannot be undone.`)) onDelete();
  }

  return (
    <form className="modal__inner" onSubmit={submit}>
      <header className="modal__head">
        <h2 className="modal__title" id="project-dialog-title">
          {project ? 'Edit project' : 'New project'}
        </h2>
        <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
          <CloseIcon size={20} />
        </button>
      </header>
      <div className="modal__body">
        <div className="field">
          <label className="field__label" htmlFor="pr-name">
            Name
          </label>
          <input
            id="pr-name"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Atlas API"
            data-autofocus
            required
          />
        </div>
        <fieldset className="field fieldset">
          <legend className="field__label">Colour</legend>
          <div className="swatches">
            {PROJECT_COLORS.map((c) => (
              <label key={c} className="swatch" data-color={c} title={COLOR_LABELS[c]}>
                <input
                  type="radio"
                  name="project-color"
                  value={c}
                  checked={color === c}
                  onChange={() => setColor(c)}
                  aria-label={COLOR_LABELS[c]}
                />
                <span />
              </label>
            ))}
          </div>
        </fieldset>
        <div className="preview">
          <span className="field__hint">Preview</span>
          <span className="pill pill--project" data-color={color}>
            {name.trim() || 'Project name'}
          </span>
        </div>
      </div>
      <footer className={project && onDelete ? 'modal__foot' : 'modal__foot modal__foot--end'}>
        {project && onDelete && (
          <button type="button" className="btn btn--danger" onClick={confirmDelete}>
            Delete project
          </button>
        )}
        <span className="modal__foot-group">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={!canSubmit}>
            {project ? 'Save' : 'Create project'}
          </button>
        </span>
      </footer>
    </form>
  );
}
