# Vercel deployment and database operations

## Runtime behaviour

The Vercel Express entrypoint is `backend/src/vercel.js`. It performs a lightweight PostgreSQL connection on demand and caches that connection promise for the lifetime of a warm function instance. It does **not** run schema migrations, `sequelize.sync()`, index creation, or chat RLS policy DDL during requests.

The root `api/[...path].js` compatibility entrypoint delegates to the same canonical entrypoint. The Vercel Services routing in `vercel.json` continues to send `/api/*` to the backend service and other paths to the Vite frontend.

## Required production environment variables

Set these in Vercel Project Settings → Environment Variables for the environments you deploy:

- `DATABASE_URL`: PostgreSQL connection string. Prefer the Supabase pooler/connection string appropriate for serverless workloads.
- `JWT_SECRET`: a randomly generated secret of at least 32 characters. Keep it server-only; never prefix it with `VITE_`.
- Any provider secrets required by enabled backend features (for example AI/email integrations).

The frontend `VITE_*` variables are compiled into public browser assets. Only put public client configuration there (for example the Supabase anon/publishable key); never put database passwords, service-role keys, JWT secrets, or provider API keys in frontend variables.

## Applying database changes

Run schema changes once as a controlled deployment operation, before routing traffic to code that depends on the new schema. Do not execute migrations from serverless request handlers.

From a trusted machine or CI runner, use the production database connection string in the environment and run:

```bash
cd backend
npm ci
npm run migrate:deploy
```

The command connects, applies the repository migrations, performs the existing non-destructive Sequelize model sync used by this project, and installs the chat RLS policies. Run it once per release, not concurrently from multiple deployment jobs. Back up the production database before schema changes. Do not paste production credentials into source files or commit them.

For an existing installation, do not assume that changing the runtime entrypoint automatically applies pending migrations. Run the command explicitly before deploying this revision.

## Health checks

- `/api/health/live` is a process/liveness check and intentionally does not require a database connection.
- `/api/health` is a readiness check and requires a working database connection.

## Operational checks after deployment

1. Check the Vercel deployment build and function logs.
2. Request `/api/health/live`, then `/api/health`.
3. Sign in as a student and lecturer; test a read and write flow for each.
4. Upload and download a permitted course/assignment file, confirming that the object is stored in durable private storage and access is authorized.
5. Check Vercel function duration/CPU and Supabase connection usage after real traffic.

This runbook does not claim that the current production environment has been tested. Validate environment variables and the production database before promoting a deployment.

## Serverless CPU and request-volume controls

SmartCampus uses event-driven chat updates where Realtime is configured. The polling intervals below are fallback checks, not the primary notification mechanism:

- The server chat SSE connection is opened only while the chat panel is open and the browser tab is visible. It is aborted when the panel closes or the tab is backgrounded.
- The browser applies exponential backoff when a chat event stream disconnects, so an immediately closed stream cannot trigger a tight reconnect loop.
- Server-side course-membership refresh for an active SSE connection runs every 60 seconds instead of every 5 seconds.
- The chat-list fallback refresh runs every 60 seconds instead of every 12 seconds and pauses while the page is hidden.
- The private lecturer/student inbox fallback refresh runs every 60 seconds instead of every 10 seconds, skips hidden/offline tabs, and prevents overlapping requests.
- The shared stale-cache refresh fallback runs every 60 seconds instead of every 30 seconds and dispatches refresh events only while the page is visible and online.

These changes reduce repeated database work and unnecessary requests; they do not replace measurement. After the project is re-enabled and serving real traffic, compare the Vercel Usage/Functions metrics over equivalent periods:
1. Function Active CPU time (not just wall-clock duration).
2. Function invocations and function duration.
3. Top function paths and error rate.
4. Supabase database CPU, active connections, and query load.

On the current Hobby connection, runtime logs have only a short retention window; the project API connection used for this review also reports that Observability Plus is not enabled. Therefore no historical CPU total can be honestly reported from this audit. The production deployment currently responds with `402 DEPLOYMENT_DISABLED`, so post-change production CPU and health measurements must wait until Vercel re-enables deployments.

## CI checks

The GitHub Actions workflow `.github/workflows/ci.yml` runs the backend test suite and frontend production build on pushes to `main`/fix branches and on pull requests targeting `main`. It intentionally does not receive production secrets or run database migrations.

