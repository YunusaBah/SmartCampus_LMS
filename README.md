# SmartCampus ICT Learning Platform

Web semester project — React frontend, Express API, MySQL database.

## Local development

Install the dependencies once from the `backend` and `frontend` folders, then
run `npm run dev` from the repository root to start both servers together.
Use `Ctrl+C` to stop them.

### Backend

```bash
cd backend
cp .env.example .env   # edit with your MySQL credentials
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

The root `vercel.json` builds the React frontend and routes `/api/*` to a Vercel
Function running the Express API. See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for
the setup steps and required environment variables.

Vercel does not host this project's MySQL database. Keep or provision a managed
MySQL database reachable from Vercel. The API currently stores uploaded files
on local disk; Vercel's filesystem is temporary, so persistent file storage
must be integrated before relying on course-material and submission uploads.

---

## Environment variables

### Backend (`backend/.env`)

See `backend/.env.example`.

### Frontend

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend base URL (no `/api` suffix) |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth Web client ID for sign-in |

Local dev uses `frontend/.env.development` (`http://localhost:5000`). On Vercel,
leave `VITE_API_URL` unset so the frontend uses its same-origin `/api` routes.
