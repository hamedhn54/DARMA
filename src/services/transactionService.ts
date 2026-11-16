import { format } from "date-fns-jalali";
import { definitionsDb } from "../database/definitionsDb";
import { buildJournalLines, getNextDocNo } from "../accounting/ledgerEngine";

// فرض بر این است که این موارد در فایل شما وجود دارند یا از جای دیگری ایمپورت می‌شوند
type DefinitionRecord = any;
type FinancialTransactionInput = any;
type JournalEntry = any;
type LedgerSummary = any;

const cashKinds = ["bank", "cash", "wallet", "credit_card"];
const active = (e: any) => e.status !== "void" && e.status !== "deleted";

async function requireCash(id: string | undefined): Promise<DefinitionRecord> {
  if (!id) throw new Error("حساب بانکی یا صندوق را انتخاب کن.");
  const account = await definitionsDb.definitions.get(id);
  if (!account || !cashKinds.includes(account.kind)) throw new Error("حساب انتخاب‌شده معتبر نیست.");
  return account;
}

export async function postFinancialTransaction(input: FinancialTransactionInput): Promise<string> {
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) throw new Error("مبلغ باید عدد صحیح و بیشتر از صفر باشد.");
  if (!input.description.trim()) throw new Error("شرح تراکنش را وارد کن.");
  const fee = input.fee || 0;
  if (!Number.isSafeInteger(fee) || fee < 0) throw new Error("کارمزد باید عدد صحیح و نامنفی باشد.");
  if (input.type === "income" && fee >= input.amount) throw new Error("کارمزد دریافت باید کمتر از مبلغ دریافتی باشد.");
  
  let account: DefinitionRecord | undefined;
  let from: DefinitionRecord | undefined;
  let to: DefinitionRecord | undefined;
  
  if (input.type === "income" || input.type === "expense") account = await requireCash(input.accountId);
  if (input.type === "transfer") {
    from = await requireCash(input.fromAccountId);
    to = await requireCash(input.toAccountId);
    if (from.id === to.id) throw new Error("حساب مبدأ و مقصد نمی‌توانند یکسان باشند.");
  }
  
  if (input.categoryId) {
    const category = await definitionsDb.definitions.get(input.categoryId);
    const expectedRoot = input.type === "income" ? "income" : "expenses";
    if (!category || category.root !== expectedRoot || category.kind === "person") throw new Error("دسته‌بندی انتخاب‌شده با نوع تراکنش هم‌خوانی ندارد.");
  }

  const id = crypto.randomUUID();
  const lines = buildJournalLines(input, id, account?.id, from?.id, to?.id, input.categoryId);

  if (lines.reduce((s, l) => s + l.debit, 0) !== lines.reduce((s, l) => s + l.credit, 0)) {
    throw new Error("سند حسابداری متوازن نیست.");
  }

  await definitionsDb.transaction("rw", definitionsDb.journalEntries, definitionsDb.journalLines, async () => {
    const docNo = await getNextDocNo();
    const now = new Date().toISOString();
    
    const entry: JournalEntry = {
      id, docNo, date: input.date, type: input.type, amount: input.amount, fee,
      description: input.description.trim(), cashAccountId: account?.id,
      fromAccountId: from?.id, toAccountId: to?.id, categoryId: input.categoryId,
      createdAt: now, updatedAt: now, status: "active", isTest: input.isTest ?? false,
    };
    
    await definitionsDb.journalEntries.add(entry);
    await definitionsDb.journalLines.bulkAdd(lines.map(line => ({ ...line, id: crypto.randomUUID() })));
  });
  
  return id;
}

export async function updateFinancialTransaction(entryId: string, input: FinancialTransactionInput): Promise<void> {
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) throw new Error("مبلغ باید عدد صحیح و بیشتر از صفر باشد.");
  if (!input.description.trim()) throw new Error("شرح تراکنش را وارد کن.");
  const fee = input.fee || 0;
  if (!Number.isSafeInteger(fee) || fee < 0) throw new Error("کارمزد باید عدد صحیح و نامنفی باشد.");
  
  const old = await definitionsDb.journalEntries.get(entryId);
  if (!old) throw new Error("تراکنش یافت نشد.");

  let account: DefinitionRecord | undefined;
  let from: DefinitionRecord | undefined;
  let to: DefinitionRecord | undefined;
  
  if (input.type === "income" || input.type === "expense") account = await requireCash(input.accountId);
  if (input.type === "transfer") {
    from = await requireCash(input.fromAccountId);
    to = await requireCash(input.toAccountId);
    if (from.id === to.id) throw new Error("حساب مبدأ و مقصد نمی‌توانند یکسان باشند.");
  }

  const lines = buildJournalLines(input, entryId, account?.id, from?.id, to?.id, input.categoryId);

  if (lines.reduce((s, l) => s + l.debit, 0) !== lines.reduce((s, l) => s + l.credit, 0)) throw new Error("سند حسابداری متوازن نیست.");
  
  await definitionsDb.transaction("rw", definitionsDb.journalEntries, definitionsDb.journalLines, async () => {
    await definitionsDb.journalLines.where("entryId").equals(entryId).delete();
    await definitionsDb.journalLines.bulkAdd(lines.map(line => ({ ...line, id: crypto.randomUUID() })));
    await definitionsDb.journalEntries.put({
      ...old, date: input.date, type: input.type, amount: input.amount, fee, description: input.description.trim(),
      cashAccountId: account?.id, fromAccountId: from?.id, toAccountId: to?.id, categoryId: input.categoryId,
      updatedAt: new Date().toISOString(), isTest: input.isTest ?? old.isTest ?? false,
    });
  });
}

