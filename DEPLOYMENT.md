# Deploy SmartCampus on Vercel

The root `vercel.json` deploys the Vite frontend and Express API as two Vercel
Services. Both are public on the same origin: the API is routed under `/api/*`
and all other paths go to the frontend. The frontend calls the API through
same-origin `/api` URLs, so no service binding is needed.

## Important platform limits

- Vercel hosts the frontend and API, but it does not host this project's
  PostgreSQL database. Use Supabase PostgreSQL and configure the backend
  connection variables below.
- Course materials, assignment files, submissions, and quiz-import documents
  upload directly to a private Supabase Storage bucket. Files are limited to
  20 MB each (chat media remains limited to 5 MB). Do not rely on Vercel's
  temporary filesystem for persistent files.
- Direct browser-to-storage uploads avoid Vercel's function request-size limit;
  only a small, authenticated upload authorization request and file metadata go
  through the API. Downloads still pass through the API's access checks before
  a short-lived private download link is issued.

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
instances. The API does not run database migrations or schema changes during
normal requests. Apply schema changes once as a controlled deployment step
with `npm run migrate:deploy`; back up the production database first. A
database user with the required schema/table privileges is needed for this
step.

## 2. Configure private Supabase Storage

In the same Supabase project, create a **private** Storage bucket named
`smartcampus-files`. Set its maximum file size to **20 MB** and allow the
following MIME types: `application/pdf`, `application/msword`,
`application/vnd.openxmlformats-officedocument.wordprocessingml.document`,
`application/vnd.ms-powerpoint`,
`application/vnd.openxmlformats-officedocument.presentationml.presentation`,
`application/vnd.ms-excel`,
`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`,
`text/plain`, `text/csv`, `application/zip`, `application/octet-stream`,
`image/jpeg`, `image/png`, `image/gif`, `image/webp`, `audio/webm`,
`audio/mp4`, `audio/ogg`, `audio/mpeg`, and `audio/wav`.

The backend issues per-file signed upload grants only after checking the
authenticated user's course role and permissions. It validates uploaded
material contents before attaching them to a course or submission. Keep the
bucket private; the browser receives only the short-lived upload grant, never
the service-role key. Existing local-disk files are not moved automatically;
upload them again through the application if they still need to be retained.

## 3. Import the repository into Vercel

