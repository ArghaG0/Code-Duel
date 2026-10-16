# CodeDuel

CodeDuel is a browser-based, one-on-one coding duel application for programmers who want to practice solving problems against another player. A React client provides accounts, matchmaking, a JavaScript editor, and custom rooms; an Express/Socket.IO server coordinates matches, stores data in MongoDB, and executes JavaScript in isolated-vm V8 isolates. Ranked progression and some custom-match rules have implementation gaps documented below.

## Features

- Registration and login with hashed passwords and JWT authentication; username editing and the latest 20 matches on the account page.
- Ranked matchmaking that pairs the first two queued sockets, gives both players the same randomly selected problem, and targets five round wins.
- Monaco editor with JavaScript execution, test-case submission results, and an opponent typing/code-structure display.
- Custom problem authoring and saved room templates with up to five rounds, room codes, and optional passwords. Matches start when two players join.
- Public waiting-room browsing and spectator access before a custom match starts; spectators receive players' source code live.
- Browser-side focus and paste-detection rules that can forfeit a match; disconnects also end a player's active match.

## Tech stack

Versions below are the declared package ranges, not a reproducible dependency lock.

| Layer | Technology |
| --- | --- |
| Language | JavaScript; JSX in the client, CommonJS in the server |
| Client | React `^19.1.1`, React Router `^7.9.1`, Vite `^7.1.2` |
| UI | Tailwind CSS `^3.4.17`, Monaco React `^4.7.0`, React Icons |
| HTTP and realtime | Axios, Express `^5.1.0`, Socket.IO/client `^4.8.1` |
| Persistence | MongoDB through Mongoose `^8.18.1` |
| Authentication | bcryptjs `^3.0.2`, jsonwebtoken `^9.0.2` |
| Development | ESLint 9, nodemon, dotenv, PostCSS/Autoprefixer |
| Execution | isolated-vm `5.0.4` in the Node 22 backend |
| External services | DiceBear Bottts SVG avatars on the account page |

## Project structure

```text
.
├── .gitignore                 # Ignores secrets, dependencies, and builds
├── client/
│   ├── package.json           # Dev, build, lint, and preview scripts
│   ├── vite.config.js         # /api proxy to localhost:5000
│   ├── eslint.config.js       # Client lint rules
│   ├── tailwind.config.js
│   ├── public/                # Logo and static assets
│   └── src/
│       ├── main.jsx           # React entry point
│       ├── App.jsx            # Browser routes and socket lifecycle
│       ├── socket.js          # Shared Socket.IO client
│       └── pages/             # Auth, profile, lobby, arena, and custom rooms
└── server/
    ├── package.json           # Start, dev, and database seed scripts
    ├── server.js              # HTTP server, matchmaking, and socket handlers
    ├── routes/                # REST route definitions
    ├── controllers/           # Auth, profile, execution, templates, and history
    ├── middleware/            # Bearer-token authentication
    ├── models/                # User, Problem, CustomProblem, RoomTemplate, Match
    └── scripts/               # Insert-only seed, problem data, and rollback ledger
```

## Architecture overview

```mermaid
flowchart LR
    Browser[React browser client] -->|/api via Vite in development| API[Express REST API]
    Browser <-->|Socket.IO| Realtime[Match and lobby handlers]
    API --> DB[(MongoDB)]
    Realtime --> DB
    Realtime --> Memory[In-memory queues, lobbies, active matches]
    API -->|Code and copied results| Sandbox[In-process V8 isolates]
    Browser -->|Avatar image| DiceBear[DiceBear]
```

Express and Socket.IO share the HTTP server in `server/server.js`. MongoDB stores accounts, standard/custom problems, templates, and completed matches. Queues, active matches, and lobbies exist only in that process and are lost on restart.

The client keeps its JWT in `localStorage` and sends it as a Bearer token for protected HTTP requests. Socket connections do not authenticate that token. After a successful HTTP submission, the browser emits `round_won`; the socket handler does not independently verify the submission.

## Prerequisites

- Node.js 22.x and npm. Server scripts include the required `--no-node-snapshot` flag. The client requires Node 22.12 or newer.
- An accessible MongoDB database. **TODO: confirm** the supported MongoDB version; none is pinned.
- Native addon installation uses prebuilt binaries where available. If unavailable, install Python and C++ build tools (Visual Studio C++ tools on Windows; Python 3, make and g++ on Debian). Docker supplies build tools in a separate stage.
- A browser for the client, with separate browser profiles or devices for two-player testing.

## Installation and setup

There is no root package or workspace runner. From the repository root, install each package separately:

```sh
cd server
npm ci
cd ../client
npm ci
cd ..
```

On Windows PowerShell, if execution policy blocks `npm.ps1`, use `npm.cmd` in place of `npm` in these commands.

