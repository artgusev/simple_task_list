import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ALL_PROJECTS, type Project } from '../types';
import { CheckIcon, ChevronDownIcon, LogOutIcon, PencilIcon, PlusIcon } from './icons';

interface Props {
  projects: Project[];
  /** Open-task count per project id. */
  counts: Map<string, number>;
  selection: string;
  onSelect: (selection: string) => void;
  onNewProject: () => void;
  onEditProject: (projectId: string) => void;
  /** Present only when the app is password protected; adds a "Sign out" entry. */
  onSignOut?: () => void;
}

export function ProjectMenu({ projects, counts, selection, onSelect, onNewProject, onEditProject, onSignOut }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selected = selection === ALL_PROJECTS ? null : (projects.find((p) => p.id === selection) ?? null);
  const total = projects.reduce((sum, p) => sum + (counts.get(p.id) ?? 0), 0);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    const current =
      menuRef.current?.querySelector<HTMLElement>('[aria-checked="true"]') ??
      menuRef.current?.querySelector<HTMLElement>('[role^="menuitem"]');
    current?.focus();
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function onMenuKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? []);
    if (items.length === 0) return;
    e.preventDefault();
    const idx = items.indexOf(document.activeElement as HTMLElement);
    const next = e.key === 'ArrowDown' ? (idx + 1) % items.length : (idx - 1 + items.length) % items.length;
    items[next]?.focus();
  }

  function choose(value: string) {
    onSelect(value);
    setOpen(false);
    buttonRef.current?.focus();
  }

  function run(action: () => void) {
    setOpen(false);
    action();
  }

  return (
    <div className="menu-wrap" ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        className="pill-button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {selected ? (
          <span className="dot" data-color={selected.color} aria-hidden="true" />
        ) : (
          <ClusterDots projects={projects} />
        )}
        <span className="pill-button__label">{selected ? selected.name : 'All projects'}</span>
        <ChevronDownIcon size={18} />
      </button>

      {open && (
        <div className="menu" role="menu" aria-label="Switch project" ref={menuRef} onKeyDown={onMenuKeyDown}>
          <button
            type="button"
            role="menuitemradio"
            aria-checked={selection === ALL_PROJECTS}
            className="menu__item"
            onClick={() => choose(ALL_PROJECTS)}
          >
            <ClusterDots projects={projects} />
            <span className="menu__label">All projects</span>
            <span className="menu__count">{total}</span>
            {selection === ALL_PROJECTS && <CheckIcon size={16} className="menu__check" />}
          </button>
          <div className="menu__sep" role="separator" />
          {projects.map((p) => (
            <button
              key={p.id}
              type="button"
              role="menuitemradio"
              aria-checked={p.id === selection}
              className="menu__item"
              onClick={() => choose(p.id)}
            >
              <span className="dot" data-color={p.color} aria-hidden="true" />
              <span className="menu__label">{p.name}</span>
              <span className="menu__count">{counts.get(p.id) ?? 0}</span>
              {p.id === selection && <CheckIcon size={16} className="menu__check" />}
            </button>
          ))}
          <div className="menu__sep" role="separator" />
          {selected && (
            <button
              type="button"
              role="menuitem"
              className="menu__item menu__item--action"
              onClick={() => run(() => onEditProject(selected.id))}
            >
              <PencilIcon size={16} />
              <span className="menu__label">Edit “{selected.name}”</span>
            </button>
          )}
          <button type="button" role="menuitem" className="menu__item menu__item--action" onClick={() => run(onNewProject)}>
            <PlusIcon size={16} />
            <span className="menu__label">New project</span>
          </button>
          {onSignOut && (
            <>
              <div className="menu__sep" role="separator" />
              <button type="button" role="menuitem" className="menu__item menu__item--quiet" onClick={() => run(onSignOut)}>
                <LogOutIcon size={16} />
                <span className="menu__label">Sign out</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Four small dots in the first projects' colours, the "all projects" glyph. */
function ClusterDots({ projects }: { projects: Project[] }) {
  const slots = [0, 1, 2, 3].map((i) => projects[i]?.color);
  return (
    <span className="cluster" aria-hidden="true">
      {slots.map((color, i) => (
        <span key={i} data-color={color} />
      ))}
    </span>
  );
}
