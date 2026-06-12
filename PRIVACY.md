# soos Privacy and Data Lifecycle

soos isolates each visitor's Google Search Console connection and audit data to that browser session. This document describes what is stored, where it is stored, how long it is retained, and how a visitor can delete it.

## Server Data

When `DATABASE_URL` is configured, the server may store:

- The current browser session's encrypted Google OAuth access and refresh tokens, selected Search Console property, and connected account identity.
- Audit task input, progress, configuration, completed reports, and resumable page checkpoints.
- Short-lived worker leases used to prevent duplicate processing.

Google tokens are encrypted with AES-256-GCM. Production deployments should set `SOOS_TOKEN_ENCRYPTION_KEY` and follow the rotation procedure in [OPERATIONS.md](OPERATIONS.md).

Inactive Google connections expire after 90 days. Neon audit tasks, reports, checkpoints, and leases expire after 7 days. Cleanup is request-driven; expired records may remain until a later database-backed request performs maintenance.

When no database is configured, the local Node server stores one Search Console configuration in `.soos-gsc.json` and keeps audit tasks in process memory. This mode is intended for a trusted single-user local installation, not a public multi-user deployment.

## Browser Data

The browser stores soos-prefixed local data such as:

- Audit history and lightweight issue fingerprints.
- The active resumable task identifier.
- Workspace view and local display preferences.
- OAuth completion notifications used to refresh the main window.

Imported access-log files are parsed in the browser. Raw log contents are not uploaded to Neon. Only unique public IP addresses associated with suspected Google crawler requests are sent to the server for DNS verification.

## Delete All Current Session Data

Open **Settings**, find **Privacy and data**, and choose **Delete all my data**.

After confirmation, soos:

1. Attempts to revoke the stored Google OAuth token.
2. Deletes the current session's Google connection, audit jobs, reports, checkpoints, and worker leases.
3. Retires the old session identifier and issues a new session cookie.
4. Removes soos-prefixed browser storage.
5. Clears currently displayed audit and Google results from memory.

Deletion continues even if Google does not confirm token revocation. It does not delete data belonging to another browser session or alter the user's Search Console property.

The same server operation is available as `POST /api/session-data/delete` with JSON body:

```json
{ "confirm": "DELETE" }
```

## Disconnect Google

The Google panel's disconnect action removes only the current session's saved Google connection, attempts token revocation, and rotates the session cookie. It does not remove retained audit reports or browser history. Use **Delete all my data** for the complete session cleanup.

## Operational Metrics

`GET /api/metrics` contains aggregate process-level request, Google API, and audit outcome counters. It does not include scanned URLs, Search Console properties, account identities, tokens, or error bodies.
