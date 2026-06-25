# soos Production Operations

This runbook covers both supported production shapes: Vercel + Neon/Postgres and a self-hosted VPS or long-running Node service with optional Postgres.

## Release Preconditions

Use Node.js 22 or newer. From a clean checkout:

```bash
npm ci
npm run test:e2e:install
npm run check:release
npm run test:e2e
```

`check:release` runs the high-severity dependency audit, the full syntax/unit/API/build gate, and `db:status` when `DATABASE_URL` is configured. `db:status` is read-only. Exit code `0` means the migration ledger and required tables are current. Exit code `2` means migrations or tables are missing.

The Vite chunk-size warning threshold is pinned at 600 kB. If a production build warns above that threshold, review whether the growth is expected before promoting the release.

Confirm the production environment contains:

```env
SOOS_PUBLIC_BASE_URL=https://your-production-origin.example
DATABASE_URL=postgresql://...
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
SOOS_TOKEN_ENCRYPTION_KEY=...
SOOS_TOKEN_ENCRYPTION_KEY_PREVIOUS=
SOOS_API_PORT=4177
SOOS_ALLOW_PROXY=0
```

`DATABASE_URL` can point to Neon, Supabase, RDS, or a self-hosted Postgres database. Public multi-user deployments should set it so OAuth tokens, retained reports, and resumable jobs are isolated per browser session. Private single-user deployments may omit it, but `.soos-gsc.json` and in-memory jobs are then local to one process.

Never enable `SOOS_ALLOW_PROXY=1` on the public deployment.

## Database Backup And Migration

Migrations are forward-only and idempotent. Before a release containing a new migration:

1. Create a Neon branch or point-in-time restore point from production.
2. Record the source branch, restore timestamp, release commit, and current `db:status` output.
3. Confirm every `integrity` counter in `db:status` is `0`; resolve malformed legacy rows before adding validated constraints.
4. Run `npm run db:migrate` against the target database.
5. Run `npm run db:status` and require `ready: true`, no pending versions, every required constraint/index `true`, and every integrity counter `0`.
6. Deploy the application only after the schema check succeeds.

Do not manually delete rows from `soos_schema_migration`. A failed migration must be corrected by a new forward migration or by restoring the pre-release database branch.

## Self-hosted VPS Release

1. Deploy the exact commit intended for production to the server.
2. Run `npm ci` and `npm run check:release` on the release artifact or in CI for that commit.
3. If `DATABASE_URL` is set, run `npm run db:status`, apply `npm run db:migrate` when needed, and require `db:status` to report ready before restarting the service.
4. Run `npm run build`.
5. Restart the Node service with the production `.env`, for example through systemd, PM2, Docker, or another supervisor.
6. Verify `/api/health`, `/api/metrics`, the scan form, OAuth start/callback, property selection, one small audit, retained-task open/delete, and HTML/CSV export.
7. Confirm the reverse proxy serves HTTPS, preserves `/api/*`, forwards the original host/protocol, and points Google OAuth redirect URI to `SOOS_PUBLIC_BASE_URL/api/gsc/oauth/callback`.

## Vercel Release

1. Deploy a preview from the exact commit intended for production.
2. Verify `/api/health`, `/api/metrics`, the scan form, OAuth start/callback, property selection, and one small audit.
3. Confirm Vercel environment variables are scoped to Production and the Google OAuth redirect URI matches the production origin exactly.
4. Promote the verified deployment.
5. Repeat `/api/health`, GSC connection test, a small scan, retained-task open/delete, and HTML/CSV export.
6. Watch request errors, Google failures, and audit outcomes in `/api/metrics` and Vercel logs during the release window.

## Application Rollback

Application rollback changes application code, not Postgres data.

1. Roll back to the last known-good Vercel deployment or VPS artifact.
2. Verify `/api/health` and a small scan.
3. If the release added only backward-compatible schema, keep the current database.
4. If old code cannot read the new schema, point `DATABASE_URL` to the pre-release Neon/Postgres restore branch and redeploy.
5. Preserve the failed database branch for investigation; do not delete it during the incident.

All new migrations should be additive first: add nullable columns/tables/indexes, deploy compatible readers/writers, backfill if needed, and remove old structures only in a later release.

## Database Restore

Use restore only for confirmed data corruption or an incompatible migration:

1. Stop promoting new deployments and record the incident time.
2. Create a Neon branch, Postgres backup restore, or point-in-time recovery target from immediately before the bad change.
3. Run `npm run db:status` against the restored branch.
4. Set deployment `DATABASE_URL` to the restored branch or database and redeploy the known-good application commit.
5. Verify OAuth status, retained reports, task recovery, and deletion using a test browser session.
6. Keep the damaged branch read-only for comparison until the incident is closed.

Retained reports expire after 7 days and inactive OAuth connections after 90 days. Restoration can revive records that had expired after the restore timestamp; normal cleanup removes them on subsequent database-backed requests.

## OAuth And Encryption Incidents

For routine token-encryption key rotation:

1. Generate a new `SOOS_TOKEN_ENCRYPTION_KEY`.
2. Move the former primary key into `SOOS_TOKEN_ENCRYPTION_KEY_PREVIOUS`.
3. Redeploy and test an existing connection plus a new OAuth connection.
4. Keep historical keys for at least 90 days before removal.

If a token encryption key is exposed, rotate immediately and disconnect affected browser sessions where practical. If the Google OAuth Client Secret is exposed, rotate it in Google Cloud, update Vercel, verify the callback, and reconnect users whose refresh flow fails.

## Incident Signals

- `/api/health` non-200: application or routing failure.
- Rising HTTP server errors: inspect structured logs by request ID.
- Rising Google failure rate: verify Google status, OAuth credentials, quota, and property permissions.
- Falling audit completion rate or rising duration: inspect scan targets, Neon leases, external fetch timeouts, and Vercel function limits.
- `db:status` not ready: do not promote the release.

`/api/metrics` is per Serverless instance and resets on cold start. Use Vercel logs or an external metrics service for cross-instance alerting and historical trends.
