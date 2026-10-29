# Working Stack

A small web app for tracking the tasks you currently have in work across several projects. It runs as one
Node process: an HTTP API backed by a SQLite file, which also serves the browser UI. Open it from any device
and you see the same lists.

- The top bar switches between one project and **All projects**. The **+** button adds a task to the bottom of the list.
- Each card shows the task title, a short description, the deadline, how long the task has been in work, and its project.
- Clicking a card opens the task: every property is editable in place, with a free-form **Context** field and a running list of **Comments**.
- In **All projects** every project gets its own column with a header, side by side.

## Requirements

Node.js 22.13 or newer (24 LTS recommended). The server uses Node's built-in `node:sqlite` module, so there is
nothing native to compile. Node prints a one-line "SQLite is an experimental feature" warning at startup; it is
harmless.

## Development

```bash
npm install
npm run dev
```

This starts the API on http://localhost:3000 and the Vite dev server on http://localhost:5173, which proxies
`/api` to the API. Open the Vite URL. The database is created at `./data/working-stack.db`.

## Running on a server

```bash
npm ci
npm run build
PORT=3000 DB_PATH=/var/lib/working-stack/working-stack.db npm start
```

`npm run build` type-checks everything, builds the client into `dist/client` and compiles the server into
`dist/server`. `npm start` serves both from port 3000.

Environment variables:

| Variable     | Default                     | Meaning                                   |
| ------------ | --------------------------- | ----------------------------------------- |
| `PORT`       | `3000`                      | Port to listen on                         |
| `HOST`       | `0.0.0.0`                   | Interface to bind                         |
| `DB_PATH`    | `./data/working-stack.db`   | SQLite file (directory is created)        |
| `CLIENT_DIR` | `dist/client`               | Where the built UI lives                  |

Back up the app by copying the SQLite file (and its `-wal` / `-shm` siblings, or run `sqlite3 file ".backup out.db"`).

### systemd example

```ini
[Unit]
Description=Working Stack
After=network.target

[Service]
User=www-data
WorkingDirectory=/opt/working-stack
Environment=PORT=3000
Environment=DB_PATH=/var/lib/working-stack/working-stack.db
ExecStart=/usr/bin/node dist/server/index.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

### Docker

```bash
docker build -t working-stack .
docker run -d --name working-stack -p 3000:3000 -v working-stack-data:/data working-stack
```

### There is no login

The API accepts requests from anyone who can reach the port. Keep it on a private network or VPN, or put it
behind a reverse proxy (nginx, Caddy, Traefik) that adds HTTPS and authentication, for example HTTP basic auth.
Do not expose port 3000 directly to the internet.

## API

All endpoints are under `/api` and speak JSON.

| Method   | Path                                 | Purpose                                   |
| -------- | ------------------------------------ | ----------------------------------------- |
| `GET`    | `/data`                              | Everything: projects and tasks with comments |
| `PUT`    | `/data`                              | Replace everything (sample data, imports) |
| `POST`   | `/projects`                          | Create a project                          |
| `PATCH`  | `/projects/:id`                      | Rename or recolour a project              |
| `DELETE` | `/projects/:id`                      | Delete a project and its tasks            |
| `POST`   | `/tasks`                             | Create a task                             |
| `PATCH`  | `/tasks/:id`                         | Change any task field                     |
| `DELETE` | `/tasks/:id`                         | Delete a task                             |
| `POST`   | `/tasks/:id/comments`                | Add a comment                             |
| `DELETE` | `/tasks/:id/comments/:commentId`     | Delete a comment                          |

The browser applies each change locally first, then sends it; edits made while typing are merged and sent
after a short pause. If a request fails, a banner offers to reload the server's copy. When a tab regains focus
it refreshes from the server, so changes from another device show up.

## Scripts

| Command             | What it does                                            |
| ------------------- | ------------------------------------------------------- |
| `npm run dev`       | API with auto-restart plus the Vite dev server          |
| `npm run build`     | Type-check, build the client, compile the server        |
| `npm start`         | Run the built server (serves API and UI)                |
| `npm run typecheck` | Type-check client and server                            |

## Layout

```
shared/types.ts           Project / Task / Comment types used on both sides
server/
  index.ts                reads env, opens the database, starts listening
  app.ts                  Express app: JSON API, static client, error handling
  routes.ts               /api routes and request validation
  repo.ts                 SQL queries
  db.ts                   schema and connection
src/
  App.tsx                 state wiring, dialogs, view switching
  store.ts                local state + server sync hook
  sync.ts                 ordered request queue with merged edits
  api.ts                  fetch helpers for /api
  lib/dates.ts            deadline and "in work" formatting
  lib/sample.ts           sample projects and tasks for an empty install
  components/             TopBar, ProjectMenu, TaskList, AllProjectsBoard,
                          TaskCard, TaskDialog, NewTaskDialog, ProjectDialog
  styles.css              design tokens and all styling
```
