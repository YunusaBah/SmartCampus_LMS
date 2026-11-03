# Backend LMS API additions

The server runs additive, idempotent schema migrations before create-only
`sequelize.sync()`. To apply the migration separately during deployment, run
`npm run migrate` from this directory. It adds optional legacy-table columns
and records the applied migration in `SchemaMigrations`; it does not drop or
alter existing data. Do not use `sync({ alter: true })`.

Database connections use a configurable per-process pool (`DB_POOL_MAX`,
`DB_POOL_MIN`, `DB_POOL_ACQUIRE`, `DB_POOL_IDLE`, and `DB_CONNECT_TIMEOUT`).
Set `DB_POOL_MAX` based
on the database's available connection limit and the number of backend
instances; the total possible connections are approximately the pool maximum
multiplied by the number of instances. Assessment starts lock the enrolling
student's course enrollment while checking and creating attempts, preventing
simultaneous starts from exceeding the configured attempt limit without
serializing starts by every other student.

For local development, create a PostgreSQL database (for example, `smartcampus`)
in pgAdmin, then set `DB_HOST=localhost`, `DB_PORT=5432`, `DB_NAME`,
`DB_USER`, and `DB_PASSWORD` in `backend/.env`. Leave `DATABASE_URL` empty and
set `DB_SSL=false` for local PostgreSQL. The backend applies its migrations and
creates missing tables when it starts; it does not create the PostgreSQL
database itself.

For deployment, set `DB_DIALECT=postgres`, `DATABASE_URL` to the PostgreSQL
connection URI from Supabase Project Settings → Database, and `DB_SSL=true` in
the hosting provider's environment settings. `DATABASE_URL` takes precedence
over the individual `DB_HOST`/`DB_NAME`/`DB_USER`/`DB_PASSWORD` settings, so the
same code can use local PostgreSQL in development and Supabase in deployment.
Keep the connection pool small for serverless deployments, and use Supabase's
session pooler URI if the hosting provider cannot connect directly to the
database. PostgreSQL is selected automatically when `DATABASE_URL` is set and
`DB_DIALECT` is omitted. SSL certificate verification is enabled whenever SSL
is enabled; only disable SSL for local development, never to work around an
untrusted production certificate. If the provider uses a private or self-signed
CA, download its CA certificate from the provider's database settings and set
`DB_SSL_CA_FILE` to that certificate's path. The certificate is added to the
trusted CA set without disabling certificate or hostname verification.

On Vercel, course materials, assignment files, submissions, and quiz-import
documents use the private Supabase Storage bucket configured in the repository
root's `DEPLOYMENT.md`. Set backend-only `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_STORAGE_BUCKET`; the browser uses the
public `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to complete signed
uploads. Keep the bucket private and set its maximum object size to 20 MB.
Upload bytes go directly from the browser to Storage, not through the Vercel
function request body. The backend checks access before signing and again
before attaching an uploaded object to a resource. Local development continues
to use the filesystem when Storage credentials are absent.

During startup, the backend retries transient PostgreSQL connection failures
with a capped delay instead of exiting. It will not listen for API requests
until the database connects and migrations finish. If retries continue, verify
the provider is active, the connection URI uses the correct host/port/user, and
the provider CA is configured when required.

Help-center feedback is emailed to the configured personal recipient after the
user submits a 1–5 star rating and a written message. Public collaboration
messages are delivered to the configured school recipient. Both are sent by the
backend over SMTP; the browser does not open a mail application. Configure
`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, and
`SMTP_FROM` in `backend/.env` for local development and in the backend hosting
environment for deployment. Set `FEEDBACK_RECIPIENT_EMAIL` and
`COLLABORATION_RECIPIENT_EMAIL` if the recipient addresses differ from those in
`.env.example`. The forms report a delivery error if SMTP is not configured;
they do not show a success message unless delivery succeeds.

All routes below require a bearer token unless otherwise stated. The platform
has two roles: `student` and `lecturer`. Lecturers manage only courses they
own; students must be enrolled to read or submit course work. The
`20261004_03_lecturer_student_roles` migration converts legacy admin accounts
to lecturers, revokes their prior tokens, and restricts the database role enum
to those two roles. Public email and Google registration can create student
accounts only; lecturer accounts must be provisioned by the institution.

