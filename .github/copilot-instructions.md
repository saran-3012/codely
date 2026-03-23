# Codely — Copilot Workspace Instructions

Codely is a self-hosted, multi-user online code execution platform with a permission-based admin panel.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js 20, TypeScript, Express 4 |
| Database | PostgreSQL 16 via Prisma 5 ORM |
| Auth | JWT access tokens (in-memory) + httpOnly refresh cookie (7d) |
| Code execution | Self-hosted Piston; falls back to sandboxed local execution |
| Frontend | React 18, Vite, Tailwind CSS — npm workspaces monorepo |
| Serving | nginx on port 80 — routes by path prefix |
| Deployment | Docker Compose (single host, Oracle Cloud free VM) |

---

## Repository Layout

```
backend/                     Express API
  prisma/schema.prisma        Prisma schema (User, RefreshToken, AccessLog, AppLog)
  src/
    config/                   keys.ts + app.config.json + .env loader
    lib/acl/                  permissions.ts, roles.ts (RBAC)
    lib/errors.ts             Typed error classes
    lib/logger.ts             Fire-and-forget AppLog writer
    lib/logCleanup.ts         5-min scheduler (1h access retention, 1d app retention)
    middleware/
      auth.ts                 JWT validation → req.userId
      requirePermission.ts    ACL gate — reads role from DB
      accessLog.ts            Records every request to AccessLog on res.finish
    routes/
      auth.ts                 /api/v1/auth/*
      execute.ts              /api/v1/execute
      logs.ts                 /api/v1/logs/access  /api/v1/logs/app
      users.ts                /api/v1/users

frontend/
  packages/ui/                @codely/ui — ToastProvider, ErrorBoundary, useApiCall, error helpers
  apps/studio/                Code editor SPA  (base /studio/, dev port 5173)
  apps/admin/                 Admin dashboard  (base /admin/,  dev port 5174)
  nginx.conf.template         nginx config — BACKEND_URL substituted at container start

docker-compose.yml            db, piston, piston-installer, backend, frontend
.github/workflows/
  sync-codespaces-branch.yml  Keeps release_master__github_codespaces in sync with master
```

---

## API Routes

| Method | Path | Auth | Permission |
|---|---|---|---|
| POST | `/api/v1/auth/register` | — | — |
| POST | `/api/v1/auth/login` | — (rate limited) | — |
| POST | `/api/v1/auth/refresh` | cookie | — |
| POST | `/api/v1/auth/logout` | — | — |
| GET | `/api/v1/auth/me` | Bearer | — |
| POST | `/api/v1/execute` | Bearer | `code:execute` |
| GET | `/api/v1/logs/access` | Bearer | `logs:access:read` |
| GET | `/api/v1/logs/app` | Bearer | `logs:app:read` |
| GET | `/api/v1/users` | Bearer | `users:read` |
| PATCH | `/api/v1/users/:id/role` | Bearer | `users:update:role` |

---

## RBAC / ACL

Routes declare **permissions**, never roles. Role → permission mapping lives entirely in `backend/src/lib/acl/roles.ts`.

| Permission | USER | ADMIN |
|---|---|---|
| `code:execute` | ✓ | ✓ |
| `profile:read:own` | ✓ | ✓ |
| `profile:update:own` | ✓ | ✓ |
| `users:read` | — | ✓ |
| `users:update:role` | — | ✓ |
| `logs:access:read` | — | ✓ |
| `logs:app:read` | — | ✓ |

Adding a new role = add one entry in `roles.ts`. No route changes needed.

---

## Config System

Three-layer merge (lowest → highest priority):

1. `backend/src/config/app.config.json` — non-sensitive tunables (`FRONTEND_URL`, rate-limit, exec timeout)
2. `.env` / `process.env` — secrets and environment-specific values
3. `backend/src/config/keys.ts` defaults — fallbacks for optional keys

Sensitive keys (`DATABASE_URL`, `JWT_SECRET`, `REFRESH_TOKEN_SECRET`) must **never** be in `app.config.json` — startup throws if they appear there.

Access values via `CONFIG.KEY_NAME.getStringValue()` / `.getIntegerValue()`.

---

## Error Classes (`backend/src/lib/errors.ts`)

