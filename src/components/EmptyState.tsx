interface Props {
  onCreateProject: () => void;
  onLoadSample: () => void;
  /** Present when the localStorage version of the app left data in this browser. */
  onImportLocal?: () => void;
}

export function EmptyState({ onCreateProject, onLoadSample, onImportLocal }: Props) {
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
      {onImportLocal && (
        <p className="field__hint">
          This browser still has tasks from the earlier version.{' '}
          <button type="button" className="link-btn link-btn--inline" onClick={onImportLocal}>
            Import them to the server
          </button>
        </p>
      )}
    </div>
  );
}