export async function voidFinancialTransaction(entryId: string, reason: string): Promise<void> {
  const entry = await definitionsDb.journalEntries.get(entryId);
  if (!entry || !active(entry) || !["income", "expense", "transfer"].includes(entry.type)) throw new Error("سند فعال پیدا نشد.");
  await definitionsDb.journalEntries.update(entryId, { status: "void", voidReason: reason.trim() || "ابطال سند", updatedAt: new Date().toISOString() });
}

export async function deleteTestFinancialTransaction(entryId: string): Promise<void> {
  const entry = await definitionsDb.journalEntries.get(entryId);
  if (!entry || !entry.isTest || !["income", "expense", "transfer"].includes(entry.type)) throw new Error("فقط سند آزمایشی قابل حذف است.");
  await definitionsDb.transaction("rw", definitionsDb.journalEntries, definitionsDb.journalLines, definitionsDb.attachments, async () => {
    await definitionsDb.journalLines.where("entryId").equals(entryId).delete();
    await definitionsDb.attachments.where("transactionId").equals(entryId).delete();
    await definitionsDb.journalEntries.delete(entryId);
  });
}

export async function getLedgerSummary(): Promise<LedgerSummary> {
  const [definitions, entries, lines] = await Promise.all([
    definitionsDb.definitions.toArray(), definitionsDb.journalEntries.toArray(), definitionsDb.journalLines.toArray(),
  ]);
  const validEntries = entries.filter(active);
  const validIds = new Set(validEntries.map(e => e.id));
  const validLines = lines.filter(line => validIds.has(line.entryId));
  const accounts = definitions.filter(d => cashKinds.includes(d.kind));
  const accountBalances = accounts.map(account => ({
    account,
    balance: (account.initialBalance || 0) + validLines.filter(line => line.cashAccountId === account.id).reduce((sum, line) => sum + line.debit - line.credit, 0),
  }));
  const now = new Date();
  const monthKey = format(now, "yyyy-MM");
  const monthly = validEntries.filter(e => format(new Date(e.date), "yyyy-MM") === monthKey);
  const monthlyIncome = monthly.filter(e => e.type === "income").reduce((s, e) => s + e.amount, 0);
  const monthlyExpense = monthly.filter(e => e.type === "expense" || e.type === "credit_purchase").reduce((s, e) => s + e.amount, 0) + monthly.reduce((s, e) => s + (e.fee || 0), 0);
  const expenseMap = new Map<string, number>();
  for (const entry of validEntries.filter(e => e.type === "expense" || e.type === "credit_purchase")) {
    const category = entry.type === "credit_purchase" ? "خریدهای اعتباری" : definitions.find(d => d.id === entry.categoryId)?.name || "سایر هزینه‌ها";
    expenseMap.set(category, (expenseMap.get(category) || 0) + entry.amount);
  }
  const totalFees = validEntries.reduce((sum, entry) => sum + (entry.fee || 0), 0);
  if (totalFees) expenseMap.set("کارمزدهای بانکی", (expenseMap.get("کارمزدهای بانکی") || 0) + totalFees);
  const totalCash = accountBalances.reduce((s, x) => s + x.balance, 0);
  
  return {
    cashTotal: totalCash, 
    incomeTotal: validEntries.filter(e => e.type === "income").reduce((s, e) => s + e.amount, 0),
    expenseTotal: validEntries.filter(e => e.type === "expense" || e.type === "credit_purchase").reduce((s, e) => s + e.amount, 0) + totalFees,
    netWorth: totalCash, 
    monthlyIncome, 
    monthlyExpense,
    accountBalances, 
    expenseMap, 
    totalFees
  } as any;
}