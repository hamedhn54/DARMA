import { definitionsDb } from "../database/definitionsDb";

export interface LedgerLine {
  entryId: string;
  accountCode: string;
  debit: number;
  credit: number;
  cashAccountId?: string;
}

const cashCode = (id: string) => `cash:${id}`;
const categoryCode = (type: string, id?: string) => `${type}:${id || "other"}`;

export function buildJournalLines(input: any, id: string, accountId?: string, fromId?: string, toId?: string, categoryId?: string): LedgerLine[] {
  const lines: LedgerLine[] = [];
  const fee = input.fee || 0;

  if (input.type === "income") {
    lines.push(
      { entryId: id, accountCode: cashCode(accountId!), debit: input.amount - fee, credit: 0, cashAccountId: accountId },
      { entryId: id, accountCode: categoryCode("income", categoryId), debit: 0, credit: input.amount }
    );
    if (fee) lines.push({ entryId: id, accountCode: "expense:bank-fee", debit: fee, credit: 0 });
  }

  if (input.type === "expense") {
    lines.push(
      { entryId: id, accountCode: categoryCode("expense", categoryId), debit: input.amount, credit: 0 },
      { entryId: id, accountCode: cashCode(accountId!), debit: 0, credit: input.amount + fee, cashAccountId: accountId }
    );
    if (fee) lines.push({ entryId: id, accountCode: "expense:bank-fee", debit: fee, credit: 0 });
  }

  if (input.type === "transfer") {
    lines.push(
      { entryId: id, accountCode: cashCode(toId!), debit: input.amount, credit: 0, cashAccountId: toId },
      { entryId: id, accountCode: cashCode(fromId!), debit: 0, credit: input.amount + fee, cashAccountId: fromId }
    );
    if (fee) lines.push({ entryId: id, accountCode: "expense:bank-fee", debit: fee, credit: 0 });
  }

  return lines;
}

export async function getNextDocNo(): Promise<number> {
  const lastEntry = await definitionsDb.journalEntries.orderBy("docNo").last();
  return (lastEntry?.docNo || 0) + 1;
}
