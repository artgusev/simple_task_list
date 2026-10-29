import { useEffect, useMemo, useState } from 'react';
import { AllProjectsBoard } from './components/AllProjectsBoard';
import { EmptyState } from './components/EmptyState';
import { LoginScreen } from './components/LoginScreen';
import { NewTaskDialog, type NewTaskInput } from './components/NewTaskDialog';
import { ProjectDialog, type ProjectInput } from './components/ProjectDialog';
import { TaskDialog } from './components/TaskDialog';
import { TaskList } from './components/TaskList';
import { TopBar } from './components/TopBar';
import { todayISO } from './lib/dates';
import { uid } from './lib/id';
import { readLegacyLocalData } from './lib/legacy';
import { buildSampleData } from './lib/sample';
import { useSession } from './session';
import { nextOrder, useAppData } from './store';
import { ALL_PROJECTS, PROJECT_COLORS, type Project, type ProjectColor, type Task } from './types';

const SELECTION_KEY = 'working-stack:selection';

type ProjectDialogState = { mode: 'new' } | { mode: 'edit'; projectId: string } | null;

function readSelection(): string {
  try {
    return localStorage.getItem(SELECTION_KEY) ?? ALL_PROJECTS;
  } catch {
    return ALL_PROJECTS;
  }
}

/** Decides between the login screen and the task UI; the task UI only mounts once a session is in place. */
export default function App() {
  const session = useSession();

  if (session.status === 'checking') {
    return (
      <div className="app">
        <header className="topbar">
          <span className="pill-button pill-button--static">Working Stack</span>
        </header>
        <main className="main">
          <p className="hint hint--page">Loading your tasks…</p>
        </main>
      </div>
    );
  }
  if (session.status === 'locked') return <LoginScreen onSignedIn={session.signedIn} />;
  return <Workspace onSignOut={session.status === 'unlocked' ? session.signOut : undefined} />;
}

interface WorkspaceProps {
  /** Present only when the app is password protected. */
  onSignOut?: () => Promise<void>;
}

