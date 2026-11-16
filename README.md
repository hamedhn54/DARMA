# DARMA 0.5.0 – Personal Finance Web App

DARMA is a Persian / RTL, local-first personal finance application built with React, TypeScript, Vite and Dexie (IndexedDB).

## Included in this integrated build
- Shared double-entry journal for transactions, people, loans and credit purchases.
- Loan and credit installment schedules, including partial installment settlement.
- Transaction fees and multiple receipt/file attachments.
- Hierarchical category picker and monthly budget tracking.
- Expanded financial reports for cash, expenses, debt installments and budgets.
- PWA manifest and service worker for installability and offline app-shell caching.

## Development
```bash
npm ci
npm run build
npm run dev -- --host 0.0.0.0 --port 5173
```

Keep the same origin and port during testing. IndexedDB is scoped to the browser origin; changing the Codespaces port creates a separate local database view.

## Database
- Database name: `DarmaDefinitionsDB`
- Current Dexie schema: v6
- v6 adds `budgets` and `attachments`; it does not delete the earlier stores.

## Important release limitation
This package is not yet a public multi-user SaaS release. Authentication, server-side per-user data isolation, cloud sync and production operations require a configured backend and security policies. Read `PUBLIC_RELEASE_READINESS.md` before public deployment.

Backup and restore remain deferred to the final project stage.
