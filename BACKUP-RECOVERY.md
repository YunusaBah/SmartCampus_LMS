# SmartCampus backup and recovery

Database backups and uploaded files are separate recovery concerns. A database
backup does not include objects in the Supabase Storage bucket.

## Production requirements

- Enable automated encrypted backups and point-in-time recovery for the Supabase PostgreSQL database. Retain backups according to the institution's recovery requirements and keep a separate copy outside the database provider account.
- Course materials, assignment files, and submissions are stored in the private Supabase Storage bucket configured in `DEPLOYMENT.md`. Include that bucket in the backup and recovery plan; do not treat Vercel's `/tmp` or `UPLOADS_DIR` as persistent storage.
- Restrict backup and object-storage access to the deployment team. Backups contain personal information, submissions, and grade history; do not put them in the repository or an unencrypted shared drive.
- Configure `PASSWORD_RESET_DELIVERY_URL`, `PASSWORD_RESET_DELIVERY_SECRET` (at least 32 characters), and `PASSWORD_RESET_PAGE_URL` in the Vercel project environment. The delivery endpoint must authenticate `X-Reset-Delivery-Secret` and send the provided HTTPS link only to the supplied account email. The app does not send email itself.

## Database backup

Use Supabase's managed PostgreSQL backups for production recovery. If a manual
logical dump is needed, run `pg_dump` from a trusted workstation using the
production connection URI from the secret manager. Store the output only in an
encrypted backup location:

```powershell
$env:PGPASSWORD = $env:DB_PASSWORD
pg_dump --dbname=$env:DATABASE_URL --no-password --format=custom --file="smartcampus-$((Get-Date).ToUniversalTime().ToString('yyyyMMdd-HHmmss')).dump"
Remove-Item Env:PGPASSWORD
```

The Storage bucket needs its own backup or replication plan; the database dump
does not contain uploaded objects.

## Recovery exercise

At least quarterly, and after a database-provider change:

1. Restore the newest backup to an isolated staging database, never directly over production.
2. Set staging environment variables to that database and run the backend migrations/startup.
3. Sign in with a test account and verify courses, enrollments, assignments, submissions, grades, calendar events, and audit entries.
4. Restore representative uploaded files from the separate object-storage backup and verify authenticated downloads for an enrolled student and the owning lecturer, plus denial for an unrelated account.
5. Record the backup timestamp, restore duration, checks performed, and any recovery defects in the team's operational log.

Do not declare recovery ready until both database records and their associated private files have been restored and verified.
