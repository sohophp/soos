# soos Production Operations

This runbook covers the Vercel + Neon deployment supported by this repository.

## Release Preconditions

Use Node.js 22 or newer. From a clean checkout:

```bash
npm ci
npm run audit:dependencies
npm run check
npm run db:status
```

`db:status` is read-only. Exit code `0` means the migration ledger and required tables are current. Exit code `2` means migrations or tables are missing.

Confirm the production environment contains:

```env
SOOS_PUBLIC_BASE_URL=https://your-production-origin.example
DATABASE_URL=postgresql://...
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
SOOS_TOKEN_ENCRYPTION_KEY=...
SOOS_TOKEN_ENCRYPTION_KEY_PREVIOUS=
```

Never enable `SOOS_ALLOW_PROXY=1` on the public deployment.

## Database Backup And Migration

Migrations are forward-only and idempotent. Before a release containing a new migration:

1. Create a Neon branch or point-in-time restore point from production.
2. Record the source branch, restore timestamp, release commit, and current `db:status` output.
3. Run `npm run db:migrate` against the target database.
4. Run `npm run db:status` and require `ready: true`.
5. Deploy the application only after the schema check succeeds.

Do not manually delete rows from `soos_schema_migration`. A failed migration must be corrected by a new forward migration or by restoring the pre-release database branch.

## Vercel Release

1. Deploy a preview from the exact commit intended for production.
2. Verify `/api/health`, `/api/metrics`, the scan form, OAuth start/callback, property selection, and one small audit.
3. Confirm Vercel environment variables are scoped to Production and the Google OAuth redirect URI matches the production origin exactly.
4. Promote the verified deployment.
5. Repeat `/api/health`, GSC connection test, a small scan, retained-task open/delete, and HTML/CSV export.
6. Watch request errors, Google failures, and audit outcomes in `/api/metrics` and Vercel logs during the release window.

## Application Rollback

Vercel rollback changes application code, not Neon data.

1. Roll back to the last known-good Vercel deployment.
2. Verify `/api/health` and a small scan.
3. If the release added only backward-compatible schema, keep the current database.
4. If old code cannot read the new schema, point `DATABASE_URL` to the pre-release Neon branch and redeploy.
5. Preserve the failed database branch for investigation; do not delete it during the incident.

All new migrations should be additive first: add nullable columns/tables/indexes, deploy compatible readers/writers, backfill if needed, and remove old structures only in a later release.

## Database Restore

Use restore only for confirmed data corruption or an incompatible migration:

1. Stop promoting new deployments and record the incident time.
2. Create a Neon branch restored to immediately before the bad change.
3. Run `npm run db:status` against the restored branch.
4. Set Vercel `DATABASE_URL` to the restored branch and redeploy the known-good application commit.
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
