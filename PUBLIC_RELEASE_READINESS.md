# DARMA – Public release readiness (Package 5)

## Implemented in this source package
- Installable PWA manifest and app metadata (Persian / RTL).
- Service worker caches the application shell and same-origin static assets for repeat/offline launches.
- Local-first data remains in IndexedDB (Dexie); database schema is upgraded from v5 to v6 without deleting existing tables or records.
- `.env.example` reserves public client configuration names; it contains no credentials.

## Explicitly not production-complete
The current application is still a single-browser local application. It does **not** yet provide:
- Real sign-up/sign-in, password reset, session management, or server-side authorization.
- Per-user cloud data isolation / database row-level security.
- Encrypted cloud synchronization, conflict resolution, server backups, or account recovery.
- Production deployment configuration, domain, TLS, monitoring, or operational alerting.

These must be implemented and tested against a real backend (for example Supabase/PostgreSQL) before opening public registration. A client-side profile selector or a workspace ID alone is not a security boundary and must not be presented as multi-user isolation.

## Recommended production sequence
1. Create Supabase project and separate development/production environments.
2. Design normalized server schema with `user_id` ownership on every user-owned record.
3. Enable Row Level Security on every table and test cross-user access denial.
4. Implement Auth flows and session-aware data repository.
5. Implement local outbox, idempotent sync, versioning and conflict resolution.
6. Migrate IndexedDB records to the authenticated user's cloud workspace only after explicit user confirmation and a tested backup/restore path.
7. Configure domain, HTTPS, CSP, monitoring, rate limits and privacy/terms pages.
8. Run security, financial-integrity, migration, restore and multi-device tests before public launch.

## Important data behavior
- Do not change the Vite dev-server origin/port during testing. IndexedDB is origin-scoped.
- Current local database name is `DarmaDefinitionsDB`.
- Schema v6 adds `budgets` and `attachments`; prior stores are retained.
- Backup and restore remain intentionally deferred to the final project stage, as previously decided.
