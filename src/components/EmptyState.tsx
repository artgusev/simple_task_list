interface Props {
  onCreateProject: () => void;
  onLoadSample: () => void;
}

export function EmptyState({ onCreateProject, onLoadSample }: Props) {
  return (
    <div className="empty">
      <h2>No projects yet</h2>
      <p>
        Working Stack keeps your open tasks grouped by project. Create the first project, then add tasks to it with
        the + button.
      </p>
      <div className="empty__actions">
        <button type="button" className="btn btn--primary" onClick={onCreateProject}>
          Create a project
        </button>
        <button type="button" className="btn" onClick={onLoadSample}>
          Load sample data
        </button>
      </div>
    </div>
  );
}
