# SmartCampus LMS

React frontend, Express API, and PostgreSQL database. Local development uses
PostgreSQL (managed through pgAdmin); deployment can use Supabase PostgreSQL.

## Local development

Install dependencies from the `backend` and `frontend` folders. Copy
`backend/.env.example` to `backend/.env`, enter your local PostgreSQL connection
settings, then run `npm run dev` from the repository root to start both servers.
Use `Ctrl+C` to stop them.

### Backend

```bash
cd backend
cp .env.example .env   # edit with your local PostgreSQL credentials
npm install
npm start
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 (API runs on http://localhost:5000).

Optional seed data:

```bash
cd backend
npm run seed
```

---

## Deploy on Vercel

The root `vercel.json` deploys the React frontend and Express API as Vercel
Services, routing `/api/*` to the backend and other paths to the frontend. See
**[DEPLOYMENT.md](./DEPLOYMENT.md)** for setup steps and required environment
variables.

Vercel does not host the database. Configure the backend to use your Supabase
PostgreSQL connection as described in **[DEPLOYMENT.md](./DEPLOYMENT.md)**. The
API currently stores uploaded files on local disk; Vercel's filesystem is
temporary, so persistent file storage must be integrated before relying on
course-material and submission uploads.

---

## Environment variables

### Backend (`backend/.env`)

See `backend/.env.example`.

### Frontend

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend base URL (no `/api` suffix) |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth Web client ID for sign-in |
| `VITE_SUPABASE_URL` | Public Supabase project URL, used for chat Realtime |
| `VITE_SUPABASE_ANON_KEY` | Public Supabase anon/publishable key, used for chat Realtime |

Local dev uses `frontend/.env.development` (`http://localhost:5000`). On Vercel,
leave `VITE_API_URL` unset so the frontend uses its same-origin `/api` routes.
Database credentials and `SUPABASE_JWT_SECRET` belong only in the backend
environment; never use a `VITE_` prefix for private keys.
