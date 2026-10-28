# Deploy SmartCampus on Vercel

The root `vercel.json` builds the Vite frontend and serves the Express API as a
Vercel Function. The API and frontend share the same Vercel origin.

## Important platform limits

- Vercel hosts the frontend and API, but it does not host this project's MySQL
  database. Keep the existing managed MySQL database or provision one with a
  database provider. It must accept secure connections from Vercel.
- The backend currently saves uploaded materials and submissions to local disk.
  Vercel function storage is temporary and can differ between invocations.
  Attachments therefore are not persistent in this deployment until the backend
  is migrated to durable object storage. Do not rely on Vercel's `/tmp` for
  production files.
- Vercel's function request-size limit is lower than the local upload limit.
  Uploads are capped at 4 MB on Vercel. Use direct-to-object-storage uploads for
  larger files after an object-storage adapter is integrated.

## 1. Prepare the database

Use the existing MySQL database if it is reachable from Vercel. Do not delete
or migrate the database just because the API is moving. Obtain its host, port,
database name, username, and password from the database provider. Use TLS
(`DB_SSL=true`) and a small connection pool (`DB_POOL_MAX=2`) for serverless
instances. If the provider uses an IP allowlist, configure it for the Vercel
deployment or use a database connection option supported by that provider.

Vercel initializes the database on the first API invocation in each function
instance, then runs the existing migrations and Sequelize sync. Allow the first
API request after a deploy to take longer than later requests.

## 2. Import the repository into Vercel

1. Push the repository to GitHub if it is not already there.
2. In the [Vercel dashboard](https://vercel.com/dashboard), select **Add New →
   Project** and import the repository.
3. Keep the **Root Directory** as the repository root (`.`), not `frontend` or
   `backend`. The root `vercel.json` contains the combined frontend/API setup.
4. Leave the build settings controlled by `vercel.json`. It installs the
   backend and frontend dependencies, builds the frontend, and publishes
   `frontend/dist`.
5. Add the environment variables below before deploying, then select **Deploy**.

## 3. Configure project environment variables

Add these in **Project → Settings → Environment Variables**. Use **Production**
for the live site; add **Preview** too if preview deployments should connect to
the same services.

| Variable | Value |
|---|---|
| `DB_HOST` | Managed MySQL host |
| `DB_PORT` | Managed MySQL port, usually `3306` |
| `DB_NAME` | MySQL database name |
| `DB_USER` | MySQL user |
| `DB_PASSWORD` | MySQL password |
| `DB_SSL` | `true` when the provider requires TLS |
| `DB_POOL_MAX` | `2` |
| `JWT_SECRET` | Random secret of at least 32 characters |
| `GOOGLE_CLIENT_ID` | Google OAuth Web client ID |
| `VITE_GOOGLE_CLIENT_ID` | Same public Google OAuth Web client ID for the browser sign-in button |
| `CLIENT_URL` | Exact production origin, e.g. `https://your-project.vercel.app` |
| `ANTHROPIC_API_KEY` | Optional; only needed for the AI assistant |
| `PASSWORD_RESET_DELIVERY_URL` | Optional HTTPS password-reset delivery endpoint |
| `PASSWORD_RESET_DELIVERY_SECRET` | Optional shared secret, at least 32 characters |
| `PASSWORD_RESET_PAGE_URL` | Optional HTTPS login page URL for reset links |

`PORT` is managed by Vercel and is not required. Do not set `VITE_API_URL` for
this same-origin deployment. Redeploy after changing frontend environment
variables because Vite embeds them at build time.

Do not put `.env` files, database credentials, JWT secrets, or API keys in Git.
`VITE_*` values are included in browser code and must never contain secrets.

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

The API Function has a 60-second maximum duration configured to accommodate
database initialization and external identity verification.

## 6. Before using course files in production

The current upload/download code uses local filesystem paths. Configure a
private, durable object store and migrate the backend upload, download, and
delete paths to use it before relying on course materials, assignment files, or
student submissions. Merely creating a Vercel Blob store or setting a storage
environment variable does not migrate the existing filesystem implementation.
