# Working Stack

A small web app for tracking the tasks you currently have in work across several projects.

- The top bar switches between one project and **All projects**. The **+** button adds a task to the bottom of the list.
- Each card shows the task title, a short description, the deadline, how long the task has been in work, and its project.
- Clicking a card opens the task: every property is editable in place, with a free-form **Context** field and a running list of **Comments**.
- In **All projects** every project gets its own column with a header, side by side.

Data lives in the browser's `localStorage` (key `working-stack:v1`). There is no server.

## Run it

```bash
npm install
npm run dev
```

Then open the URL Vite prints (http://localhost:5173 by default).

## Scripts

| Command             | What it does                              |
| ------------------- | ----------------------------------------- |
| `npm run dev`       | Dev server with hot reload                |
| `npm run build`     | Type-check and build to `dist/`           |
| `npm run preview`   | Serve the production build locally        |
| `npm run typecheck` | Type-check only                           |

## Layout

```
src/
  App.tsx                 state wiring, dialogs, view switching
  store.ts                reducer + localStorage persistence
  types.ts                Project / Task / Comment types
  lib/dates.ts            deadline and "in work" formatting
  lib/sample.ts           sample projects and tasks for an empty install
  components/             TopBar, ProjectMenu, TaskList, AllProjectsBoard,
                          TaskCard, TaskDialog, NewTaskDialog, ProjectDialog
  styles.css              design tokens and all styling
```
