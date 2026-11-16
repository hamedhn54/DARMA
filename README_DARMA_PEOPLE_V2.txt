DARMA - People Finance Improvements V2

Contents
- Persian/Jalali date input and calendar for operation and history filters
- Amount input with Persian digit support and 3-digit grouping
- Sequential journal document numbering (existing documents are numbered during Dexie v3 upgrade)
- Journal detail view with debit/credit lines and totals
- Direct in-place editing: the same document is updated and its journal lines are replaced atomically; no prior edit versions are retained
- Void action: voided documents remain visible when the void filter is enabled and are excluded from balances
- Controlled deletion: only documents explicitly marked as test can be permanently deleted; existing documents can be marked as test from their history row
- History filters by person, operation type, and Jalali date range
- Cash/bank/wallet balances calculated from initial balance plus person-ledger journal lines; displayed in both People Finance and Definitions pages
- Improved gross receivable/payable and net balance presentation

Install
1. Upload this ZIP into the root of the DARMA project in Codespaces.
2. In the terminal run:
   unzip -o DARMA_people_finance_v2.zip -d .
3. Run:
   npm run build
4. If build succeeds, run:
   npm run dev -- --host 0.0.0.0

Important accounting behavior
- Editing changes the existing document in place. Its old journal lines are replaced in the same Dexie transaction, so balances are recalculated from the corrected lines. No edit audit trail is stored, per product decision.
- Voiding retains the document and its lines, but voided documents are excluded from person and cash balances.
- Permanent deletion is only allowed for records explicitly flagged as test.
- The cash balance calculation is shared by the person-finance and Definitions screens. Other transaction modules/dashboard sample figures are not yet connected to this journal ledger; that integration remains a separate phase.

Compatibility
- No new npm dependency is introduced. Uses the existing date-fns-jalali, Dexie, React, and lucide-react dependencies.
- Dexie schema is upgraded to version 3. Existing definitions and journal entries are retained; existing journal entries receive sequential document numbers and active status during migration.

Validation note
The TypeScript/TSX files were syntax-transpiled successfully. A full Vite/TypeScript build could not be run in the packaging environment because npm dependencies were not available there. Run `npm run build` in the existing Codespaces project before using the changes.