Create one `.env` at the repository root with the variables below. It stays gitignored; do not commit credentials. The server and the seed script load it through explicit paths relative to their source files, independently of the working directory. Compose reads the same root file and requires a nonempty `MONGO_URI`. Environment variables already supplied to the process take precedence.

The seed contains 24 original problems (10 Easy, 9 Medium, 5 Hard). From `server/`, preview missing titles with a dry run:

```sh
npm run seed
```

Insert missing titles without changing existing documents:

```sh
npm run seed -- --write
```

Write mode requires the matching private verification report. To remove only records recorded by this seed, run `npm run seed -- --rollback`. See [seed instructions](server/scripts/README.md) for verification requirements and rollback details. Standard matchmaking requires a nonempty problem collection, and round advancement needs a problem other than the current one.

## Environment variables

The root `.env` is the only environment file. Set these names; never commit real credentials.

| Name | Description | Required/optional |
| --- | --- | --- |
| `MONGO_URI` | MongoDB URI shared by local Node, seed scripts and Compose. Include the intended database name; an omitted name defaults to `test`. | Required |
| `JWT_SECRET` | Long random signing secret shared by local and Docker runs. | Required |
| `SANDBOX_MEMORY_MB` | Per-request isolate memory target; default 128 MiB, accepted range 16?512. Not a hard process memory ceiling. | Optional |
| `SANDBOX_TIMEOUT_MS` | Per-test async evaluation budget; default 3000 ms, accepted range 1?10000. | Optional |
| `NODE_OPTIONS` | Set `--no-node-snapshot` on Node hosts. Included in Docker; npm start/dev/test also pass the flag explicitly. | Required for direct Node launches |
| `CLIENT_ORIGIN` | Allowed REST and Socket.IO browser origin. Use `http://localhost:8080` for default Docker ports or `http://localhost:5173` for local Vite. | Set to match the browser URL |
| `WEB_PORT` | Published nginx port; defaults to 8080. | Optional, Compose only |
| `BACKEND_PORT` | Published backend debug port on host loopback; defaults to 5000. | Optional, Compose only |
| `PORT` | Local backend listening port; defaults to 5000. Compose fixes the container port at 5000. | Optional |

Local Vite API proxy and socket connections target backend port 5000. Production sockets use the browser origin through nginx. Changing a host port requires updating `CLIENT_ORIGIN` to match the frontend URL.

## Usage / running the project

Start the backend in one terminal, from the repository root:

```sh
cd server
npm run dev
```

Start the frontend in a second terminal, from the repository root:

```sh
cd client
npm run dev
```

Use `http://localhost:5173` with the default development setup and set `CLIENT_ORIGIN=http://localhost:5173` in the root `.env`. The Vite `/api` proxy forwards HTTP requests to `http://localhost:5000`; sockets connect directly to that backend.

Register at `/register`, then use `/lobby` to queue with a second user. Use `/custom/create` to author problems and templates, and `/custom` to browse or join rooms by code. A spectator must join while the room is waiting, before the second player starts the match. `/account` supports username editing and match history; `/battle` expects match data supplied by navigation from matchmaking.

During a battle, switching tabs or losing window focus triggers a forfeit. Large/rapid editor insertions also trigger a forfeit, so pasting solutions or using two tabs in one browser is unsuitable for normal match testing.

For custom test cases, `input` is a string containing JavaScript call arguments, and `output` must match the exact `JSON.stringify` result. For example, Two Sum uses input `[2,7,11,15], 9` and output `[0,1]`. The harness extracts a named `function` declaration from `starterCode`, falling back to `solution`, and calls it with those arguments. Each test case uses a fresh context within one request-owned isolate. The host serializes the copied return value with JSON.stringify; console text cannot provide the judged result.

## API and realtime reference

All HTTP paths below are relative to the backend origin. Request bodies are JSON. Protected routes require `Authorization: Bearer <token>`.

| Method | Path | Auth | Request / behavior |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | No | `username`, `email`, `password`; returns user identifiers and a token. |
| POST | `/api/auth/login` | No | `email`, `password`; returns user identifiers and a token. |
| GET | `/api/auth/me` | Yes | Returns the current user without the password field. |
| PUT | `/api/users/profile` | Yes | Updates `username`; returns `_id`, `username`, `email`. |
| POST | `/api/code/execute` | Yes | `code`, `language`; returns `output`. Only JavaScript is accepted. console.log/error output is capped; execution errors are appended as safe messages. |
| POST | `/api/code/submit` | Yes | `code`, `language`, `problemId`; returns `success` and test `results` containing `id`, `passed`, `input`, `expected`, `actual`. |
| POST | `/api/custom/problem` | Yes | Creates a problem with `title`, `description`, `starterCode`, `testCases` (`input`/`output` strings). |
| GET | `/api/custom/problems` | Yes | Lists the current user's custom problems. |
| POST | `/api/custom/template` | Yes | Creates a template from `name`, `password`, `rounds`, `timeLimit`, `problemIds`. |
| GET | `/api/custom/templates` | Yes | Lists the current user's templates with populated problems. |
| PUT | `/api/custom/template/:id` | Yes | Replaces the above template fields; requires ownership. |
| DELETE | `/api/custom/template/:id` | Yes | Deletes an owned template. |
| GET | `/api/matches/history` | Yes | Returns the user's latest 20 matches, newest first. |

