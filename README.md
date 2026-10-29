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

| Variable         | Default                     | Meaning                                                |
| ---------------- | --------------------------- | ------------------------------------------------------ |
| `PORT`           | `3000`                      | Port to listen on                                      |
| `HOST`           | `0.0.0.0`                   | Interface to bind                                      |
| `DB_PATH`        | `./data/working-stack.db`   | SQLite file (directory is created)                     |
| `CLIENT_DIR`     | `dist/client`               | Where the built UI lives                               |
| `APP_PASSWORD`   | unset                       | Require this password to use the app (see below)       |
| `SESSION_SECRET` | unset                       | Extra key material for session cookies (see below)     |

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
Environment=APP_PASSWORD=change-me
ExecStart=/usr/bin/node dist/server/index.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

### Docker

```bash
docker build -t working-stack .
docker run -d --name working-stack -p 3000:3000 -v working-stack-data:/data -e APP_PASSWORD=change-me working-stack
```

### Password protection

There is one user and, optionally, one password.

- **`APP_PASSWORD` unset or empty:** the app is open. Anyone who can reach the port can read and change every
  task, so keep it on a private network or VPN, or behind a reverse proxy that adds authentication. Do not expose
  it to the internet like this.
- **`APP_PASSWORD` set:** the browser shows a login screen, and every request under `/api` must carry the session
  cookie, otherwise it is answered with `401 {"error":"Unauthorized"}`. The only exceptions are `GET /api/session`,
  `POST /api/login` and `POST /api/logout`. The static files (`index.html`, scripts, styles) stay public; they
  contain no data.

Signing in sets the cookie `ws_session`: HttpOnly, SameSite=Lax, path `/api`, valid for 30 days, and `Secure`
when the request arrived over HTTPS (directly, or through a proxy that sends `X-Forwarded-Proto: https`). Serve
the app over HTTPS: without it the password travels in clear text. Open the project switcher and choose
**Sign out** to drop the cookie on that device.

The cookie holds a signed, time-limited token; nothing is stored on the server, so a restart keeps you signed
in. The signing key is derived (scrypt) from `APP_PASSWORD`, salted with `SESSION_SECRET` when that is set.
Changing either value signs every device out, which is also how you revoke a cookie you think has leaked.
`SESSION_SECRET` is optional: with a long random value (`openssl rand -hex 32`) a stolen cookie cannot be used to
guess the password offline, so set it when the password is short.

Login attempts are rate-limited in memory: after 5 wrong passwords within a minute an address gets
`429 Too Many Requests` with a `Retry-After` header until the minute is up. Behind a reverse proxy every
attempt comes from the proxy's address, so the limit is effectively one for all clients, which is fine for one
user. The counters reset when the server restarts.

## API

All endpoints are under `/api` and speak JSON.

| Method   | Path                                 | Purpose                                   |
| -------- | ------------------------------------ | ----------------------------------------- |
| `GET`    | `/session`                           | `{ protected, authenticated }` for this browser |
| `POST`   | `/login`                             | `{ password }`; sets the session cookie   |
| `POST`   | `/logout`                            | Clears the session cookie                 |
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
  auth.ts                 optional password: session cookie, login/logout, rate limit
  routes.ts               /api routes and request validation
  repo.ts                 SQL queries
  db.ts                   schema and connection
src/
  App.tsx                 state wiring, dialogs, view switching
  store.ts                local state + server sync hook
  session.ts              asks the server whether a password is needed; reacts to 401s
  sync.ts                 ordered request queue with merged edits
  api.ts                  fetch helpers for /api
  lib/dates.ts            deadline and "in work" formatting
  lib/sample.ts           sample projects and tasks for an empty install
  components/             TopBar, ProjectMenu, TaskList, AllProjectsBoard,
                          TaskCard, TaskDialog, NewTaskDialog, ProjectDialog, LoginScreen
  styles.css              design tokens and all styling
```