| Class | HTTP |
|---|---|
| `ValidationError` | 400 |
| `AuthError` | 401 |
| `ForbiddenError` | 403 |
| `NotFoundError` | 404 |
| `ConflictError` | 409 |

All serialise to `{ code, message }` via the global error handler. Use `asyncHandler` to wrap route handlers so thrown errors propagate correctly.

---

## Code Execution Flow

```
POST /api/v1/execute
  └─ PISTON_URL set?
       ├─ Yes → POST piston:2000/api/v2/execute
       │          ├─ Success → respond
       │          ├─ HTTP error → throw AppError (don't fall back)
       │          └─ Network error → fall through ↓
       └─ Local sandboxed fallback (Linux ulimits)
            - Stripped env (no secrets)
            - HOME → isolated tmpdir
            - Virtual memory: 256 MB
            - File writes: 10 MB
            - CPU time: EXEC_TIMEOUT_MS / 1000 sec
            - Max processes: 32
            - Max file descriptors: 64
            - Output cap: 100 KB
```

---

## Frontend Architecture

### Shared Package — `@codely/ui`

Imported by both apps via path alias. Exports:
- `ToastProvider`, `useToast` — toast notifications
- `ErrorBoundary` — React error boundary
- `useApiCall(fn, opts)` — manages loading/error state, fires error toasts
- `getApiError`, `getApiMessage`, `ApiErrorBody` — axios error parsing

### `apps/studio` — Code Editor

- `BrowserRouter basename="/studio"` → routes: `/login`, `/register`, `/` (EditorPage)
- Access token stored in memory (`api.ts` module variable)
- On 401: refreshes via cookie → retries → on failure redirects to `/studio/login`

### `apps/admin` — Admin Dashboard

- `BrowserRouter basename="/admin"` → routes: `/login`, `/logs`
- Separate `adminApi` instance — same refresh pattern, redirects to `/admin/login`
- `AdminAuthContext` verifies `user.role === 'ADMIN'` after login; non-admins get session revoked immediately
- `LogsPage`: two tabs (Access Logs / App Logs), filters, pagination (50/page), auto-refresh 30s

---

## nginx Path Routing (production)

| Path | Destination |
|---|---|
| `/api/*` | Proxy → `${BACKEND_URL}/api/` |
| `/studio*` | Static SPA from `/usr/share/nginx/html/studio/`, fallback to `studio/index.html` |
| `/admin*` | Static SPA from `/usr/share/nginx/html/admin/`, fallback to `admin/index.html` |
| `= /` | `302` → `/studio/` |

`BACKEND_URL` is injected at container start via nginx envsubst (default: `http://backend:3000`). For external deployment set it to the backend's public URL.

---

## Key Environment Variables

| Variable | Source | Purpose |
|---|---|---|
| `JWT_SECRET` | `.env` required | Signs access tokens |
| `REFRESH_TOKEN_SECRET` | `.env` required | Signs refresh tokens |
| `DATABASE_URL` | `.env` required | Prisma connection string |
| `PISTON_URL` | `.env` | Piston API URL; unset = local sandbox fallback |
| `BACKEND_URL` | nginx container env | Where nginx proxies `/api/` |
| `FRONTEND_URL` | `app.config.json` | Comma-separated CORS origins |
| `EXEC_TIMEOUT_MS` | `app.config.json` | Code execution timeout (default 10000) |
| `RATE_LIMIT_MAX` | `app.config.json` | Login attempts per window (default 10) |
| `RATE_LIMIT_WINDOW_MS` | `app.config.json` | Rate limit window ms (default 900000) |

---

## Commit Convention

Format: `[TYPE] Short description`

| Type | Used for |
|---|---|
| `[FEATURE]` | New user-facing functionality |
| `[ENHANCEMENT]` | Improvements to existing functionality |
| `[FIX]` | Bug fixes |
| `[CHORE]` | Tooling, config, CI, housekeeping |

---

## Branch Strategy

| Branch | Purpose |
|---|---|
| `master` | Source of truth — all development commits go here |
| `release_master__github_codespaces` | Always = master + `.devcontainer/devcontainer.json` overlay; updated automatically by GitHub Actions on every master push; protected (only `github-actions[bot]` can force-push) |

Never commit `.devcontainer/` to master. The workflow recreates it from scratch each sync.