The arena sends only `javascript`; the submission harness is JavaScript-specific despite the API accepting a `language` field.

Client-to-server Socket.IO events, as implemented in `server/server.js`:

| Event | Payload / behavior |
| --- | --- |
| `find_match` | `{ userId, username, rank }`; joins the FIFO queue. |
| `get_rooms` | No payload; broadcasts the public waiting-room list. |
| `create_custom_room` | `{ templateId, isPublic, name, userData }`; `userData` contains `userId`, `username`, optional `rank`. Without a template, selects a standard problem. |
| `join_custom_room` | `{ roomId, password, role, userData }`; role is `player` or `spectator`. |
| `join_match_room` | Room ID string; subscribes the socket to match broadcasts. |
| `round_won` | Room ID string; advances the score/round or ends the match. |
| `forfeit_match` | Room ID string; ends the match as a disqualification. |
| `code_progress` | `{ roomId, structure, isTyping, code }`; forwards structure to the opponent and source to spectators. |
| `leave_room` | No payload; removes queue/lobby participation, deleting a hosted lobby. |

Server events are `rooms_update`, `custom_room_created`, `error_joining_room`, `lobby_update`, `match_found`, `round_update`, `match_over`, `opponent_progress`, and `spectator_feed`. Disconnect cleanup also removes queued/lobby participants and awards an active opponent the match.

## Testing

Private tests live in gitignored test/. With those files available, run npm test --prefix server. Sandbox regression tests use the real native addon and mock database calls; node --no-node-snapshot test/server/problem-set/verify.cjs rechecks all reference solutions. No CI workflow is committed. The client lint check is:

```sh
cd client
npm run lint
```

The documentation audit ran this check: it failed with three unused-variable errors (`err` in `CustomRoomDashboard.jsx` and `RoomBrowserPage.jsx`, and `lobbyCounts` in `LobbyPage.jsx`) and one missing-effect-dependency warning in `CustomRoomDashboard.jsx`.

Manual smoke checks should cover registration/login, username changes, a two-user ranked match, custom-room creation/joining, a spectator joining before match start, execution/submission, and match history. These flows were inspected in code but were not exercised against MongoDB or the execution sandbox during the documentation audit. Build and service startup commands were checked against package scripts, not executed.

## Deployment

With Docker Desktop running Linux containers, create the root `.env` using the variable table above, set a real `JWT_SECRET`, and run from the repository root:

```powershell
docker compose up --build
```

Open `http://localhost:8080`. The backend is exposed on `127.0.0.1:5000` for debugging. Default mode uses Atlas through `MONGO_URI` and starts client and server. Allow the backend machine's outbound IP in Atlas Network Access and provide a database user with access to the intended database. The root environment file is outside both build contexts and is never copied into an image.

For optional local MongoDB 8, set `MONGO_URI=mongodb://mongo:27017/codeduel` in root `.env`, then run:

```powershell
docker compose --profile localdb up --build
```

The optional service uses `mongo_data`, is not published to the host, and runs with `--quiet` and a 30-second healthcheck. Volume declarations cannot have profiles; only the optional Mongo service uses this volume. Restore the Atlas `MONGO_URI` to switch back, and use `docker compose --profile localdb down` before changing modes to remove any previously running local container.

All healthchecks run every 30 seconds. Nginx omits access logs only for `/healthz`; ordinary access and error logs remain enabled. The backend healthcheck uses TCP and produces no HTTP request logs. Its healthcheck confirms a listening socket, not database connectivity; check the separate MongoDB connection message.

From `server/`, run `npm run seed` for a dry run and `npm run seed -- --write` to insert missing titles. Both use the configured database, including Atlas. Docker supports the read-only preview with `docker compose exec server npm run seed`; write mode requires the private verification report, which is deliberately excluded from images, so perform verified seeding locally. Existing records are never overwritten by seeding.

Stop while retaining database data:

```powershell
docker compose down
```

To delete the database volume as well (destructive):

```powershell
docker compose down -v
```

Both package lockfiles must be present for the Dockerfiles' `npm ci` steps. The frontend uses a Node 20 build stage and nginx with SPA, API, and WebSocket routing. The backend runs as the unprivileged Node user. Execution is part of the backend process, without a privileged service or execution port. A new local database needs problem data before matchmaking works. The current in-memory match state assumes one backend process.

