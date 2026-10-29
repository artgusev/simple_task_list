import { useState, type FormEvent } from 'react';
import { todayISO } from '../lib/dates';
import type { Project } from '../types';
import { CloseIcon } from './icons';
import { Modal } from './Modal';

export interface NewTaskInput {
  title: string;
  description: string;
  projectId: string;
  /** YYYY-MM-DD or '' for no deadline. */
  deadline: string;
  /** YYYY-MM-DD; defaults to today. */
  startedAt: string;
}

interface Props {
  open: boolean;
  projects: Project[];
  defaultProjectId: string;
  onClose: () => void;
  onCreate: (input: NewTaskInput) => void;
}

export function NewTaskDialog({ open, onClose, ...form }: Props) {
  return (
    <Modal open={open} onClose={onClose} aria-labelledby="new-task-title">
      <NewTaskForm onClose={onClose} {...form} />
    </Modal>
  );
}

function NewTaskForm({ projects, defaultProjectId, onClose, onCreate }: Omit<Props, 'open'>) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState(defaultProjectId);
  const [deadline, setDeadline] = useState('');
  const [startedAt, setStartedAt] = useState(todayISO);
  const canSubmit = title.trim().length > 0 && projectId !== '';
  const target = projects.find((p) => p.id === projectId);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    onCreate({ title, description, projectId, deadline, startedAt: startedAt || todayISO() });
  }

  return (
    <form className="modal__inner" onSubmit={submit}>
      <header className="modal__head">
        <h2 className="modal__title" id="new-task-title">
          New task
        </h2>
        <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
          <CloseIcon size={20} />
        </button>
      </header>
      <div className="modal__body">
        <div className="field">
          <label className="field__label" htmlFor="nt-title">
            Title
          </label>
          <input
            id="nt-title"
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs doing?"
            data-autofocus
            required
          />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="nt-desc">
            Short description
          </label>
          <input
            id="nt-desc"
            className="input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="One line that explains the task on its card"
          />
        </div>
        <div className="form-row">
          <div className="field">
            <label className="field__label" htmlFor="nt-project">
              Project
            </label>
            <select id="nt-project" className="select" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field__label" htmlFor="nt-deadline">
              Deadline
            </label>
            <input
              id="nt-deadline"
              type="date"
              className="input"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="nt-started">
              Started
            </label>
            <input
              id="nt-started"
              type="date"
              className="input"
              value={startedAt}
              onChange={(e) => setStartedAt(e.target.value)}
            />
          </div>
        </div>
        <p className="field__hint">
          The task goes to the bottom of the {target ? `${target.name} list` : 'list'}. Context and comments can be added
          once it exists.
        </p>
      </div>
      <footer className="modal__foot modal__foot--end">
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="btn btn--primary" disabled={!canSubmit}>
          Add task
        </button>
      </footer>
    </form>
  );
}
