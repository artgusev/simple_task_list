import { useState, type KeyboardEvent } from 'react';
import { describeDeadline, describeInWork, formatDateTime } from '../lib/dates';
import type { Project, Task } from '../types';
import { CalendarIcon, CheckIcon, ClockIcon, CloseIcon, SendIcon } from './icons';
import { Modal } from './Modal';

interface Props {
  task: Task;
  project: Project;
  projects: Project[];
  onClose: () => void;
  onUpdate: (patch: Partial<Omit<Task, 'id'>>) => void;
  onDelete: () => void;
  onAddComment: (text: string) => void;
  onDeleteComment: (commentId: string) => void;
}

export function TaskDialog({ task, project, projects, onClose, onUpdate, onDelete, onAddComment, onDeleteComment }: Props) {
  const deadline = describeDeadline(task.deadline);
  const inWork = describeInWork(task.startedAt);
  const [draft, setDraft] = useState('');

  function submitComment() {
    const text = draft.trim();
    if (!text) return;
    onAddComment(text);
    setDraft('');
  }

  function onComposerKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submitComment();
    }
  }

  function confirmDelete() {
    const name = task.title.trim() || 'this task';
    if (window.confirm(`Delete "${name}"? This cannot be undone.`)) onDelete();
  }

  return (
    <Modal open onClose={onClose} aria-labelledby="task-dialog-title">
      <div className="modal__inner">
        <header className="modal__head">
          <label className="prop__control prop__control--project" data-color={project.color}>
            <span className="dot dot--sm" aria-hidden="true" />
            <span className="sr-only">Project</span>
            <select value={task.projectId} onChange={(e) => onUpdate({ projectId: e.target.value })}>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <div className="modal__actions">
            <button
              type="button"
              className="btn"
              onClick={() => onUpdate({ doneAt: task.doneAt ? null : new Date().toISOString() })}
            >
              {task.doneAt ? 'Reopen' : 'Mark done'}
            </button>
            <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
              <CloseIcon size={20} />
            </button>
          </div>
        </header>

        <div className="modal__body">
          <div className="stack stack--sm">
            <input
              id="task-dialog-title"
              className="title-input"
              value={task.title}
              onChange={(e) => onUpdate({ title: e.target.value })}
              placeholder="Task title"
              aria-label="Task title"
            />
            <input
              className="desc-input"
              value={task.description}
              onChange={(e) => onUpdate({ description: e.target.value })}
              placeholder="Short description"
              aria-label="Short description"
            />
          </div>

          <div className="props">
            <div className="prop">
              <span className="prop__label" id="prop-deadline">
                Deadline
              </span>
              <label className={`prop__control prop__control--${deadline.tone}`}>
                <CalendarIcon size={14} />
                <input
                  type="date"
                  aria-labelledby="prop-deadline"
                  value={task.deadline ?? ''}
                  onChange={(e) => onUpdate({ deadline: e.target.value || null })}
                />
              </label>
              <span className="prop__hint">{deadline.detail}</span>
            </div>
            <div className="prop">
              <span className="prop__label" id="prop-started">
                Started
              </span>
              <label className="prop__control">
                <ClockIcon size={14} />
                <input
                  type="date"
                  aria-labelledby="prop-started"
                  value={task.startedAt}
                  onChange={(e) => {
                    if (e.target.value) onUpdate({ startedAt: e.target.value });
                  }}
                />
              </label>
              <span className="prop__hint">{inWork.long}</span>
            </div>
            {task.doneAt && (
              <div className="prop">
                <span className="prop__label">Done</span>
                <span className="prop__control prop__control--done">
                  <CheckIcon size={14} />
                  {formatDateTime(task.doneAt)}
                </span>
              </div>
            )}
          </div>

          <div className="field">
            <label className="field__label" htmlFor="task-context">
              Context
            </label>
            <textarea
              id="task-context"
              className="textarea"
              rows={5}
              value={task.context}
              onChange={(e) => onUpdate({ context: e.target.value })}
              placeholder="Background, links, decisions: anything you need to pick this task up again."
            />
          </div>

          <section className="comments" aria-labelledby="comments-title">
            <h2 className="comments__title" id="comments-title">
              Comments<span>{task.comments.length}</span>
            </h2>
            {task.comments.map((c) => (
              <article className="comment" key={c.id}>
                <span className="comment__time">{formatDateTime(c.createdAt)}</span>
                <p className="comment__text">{c.text}</p>
                <button
                  type="button"
                  className="comment__delete"
                  aria-label="Delete comment"
                  onClick={() => onDeleteComment(c.id)}
                >
                  <CloseIcon size={14} />
                </button>
              </article>
            ))}
            {task.comments.length === 0 && (
              <p className="field__hint">No comments yet. Use them as a running log for this task.</p>
            )}
            <div className="composer">
              <label htmlFor="new-comment" className="sr-only">
                Add a comment
              </label>
              <textarea
                id="new-comment"
                className="textarea composer__input"
                rows={2}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onComposerKeyDown}
                placeholder="Add a comment (Ctrl/Cmd + Enter to post)"
              />
              <button
                type="button"
                className="fab"
                aria-label="Post comment"
                onClick={submitComment}
                disabled={!draft.trim()}
              >
                <SendIcon size={18} />
              </button>
            </div>
          </section>
        </div>

        <footer className="modal__foot">
          <span className="field__hint">Created {formatDateTime(task.createdAt)}</span>
          <button type="button" className="btn btn--danger" onClick={confirmDelete}>
            Delete task
          </button>
        </footer>
      </div>
    </Modal>
  );
}