1. Push the repository to GitHub if it is not already there.
2. In the [Vercel dashboard](https://vercel.com/dashboard), select **Add New →
   Project** and import the repository.
3. Keep the **Root Directory** as the repository root (`.`), not `frontend` or
   `backend`. The root `vercel.json` contains the combined frontend/API setup.
4. Leave the build settings controlled by `vercel.json`. Vercel builds each
   service from its own directory; the frontend publishes its `dist` output.
5. Add the environment variables below before deploying, then select **Deploy**.

## 4. Configure project environment variables

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
| `CLIENT_URL` | Comma-separated frontend origins, e.g. `https://your-project.vercel.app` |
| `SUPABASE_JWT_SECRET` | Backend-only Supabase JWT signing secret; required for chat Realtime tokens |
| `SUPABASE_URL` | Supabase project URL for backend Storage access |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend-only Supabase service-role key for signed uploads, private downloads, and file cleanup |
| `SUPABASE_STORAGE_BUCKET` | Private Storage bucket name; use `smartcampus-files` |
| `VITE_SUPABASE_URL` | Public Supabase project URL for browser chat Realtime |
| `VITE_SUPABASE_ANON_KEY` | Public Supabase anon/publishable key for browser chat Realtime |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Optional SMTP delivery for feedback and collaboration emails |
| `FEEDBACK_RECIPIENT_EMAIL`, `COLLABORATION_RECIPIENT_EMAIL` | Optional destinations for those emails |
| `OPENAI_API_KEY` | Optional; only needed for the AI assistant |
| `VITE_ENABLE_AI_ASSISTANT` | Set to `true` to show the AI assistant button; leave `false` until `OPENAI_API_KEY` is configured |
| `TENOR_API_KEY` | Optional; only needed for chat GIF/sticker search |

`PORT` is managed by Vercel and is not required. Do not set `VITE_API_URL` for
this same-origin deployment. Redeploy after changing frontend environment
variables because Vite embeds them at build time. Google sign-in reads its
public client ID from the backend configuration, so `VITE_GOOGLE_CLIENT_ID` is
optional; set it only if you want to configure the browser button directly.

If the frontend calls a separately hosted backend, set `CLIENT_URL` in the
backend environment to the exact frontend origin (scheme and hostname, with no
path or trailing slash). Multiple origins can be comma-separated. Add each
frontend preview origin to the Preview environment as needed, then redeploy the
backend. Do not use `*` for credentialed CORS requests.

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

`SUPABASE_URL` and `VITE_SUPABASE_URL` must refer to the same Supabase project.
The backend service-role key must never use a `VITE_` prefix. `VITE_SUPABASE_ANON_KEY`
is public and is used by the browser to complete signed uploads; it cannot grant
access to objects without a backend-issued upload grant.

## 5. Finish Google sign-in configuration

In Google Cloud Console, open the OAuth Web client and add the Vercel site's
origin to **Authorized JavaScript origins** (for example,
`https://your-project.vercel.app`). Add any custom domain you use as a separate
origin. The origin must not include a path or trailing slash.

Set `GOOGLE_CLIENT_ID` in the backend environment and redeploy after changing
Vercel environment variables. If `VITE_GOOGLE_CLIENT_ID` is also set, it must
match the backend value.

## 6. Verify the deployment

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

6. Test uploading a course material larger than 4 MB but no larger than 20 MB,
   then download it as an enrolled student and verify that an unauthorized
   account cannot access it.

## 7. Storage behavior

The PostgreSQL database is hosted by Supabase, not by Vercel. Uploaded files are
stored in the private Supabase bucket; records remain in PostgreSQL. Quiz
document extraction and chat media are also staged in Storage to bypass the
Vercel request-size limit. The backend removes those temporary objects after
processing. Course materials, assignment files, and submissions remain in
Storage until their owning records are deleted.

## 8. Supabase Free storage protection

SmartCampus keeps Supabase Storage as its file provider. The application
enforces an **800 MB project-wide safety ceiling** for objects in Supabase
Storage, leaving a buffer below the Supabase Free plan's published 1 GB storage
allowance. The ceiling is not a promise that the entire Supabase organisation
will remain within its free allowance: other projects in the same organisation
can also consume quota. Review the Supabase organisation's usage page regularly.

The quota check reads object sizes across **all buckets in this Supabase
project**, then adds reserved capacity for signed uploads that have not arrived
in Storage yet. Each unfinished upload grant temporarily reserves up to the
bucket's 20 MB maximum, even when the browser declares a smaller file. The
backend verifies the actual uploaded byte count against the declared size
before accepting the file. Concurrent reservations are serialized in
PostgreSQL to avoid simultaneous uploads consuming the same remaining
capacity. Uploads fail closed if the quota or any existing object's size cannot
be verified.

The authenticated `GET /api/storage/usage` endpoint powers **Settings →
Storage usage**. It shows project usage, pending upload reservations, remaining
capacity, and the current user's files in the SmartCampus bucket. It also
records downloads for files registered by the quota system.

Pending signed uploads expire after 24 hours. SmartCampus removes expired
staging objects when a user opens the storage-usage screen or requests another
signed upload; cleanup is incremental and processes up to 10 expired uploads
per request. This is request-triggered cleanup, not a separate always-running
scheduled job.

Before deploying this feature to an existing production database:

1. Back up the Supabase PostgreSQL database.
2. Run the controlled production migration from a trusted machine or CI
   environment:
   `cd backend && npm ci && npm run migrate:deploy`.
3. Deploy the matching application revision.
4. Sign in and open **Settings → Storage usage**. Confirm that it can read
   project usage, then test a small upload and download with an authorised
   account. Verify an unauthorised account is denied access.

The `StorageUploadReservations` table is used for quota reservations and
download counts. Keep the `smartcampus-files` bucket private and keep the
Supabase service-role key backend-only.
