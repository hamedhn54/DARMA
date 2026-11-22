import { definitionsDb, type GoalRecord, type JournalEntry } from "../database/definitionsDb";

export async function getGoals(): Promise<GoalRecord[]> {
  return await definitionsDb.financialGoals.orderBy("createdAt").reverse().toArray();
}

export async function saveGoal(input: Omit<GoalRecord, "id" | "createdAt" | "updatedAt">, id?: string): Promise<void> {
  const now = new Date().toISOString();
  const existing = id ? await definitionsDb.financialGoals.get(id) : null;
  
  const record: GoalRecord = {
    id: id || crypto.randomUUID(),
    ...input,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  
  await definitionsDb.financialGoals.put(record);
}

export async function deleteGoal(id: string): Promise<void> {
  await definitionsDb.financialGoals.delete(id);
}

export async function addFundsToGoal(goalId: string, amount: number, sourceAccountId: string): Promise<void> {
  const goal = await definitionsDb.financialGoals.get(goalId);
  if (!goal) throw new Error("هدف پیدا نشد.");

  const account = await definitionsDb.definitions.get(sourceAccountId);
  if (!account || !["bank", "cash", "wallet"].includes(account.kind)) throw new Error("حساب بانکی مبدأ معتبر نیست.");

  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("مبلغ باید عدد صحیح و بیشتر از صفر باشد.");

  const entryId = crypto.randomUUID();
  const now = new Date().toISOString();
  const lastEntry = await definitionsDb.journalEntries.orderBy("docNo").last();
  const docNo = (lastEntry?.docNo || 0) + 1;

  const entry: JournalEntry = {
    id: entryId, docNo, date: now, type: "transfer", amount,
    description: `واریز به هدف: ${goal.title}`,
    createdAt: now, updatedAt: now, status: "active",
  };

  const lines = [
    { entryId, accountCode: `goal:${goal.id}`, debit: amount, credit: 0 }, // دارایی هدف افزایش می‌یابد
    { entryId, accountCode: `cash:${account.id}`, debit: 0, credit: amount, cashAccountId: account.id }, // بانک کاهش می‌یابد
  ];

  await definitionsDb.transaction("rw", definitionsDb.journalEntries, definitionsDb.journalLines, definitionsDb.financialGoals, async () => {
    await definitionsDb.journalEntries.add(entry);
    await definitionsDb.journalLines.bulkAdd(lines.map(l => ({ ...l, id: crypto.randomUUID() })));
    await definitionsDb.financialGoals.update(goalId, { savedAmount: goal.savedAmount + amount, updatedAt: now });
  });
}

// تابع جدید برای برداشت پول از هدف
export async function withdrawFundsFromGoal(goalId: string, amount: number, destinationAccountId: string): Promise<void> {
  const goal = await definitionsDb.financialGoals.get(goalId);
  if (!goal) throw new Error("هدف پیدا نشد.");
  if (amount > goal.savedAmount) throw new Error("مبلغ برداشت نمی‌تواند بیشتر از پس‌انداز فعلی هدف باشد.");

  const account = await definitionsDb.definitions.get(destinationAccountId);
  if (!account || !["bank", "cash", "wallet"].includes(account.kind)) throw new Error("حساب بانکی مقصد معتبر نیست.");

  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("مبلغ باید عدد صحیح و بیشتر از صفر باشد.");

  const entryId = crypto.randomUUID();
  const now = new Date().toISOString();
  const lastEntry = await definitionsDb.journalEntries.orderBy("docNo").last();
  const docNo = (lastEntry?.docNo || 0) + 1;

  const entry: JournalEntry = {
    id: entryId, docNo, date: now, type: "transfer", amount,
    description: `برداشت از هدف: ${goal.title}`,
    createdAt: now, updatedAt: now, status: "active",
  };

  // سند معکوس: بانک بدهکار (افزایش)، هدف بستانکار (کاهش)
  const lines = [
    { entryId, accountCode: `cash:${account.id}`, debit: amount, credit: 0, cashAccountId: account.id },
    { entryId, accountCode: `goal:${goal.id}`, debit: 0, credit: amount },
  ];

  await definitionsDb.transaction("rw", definitionsDb.journalEntries, definitionsDb.journalLines, definitionsDb.financialGoals, async () => {
    await definitionsDb.journalEntries.add(entry);
    await definitionsDb.journalLines.bulkAdd(lines.map(l => ({ ...l, id: crypto.randomUUID() })));
    await definitionsDb.financialGoals.update(goalId, { savedAmount: goal.savedAmount - amount, updatedAt: now });
  });
}