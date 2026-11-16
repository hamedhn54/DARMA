DARMA - Loans, Installments & Credit Purchases v1

This package adds the first integrated implementation of:
- Loan registration (existing loan vs. newly received loan)
- Principal-only installment schedules with Jalali due dates
- Installment payments posted to the shared journal
- Credit purchases by platform (e.g. Tara, DigiPay, SnappPay)
- Credit purchase schedules and installment payments
- Credit purchase amount included in expense totals and category reports

Database:
- Dexie schema upgraded from version 4 to version 5.
- New tables: installments, creditPurchases.
- Existing definitions, journalEntries and journalLines are preserved.
- No database reset or deletion is performed.

Accounting treatment:
- New loan: debit selected cash/bank account, credit loan principal liability.
- Existing loan: opening liability is recorded without changing cash balance.
- Loan installment: debit loan liability, credit selected cash/bank account.
- Credit purchase: debit credit-purchase expense, credit credit liability.
- Credit installment: debit credit liability, credit selected cash/bank account.

Important v1 limitations:
- Loan installments are principal-only; interest, fees, variable-rate amortization and early settlement are not yet modeled.
- Credit purchases are split evenly across the entered number of installments; final installment absorbs rounding remainder.
- No automatic bank/SMS reconciliation or provider API connection is included.
- Existing loan definitions created before this module may appear without a generated installment schedule. Their existing records are not modified automatically.

Build:
- Dependencies are not bundled. Run npm install, then npm run build in the existing Codespace.
- Keep the existing development origin/port 5173 so the current IndexedDB remains accessible.