## In-process JavaScript execution

Use Node 22.x. The Docker backend uses a Debian slim build with Python/make/g++ available only in the dependency stage; the final image runs as the non-root node user. User code runs in that Node version's V8 engine, with JavaScript globals but no Node APIs, timers, network, filesystem, process or require. It is no longer pinned to Node 18.15.0.

From the repository root:

```powershell
npm run dev --prefix server
docker compose up --build -d
```

Choose local Node or Docker; these are alternative ways to start the backend. There is no root npm run server script. No runtime download or package-install API is needed. Stop Compose with docker compose down (without -v to preserve database data).

For Render or another persistent Node host, set the service root to server, build with npm ci, start with npm start, and select Node 22.x. Set NODE_OPTIONS=--no-node-snapshot in the host dashboard along with MONGO_URI, JWT_SECRET and CLIENT_ORIGIN. SANDBOX_MEMORY_MB and SANDBOX_TIMEOUT_MS are optional. On generic hosts the equivalent direct command is:

```sh
node --no-node-snapshot server.js
```

Run still evaluates the editor text only: a function declaration without console calls prints nothing. Submit extracts the first named function from starterCode (fallback solution), evaluates the editor code, then calls the function with each test's argument string. Undefined, functions, non-cloneable or non-JSON-serializable results fail. Runtime, syntax, timeout and memory errors produce safe messages, with no host stack traces. Console output is capped at 10 KiB across a request. Each request disposes its isolate, including on failure.

Existing guards remain: authenticated routes, 50,000 UTF-8 code bytes, JavaScript only, one active request per account, four per process, and 1?20 tests with at most 10,000 UTF-8 bytes each for input and output. A full submission may consume 20 times the per-test timeout; there is no distributed rate limiter or whole-submission deadline.

This is V8-level isolation, not OS-level isolation. CPU and the Node process are shared. The library's memory limit is approximate, and catastrophic V8 failures can still crash the process. Passing memory-bomb tests is not a guarantee against arbitrary attacks. Host-side copying and serialization also consume memory and CPU. Do not treat this as safe public multi-tenant execution: before opening to strangers, put execution in a separate restricted process/container with hard CPU/memory limits, add authenticated rate limits and admission controls, protect match scoring on the server, and keep Node/native dependencies patched. Visible tests can always be hardcoded.

Native addon packaging and WebSocket/shared match-state behavior on Vercel still need deployment validation; this change does not resolve those hosting limitations.

See [isolated-vm requirements and security guidance](https://github.com/laverdet/isolated-vm/tree/v5.0.4).

## Known issues and limitations

- **Ranked persistence is inconsistent with the schema.** `server/server.js` assigns ranks such as Bronze to `User.role`, but `server/models/user.model.js` permits only `user`, `admin`, and `developer`; `stats.rp` is absent from the schema. A ranked result is saved before these user updates, which can fail validation. The account page displays a fixed `BRONZE I` label. Matchmaking does not use rank to select opponents.
- **Match integrity relies on clients.** Socket identities come from user-supplied data; no socket authentication middleware is installed. Round wins are not tied to server-validated submissions, and room subscription/forfeit/progress handlers do not consistently enforce participation. Full problem documents, including test cases, are sent to players.
- **Execution shares the API process.** V8 isolation and per-process concurrency controls do not provide OS resource containment or distributed rate limiting. Catastrophic allocation failures can still affect all requests; see the execution section above.
- **Custom-match outcomes can be wrong.** On the last problem, `round_won` chooses that event's socket as the winner instead of comparing total scores. **TODO: confirm** intended custom-match victory and tie rules.
- **Time limits are not enforced.** Template `timeLimit` is stored but not used by match logic. The arena counts down from 300 seconds without ending the match at zero or resetting the timer each round. **TODO: confirm** intended timer and timeout behavior.
- **Template lifecycle gaps.** The UI collects a template description, but the create/update controllers omit it. Editing a template creates new custom-problem documents; deleting a template does not delete its problems. Room passwords are stored in plaintext, and socket-based template launching does not check template ownership.
- **Browser-only enforcement can misfire or be bypassed.** Focus changes and large/fast edits cause forfeits; these checks are not authoritative server controls. Active-match reconnection/resumption is not implemented.
- **Incomplete UI/integration.** The home page links to `/leaderboard`, but `client/src/App.jsx` has no such route. It advertises Python/C++/Java although the arena and harness use JavaScript. It also opens a second socket and emits `join_room`, which has no server handler. Avatar editing is deferred in a controller comment.
- **Operational gaps.** Database connection failures are logged while the HTTP server still starts. Several socket errors are only logged, and some async handlers lack local error handling. No migrations, health-check endpoint, automated tests, or CI are supplied. Both package lockfiles are available for version control and used by `npm ci`.
