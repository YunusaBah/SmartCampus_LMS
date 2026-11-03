# Deploy SmartCampus on Vercel

The root `vercel.json` deploys the Vite frontend and Express API as two Vercel
Services. Both are public on the same origin: the API is routed under `/api/*`
and all other paths go to the frontend. The frontend calls the API through
same-origin `/api` URLs, so no service binding is needed.

## Important platform limits

- Vercel hosts the frontend and API, but it does not host this project's
  PostgreSQL database. Use Supabase PostgreSQL and configure the backend
  connection variables below.
- The backend currently saves uploaded materials and submissions to local disk.
  Vercel function storage is temporary and can differ between invocations.
  Attachments therefore are not persistent in this deployment until the backend
  is migrated to durable object storage. Do not rely on Vercel's `/tmp` for
  production files.
- Vercel's function request-size limit is lower than the local upload limit.
  Uploads are capped at 4 MB on Vercel. Use direct-to-object-storage uploads for
  larger files after an object-storage adapter is integrated.

## 1. Prepare Supabase PostgreSQL

Create or select a Supabase project, then open **Project Settings → Database**
and copy its PostgreSQL connection URI. Use the Supabase session pooler URI if
Vercel cannot reach the direct database host. The URI includes a database
password; keep it private and URL-encode special characters in the password.
The backend uses Sequelize for every existing `/api/*` route, so the existing
accounts, courses, lessons, assignments, quizzes, grades, announcements,
feedback, chat, and other API data all use this PostgreSQL database. No
duplicate Supabase REST routes are needed.

Use `DB_SSL=true` and a small connection pool (`DB_POOL_MAX=2`) for serverless
instances. The backend applies its additive migrations and creates missing
tables at startup; do not manually create application tables or use
`sequelize.sync({ alter: true })`. A database user with schema/table creation
and migration privileges is required for the initial deployment.

Vercel initializes the database on the first API invocation in each backend
instance, then runs the existing migrations and Sequelize sync. Allow the first
API request after a deploy to take longer than later requests.

## 2. Import the repository into Vercel

1. Push the repository to GitHub if it is not already there.
2. In the [Vercel dashboard](https://vercel.com/dashboard), select **Add New →
   Project** and import the repository.
3. Keep the **Root Directory** as the repository root (`.`), not `frontend` or
   `backend`. The root `vercel.json` contains the combined frontend/API setup.
4. Leave the build settings controlled by `vercel.json`. Vercel builds each
   service from its own directory; the frontend publishes its `dist` output.
5. Add the environment variables below before deploying, then select **Deploy**.

## 3. Configure project environment variables

Add these in **Project → Settings → Environment Variables**. Use **Production**
for the live site; add **Preview** too if preview deployments should connect to
the same services.

| Variable | Value |
|---|---|
| `DB_DIALECT` | `postgres` |
| `DATABASE_URL` | Supabase PostgreSQL connection URI from Project Settings → Database |
| `DB_SSL` | `true` |
| `DB_POOL_MAX` | `2` for serverless functions |
| `JWT_SECRET` | Random secret of at least 32 characters |
| `GOOGLE_CLIENT_ID` | Google OAuth Web client ID |
| `VITE_GOOGLE_CLIENT_ID` | Same public Google OAuth Web client ID for the browser sign-in button |
| `CLIENT_URL` | Exact production origin, e.g. `https://your-project.vercel.app` |
| `SUPABASE_JWT_SECRET` | Backend-only Supabase JWT signing secret; required for chat Realtime tokens |
| `VITE_SUPABASE_URL` | Public Supabase project URL for browser chat Realtime |
| `VITE_SUPABASE_ANON_KEY` | Public Supabase anon/publishable key for browser chat Realtime |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Optional SMTP delivery for feedback and collaboration emails |
| `FEEDBACK_RECIPIENT_EMAIL`, `COLLABORATION_RECIPIENT_EMAIL` | Optional destinations for those emails |
| `OPENAI_API_KEY` | Optional; only needed for the AI assistant |
| `TENOR_API_KEY` | Optional; only needed for chat GIF/sticker search |

`PORT` is managed by Vercel and is not required. Do not set `VITE_API_URL` for
this same-origin deployment. Redeploy after changing frontend environment
variables because Vite embeds them at build time.

Do not put `.env` files, database credentials, JWT secrets, or API keys in Git.
`VITE_*` values are included in browser code: only the Supabase anon/publishable
key and other explicitly public values belong there. Never expose the database
password, service-role key, or `SUPABASE_JWT_SECRET` to the frontend.

Supabase Realtime chat also requires the Supabase Auth schema. The backend
configures chat row-level security and adds the chat messages table to the
Realtime publication during initialization. Set `SUPABASE_JWT_SECRET` from the
Supabase project's JWT signing configuration; this is separate from the anon
key. If Realtime is unavailable, the chat API retains its authenticated
server-sent-events fallback.

## 4. Finish Google sign-in configuration

In Google Cloud Console, open the OAuth Web client and add the Vercel site's
origin to **Authorized JavaScript origins** (for example,
`https://your-project.vercel.app`). Add any custom domain you use as a separate
origin. The origin must not include a path or trailing slash.

The `GOOGLE_CLIENT_ID` backend value and `VITE_GOOGLE_CLIENT_ID` frontend value
must match. Redeploy after setting or changing Vercel environment variables.

## 5. Verify the deployment

After deployment:

1. Open `https://your-project.vercel.app/`; the SmartCampus login page should
   load.
2. Open `https://your-project.vercel.app/api/health/live`; the API should return
   `{"status":"ok"}`.
3. Open `https://your-project.vercel.app/api/health`; it should return
   `{"status":"ok","database":"connected"}`.
4. Test Google sign-in and password sign-in with test accounts.
5. Review **Vercel → Project → Functions → Logs** if an API request fails.

The backend service has a 60-second maximum function duration configured to
accommodate database initialization and external identity verification.

## 6. Before using course files in production

The current upload/download code uses local filesystem paths. Configure a
private, durable object store and migrate the backend upload, download, and
delete paths to use it before relying on course materials, assignment files, or
student submissions. Merely creating a Vercel Blob store or setting a storage
environment variable does not migrate the existing filesystem implementation.
