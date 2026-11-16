# DARMA 0.5.0 – Integrated feature build

## Package 1 – Loans and installments
- Added partial installment payments.
- Each partial payment creates its own balanced journal entry.
- Remaining installment balance is tracked; installment is marked paid only when fully settled.
- Loan pages show paid-to-date and remaining balance.

## Package 2 – Credit purchases
- Existing credit purchase and installment schedules remain integrated with the shared ledger.
- Installment selection in the transaction form is a two-step in-form modal: loan → pending installments sorted by due date.

## Package 3 – Budgeting
- Added monthly budget records in Dexie schema v6.
- Budget targets can be created/updated per income or expense category.
- Actuals are derived from active ledger transactions and include descendant categories.
- Budget data survives reloads and uses Jalali year-month periods.

## Package 4 – Financial reports
- Expanded reports with category expenses, cash/account balances, outstanding installment balances, upcoming due installments and budget performance.
- Bank fees are included in expense totals and fee reporting.

## Transaction form decisions
- Separate bank-fee accounting on income, expense, transfer and installment payments.
- Multiple attachments per transaction, stored as Blobs in IndexedDB (up to 10 files / 15 MB total per save).
- Hierarchical category selection (main category → detail) with search.

## Package 5 – Public release preparation
- Added installable PWA manifest and service worker shell/static caching.
- Added a public-release readiness document and environment template.
- Real authentication, cloud sync, per-user server isolation and production deployment are not included; these require a configured backend and security policies. See `PUBLIC_RELEASE_READINESS.md`.

## Data safety
- Dexie schema upgraded from v5 to v6; prior stores and records are retained.
- Backup/restore intentionally remains deferred to the final project stage.

## Verification
- TypeScript/TSX syntax parsing completed without syntax diagnostics.
- A full `npm run build` could not be run in the packaging environment because required npm packages were unavailable and registry installation timed out. Run the build in the existing Codespaces workspace before using this build with live financial data.