| Area | Endpoints |
|---|---|
| Modules/progress | `GET/POST /api/courses/:courseId/modules`, `PATCH/DELETE /api/modules/:id`, `PATCH /api/lessons/:id/order`, `POST /api/lessons/:lessonId/progress`, `GET /api/courses/:courseId/progress` |
| Announcements | `GET/POST /api/courses/:courseId/announcements`, `PATCH/DELETE /api/announcements/:id` |
| Messages | `GET /api/courses/:courseId/conversations`, `GET /api/courses/:courseId/conversations/:userId`, `POST /api/courses/:courseId/messages` with `{ "recipientId": 7, "body": "..." }` |
| Notifications | `GET /api/notifications`, `PATCH /api/notifications/:id/read`, `PATCH /api/notifications/read-all` |
| Timed assessments | `POST /api/quizzes/assessments` with course/title/time limit/questions and optional `maxAttempts` (1-10, default 1), `GET /api/quizzes/assessments/course/:courseId`, `GET /api/quizzes/assessments/:id`, `POST /api/quizzes/assessments/:id/attempts`, `PUT /api/quizzes/attempts/:attemptId/answers` with `{ "answers": { "questionId": "A" } }`, `POST /api/quizzes/attempts/:attemptId/submit`; students can retrieve their current/latest attempt at `GET /api/quizzes/assessments/:id/attempt`, and course managers can review attempts at `GET /api/quizzes/assessments/:id/attempts`. Legacy quiz endpoints remain unchanged. Correct answers are withheld until an attempt is submitted.
| Calendar/departments | Authenticated `GET /api/calendar?from=<ISO>&to=<ISO>` aggregates course events and assignment due dates for the current user's courses. Lecturers can manage typed `event`, `class`, `exam`, `deadline`, or `other` events through `GET/POST /api/courses/:courseId/calendar` and `PATCH/DELETE /api/calendar/:id`. Authenticated `GET /api/departments`; course lecturers can associate a department using `PATCH /api/courses/:id/department`. |
| Gradebook/certificates | Manager-only `GET /api/courses/:courseId/gradebook` and `/analytics`; student `GET /api/assignments/my/submissions`, `GET /api/certificates`, `POST /api/courses/:courseId/certificate` |

Certificates are issued once per student/course when at least one lesson exists
and all course lessons are marked complete. Assignment grading accepts optional
`feedback`. Assignment, announcement, message, grading, assessment, and
calendar creation writes recipient-scoped notifications in the same database
transaction. Changing a password revokes prior JWTs; old tokens without a
token-version claim remain valid only while the account version is zero.

## Student chat

Chat messages use Supabase Realtime when configured. The backend exchanges the
existing SmartCampus session for a short-lived Supabase JWT whose subject is
the chat profile UUID; row-level policies then restrict group messages to
course members and private messages to students who still share a course.
When using local PostgreSQL, Supabase Auth is not installed, so the backend
skips Supabase-specific chat row-level security setup and logs a warning;
chat requests still use the backend's authorization checks. Supabase Realtime
requires the deployed Supabase database and its Auth schema. Production startup
fails if that schema is unavailable.
Configure backend-only `SUPABASE_JWT_SECRET` from Supabase Project Settings →
API, and set the public `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the
frontend build environment. The anon key is public; never expose the database
password, service-role key, or JWT signing key to Vite. Server-sent events
provide authenticated presence/typing updates and a message-delivery fallback.
The in-memory presence/typing relay is intended for a single backend instance;
use a shared pub/sub adapter before scaling the API horizontally.

Configure `TENOR_API_KEY` in the backend environment to enable GIF/sticker
search. Voice notes are limited to 5 MB and stored in PostgreSQL; users can
stream them only after the backend rechecks their course membership or private
conversation. Saved and hidden messages are persisted per chat profile.

Configure `OPENAI_API_KEY` in the backend `.env` file to enable the AI
assistant. The key must remain server-side; do not put it in a frontend
`VITE_` variable or commit it to source control. The assistant uses the
`gpt-4o-mini` model through OpenAI's API.