function Workspace({ onSignOut }: WorkspaceProps) {
  const { data, status, error, dispatch, reload, flush } = useAppData();
  const [selection, setSelection] = useState(readSelection);
  const [showDone, setShowDone] = useState(false);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [projectDialog, setProjectDialog] = useState<ProjectDialogState>(null);
  const legacyData = useMemo(readLegacyLocalData, []);

  const { projects, tasks } = data;
  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const selectedProject = selection === ALL_PROJECTS ? null : (projectById.get(selection) ?? null);

  useEffect(() => {
    try {
      localStorage.setItem(SELECTION_KEY, selection);
    } catch {
      // Selection is a convenience; losing it is fine.
    }
  }, [selection]);

  // A selected project that no longer exists falls back to "All projects" (once data has loaded).
  useEffect(() => {
    if (status === 'ready' && selection !== ALL_PROJECTS && !projectById.has(selection)) setSelection(ALL_PROJECTS);
  }, [status, selection, projectById]);

  const tasksByProject = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const p of projects) map.set(p.id, []);
    for (const t of tasks) map.get(t.projectId)?.push(t);
    for (const list of map.values()) list.sort((a, b) => a.order - b.order);
    return map;
  }, [projects, tasks]);

  const openCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const [id, list] of tasksByProject) counts.set(id, list.filter((t) => !t.doneAt).length);
    return counts;
  }, [tasksByProject]);

  const doneCount = useMemo(() => {
    const scope = selectedProject ? (tasksByProject.get(selectedProject.id) ?? []) : tasks;
    return scope.filter((t) => t.doneAt).length;
  }, [selectedProject, tasksByProject, tasks]);

  const openTask = openTaskId ? (tasks.find((t) => t.id === openTaskId) ?? null) : null;
  const openTaskProject = openTask ? (projectById.get(openTask.projectId) ?? null) : null;
  const editingProject = projectDialog?.mode === 'edit' ? (projectById.get(projectDialog.projectId) ?? null) : null;
  const nextColor: ProjectColor = PROJECT_COLORS[projects.length % PROJECT_COLORS.length] ?? 'blue';

  function handleAdd() {
    if (status !== 'ready') return;
    if (projects.length === 0) setProjectDialog({ mode: 'new' });
    else setNewTaskOpen(true);
  }

  function createTask(input: NewTaskInput) {
    const task: Task = {
      id: uid(),
      projectId: input.projectId,
      title: input.title.trim(),
      description: input.description.trim(),
      deadline: input.deadline || null,
      startedAt: input.startedAt || todayISO(),
      createdAt: new Date().toISOString(),
      context: '',
      comments: [],
      doneAt: null,
      order: nextOrder(tasks),
    };
    dispatch({ type: 'task/add', task });
    setNewTaskOpen(false);
  }

  function saveProject(input: ProjectInput) {
    if (projectDialog?.mode === 'edit') {
      dispatch({ type: 'project/update', id: projectDialog.projectId, patch: { name: input.name.trim(), color: input.color } });
    } else {
      const project: Project = { id: uid(), name: input.name.trim(), color: input.color, createdAt: new Date().toISOString() };
      dispatch({ type: 'project/add', project });
      setSelection(project.id);
    }
    setProjectDialog(null);
  }

  function deleteProject(id: string) {
    dispatch({ type: 'project/delete', id });
    setProjectDialog(null);
    if (selection === id) setSelection(ALL_PROJECTS);
  }

  function signOut() {
    // Edits still waiting for the typing pause go out first, while the cookie is still there.
    flush();
    void onSignOut?.();
  }

  function renderMain() {
    if (status === 'loading') return <p className="hint hint--page">Loading your tasks…</p>;
    if (status === 'offline') {
      return (
        <div className="empty">
          <h2>Can't reach the server</h2>
          <p>{error ?? 'The task server did not answer.'}</p>
          <div className="empty__actions">
            <button type="button" className="btn btn--primary" onClick={() => void reload()}>
              Try again
            </button>
          </div>
        </div>
      );
    }
    if (projects.length === 0) {
      return (
        <EmptyState
          onCreateProject={() => setProjectDialog({ mode: 'new' })}
          onLoadSample={() => dispatch({ type: 'data/replace', data: buildSampleData() })}
          onImportLocal={legacyData ? () => dispatch({ type: 'data/replace', data: legacyData }) : undefined}
        />
      );
    }
    if (selectedProject) {
      return (
        <TaskList
          project={selectedProject}
          tasks={tasksByProject.get(selectedProject.id) ?? []}
          showDone={showDone}
          onOpenTask={setOpenTaskId}
        />
      );
    }
    return (
      <AllProjectsBoard projects={projects} tasksByProject={tasksByProject} showDone={showDone} onOpenTask={setOpenTaskId} />
    );
  }

  return (
    <div className="app">
      <TopBar
        projects={projects}
        counts={openCounts}
        selection={selection}
        onSelect={setSelection}
        onNewProject={() => setProjectDialog({ mode: 'new' })}
        onEditProject={(projectId) => setProjectDialog({ mode: 'edit', projectId })}
        onSignOut={onSignOut ? signOut : undefined}
        doneCount={doneCount}
        showDone={showDone}
        onToggleDone={() => setShowDone((v) => !v)}
        onAdd={handleAdd}
      />

      {error && status === 'ready' && (
        <div className="banner" role="alert">
          <span className="banner__text">Couldn't save to the server: {error}</span>
          <button type="button" className="btn btn--small" onClick={() => void reload()}>
            Reload from server
          </button>
        </div>
      )}

      <main className="main">{renderMain()}</main>

      {openTask && openTaskProject && (
        <TaskDialog
          task={openTask}
          project={openTaskProject}
          projects={projects}
          onClose={() => setOpenTaskId(null)}
          onUpdate={(patch) => dispatch({ type: 'task/update', id: openTask.id, patch })}
          onDelete={() => {
            dispatch({ type: 'task/delete', id: openTask.id });
            setOpenTaskId(null);
          }}
          onAddComment={(text) =>
            dispatch({
              type: 'comment/add',
              taskId: openTask.id,
              comment: { id: uid(), text, createdAt: new Date().toISOString() },
            })
          }
          onDeleteComment={(commentId) => dispatch({ type: 'comment/delete', taskId: openTask.id, commentId })}
        />
      )}

      <NewTaskDialog
        open={newTaskOpen}
        projects={projects}
        defaultProjectId={selectedProject?.id ?? projects[0]?.id ?? ''}
        onClose={() => setNewTaskOpen(false)}
        onCreate={createTask}
      />

      <ProjectDialog
        open={projectDialog !== null}
        project={editingProject}
        taskCount={editingProject ? (tasksByProject.get(editingProject.id)?.length ?? 0) : 0}
        defaultColor={nextColor}
        onClose={() => setProjectDialog(null)}
        onSave={saveProject}
        onDelete={editingProject ? () => deleteProject(editingProject.id) : undefined}
      />
    </div>
  );
}
