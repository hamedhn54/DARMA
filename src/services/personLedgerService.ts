import { definitionsDb, type DefinitionRecord, type JournalEntry, type JournalLine } from "../database/definitionsDb";

export type PersonOperation = "lend" | "borrow" | "collect" | "repay" | "offset";
export type PersonJournalEntry = JournalEntry & { personId: string; type: PersonOperation };
export interface PersonBalance { personId: string; receivable: number; payable: number; net: number }
export interface CashBalance { accountId: string; balance: number }
export interface PersonOperationInput {
  personId: string; type: PersonOperation; amount: number; cashAccountId?: string;
  date?: string; description?: string; isTest?: boolean;
}

const receivableCode = (personId: string) => `person:${personId}:receivable`;
const payableCode = (personId: string) => `person:${personId}:payable`;
const cashCode = (accountId: string) => `cash:${accountId}`;
const active = (entry: JournalEntry) => entry.status !== "void";

export async function getPersonBalances(): Promise<PersonBalance[]> {
  const people = await definitionsDb.definitions.where("kind").equals("person").toArray();
  const [lines, entries] = await Promise.all([definitionsDb.journalLines.toArray(), definitionsDb.journalEntries.toArray()]);
  const activeIds = new Set(entries.filter(active).map(e => e.id));
  return people.map(person => {
    const personLines = lines.filter(line => line.personId === person.id && activeIds.has(line.entryId));
    const receivable = personLines.filter(line => line.accountCode === receivableCode(person.id)).reduce((sum, line) => sum + line.debit - line.credit, 0);
    const payable = personLines.filter(line => line.accountCode === payableCode(person.id)).reduce((sum, line) => sum + line.credit - line.debit, 0);
    return { personId: person.id, receivable, payable, net: receivable - payable };
  });
}

export async function getCashBalances(): Promise<CashBalance[]> {
  const accounts = await definitionsDb.definitions.toArray();
  const cashAccounts = accounts.filter(a => ["bank", "cash", "wallet"].includes(a.kind));
  const [lines, entries] = await Promise.all([definitionsDb.journalLines.toArray(), definitionsDb.journalEntries.toArray()]);
  const activeIds = new Set(entries.filter(active).map(e => e.id));
  return cashAccounts.map(account => ({
    accountId: account.id,
    balance: (account.initialBalance || 0) + lines.filter(line => line.cashAccountId === account.id && activeIds.has(line.entryId)).reduce((sum, line) => sum + line.debit - line.credit, 0),
  }));
}

export async function getPersonHistory(personId?: string): Promise<PersonJournalEntry[]> {
  const entries = personId ? await definitionsDb.journalEntries.where("personId").equals(personId).toArray() : await definitionsDb.journalEntries.toArray();
  return entries.filter((entry): entry is PersonJournalEntry =>
    !!entry.personId && ["lend", "borrow", "collect", "repay", "offset"].includes(entry.type)
  ).sort((a, b) => b.date.localeCompare(a.date));
}

function makeLines(input: PersonOperationInput, id: string, cash?: DefinitionRecord): Omit<JournalLine, "id">[] {
  const { personId: p, type, amount } = input;
  const cc = cash ? cashCode(cash.id) : "";
  if (type === "lend") return [
    { entryId: id, accountCode: receivableCode(p), debit: amount, credit: 0, personId: p },
    { entryId: id, accountCode: cc, debit: 0, credit: amount, cashAccountId: cash!.id },
  ];
  if (type === "borrow") return [
    { entryId: id, accountCode: cc, debit: amount, credit: 0, cashAccountId: cash!.id },
    { entryId: id, accountCode: payableCode(p), debit: 0, credit: amount, personId: p },
  ];
  if (type === "collect") return [
    { entryId: id, accountCode: cc, debit: amount, credit: 0, cashAccountId: cash!.id },
    { entryId: id, accountCode: receivableCode(p), debit: 0, credit: amount, personId: p },
  ];
  if (type === "repay") return [
    { entryId: id, accountCode: payableCode(p), debit: amount, credit: 0, personId: p },
    { entryId: id, accountCode: cc, debit: 0, credit: amount, cashAccountId: cash!.id },
  ];
  return [
    { entryId: id, accountCode: payableCode(p), debit: amount, credit: 0, personId: p },
    { entryId: id, accountCode: receivableCode(p), debit: 0, credit: amount, personId: p },
  ];
}

async function validateAndGetCash(input: PersonOperationInput): Promise<DefinitionRecord | undefined> {
  const person = await definitionsDb.definitions.get(input.personId);
  if (!person || person.kind !== "person") throw new Error("شخص انتخاب‌شده معتبر نیست.");
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) throw new Error("مبلغ باید عدد صحیح و بیشتر از صفر باشد.");
  if (input.type === "offset") return undefined;
  if (!input.cashAccountId) throw new Error("حساب بانکی، صندوق یا کیف پول را انتخاب کن.");
  const cash = await definitionsDb.definitions.get(input.cashAccountId);
  if (!cash || !["bank", "cash", "wallet"].includes(cash.kind)) throw new Error("حساب مالی انتخاب‌شده معتبر نیست.");
  return cash;
}

async function validateAvailable(input: PersonOperationInput, excludingEntryId?: string) {
  const [entries, lines] = await Promise.all([definitionsDb.journalEntries.toArray(), definitionsDb.journalLines.toArray()]);
  const validIds = new Set(entries.filter(e => active(e) && e.id !== excludingEntryId).map(e => e.id));
  const own = lines.filter(l => l.personId === input.personId && validIds.has(l.entryId));
  const receivable = own.filter(l => l.accountCode === receivableCode(input.personId)).reduce((s,l) => s + l.debit - l.credit, 0);
  const payable = own.filter(l => l.accountCode === payableCode(input.personId)).reduce((s,l) => s + l.credit - l.debit, 0);
  if (input.type === "collect" && input.amount > receivable) throw new Error("مبلغ دریافت بیشتر از طلب باقی‌مانده است.");
  if (input.type === "repay" && input.amount > payable) throw new Error("مبلغ پرداخت بیشتر از بدهی باقی‌مانده است.");
  if (input.type === "offset" && input.amount > Math.min(receivable, payable)) throw new Error("مبلغ تهاتر از حداقل طلب و بدهی باقی‌مانده بیشتر است.");
}

function buildEntry(input: PersonOperationInput, id: string, old?: JournalEntry): JournalEntry {
  const now = new Date().toISOString();
  return {
    id, date: input.date || now, type: input.type, personId: input.personId, amount: input.amount,
    description: input.description?.trim() || ({ lend: "قرض پرداخت‌شده به شخص", borrow: "قرض دریافت‌شده از شخص", collect: "دریافت بازپرداخت طلب", repay: "پرداخت بازپرداخت بدهی", offset: "تهاتر طلب و بدهی" }[input.type]),
    cashAccountId: input.type === "offset" ? undefined : input.cashAccountId,
    createdAt: old?.createdAt || now, updatedAt: now, status: "active", isTest: input.isTest ?? old?.isTest ?? false,
  };
}

export async function postPersonOperation(input: PersonOperationInput): Promise<string> {
  const normalized = { ...input, amount: Math.round(input.amount) };
  const cash = await validateAndGetCash(normalized);
  await validateAvailable(normalized);
  const id = crypto.randomUUID();
  const lines = makeLines(normalized, id, cash);
  if (lines.reduce((s,l) => s + l.debit, 0) !== lines.reduce((s,l) => s + l.credit, 0)) throw new Error("سند حسابداری تراز نیست.");
  
  await definitionsDb.transaction("rw", definitionsDb.journalEntries, definitionsDb.journalLines, async () => {
    // بهینه‌سازی تولید شماره سند
    const lastEntry = await definitionsDb.journalEntries.orderBy("docNo").last();
    const docNo = (lastEntry?.docNo || 0) + 1;
    
    await definitionsDb.journalEntries.add({ ...buildEntry(normalized, id), docNo });
    await definitionsDb.journalLines.bulkAdd(lines.map(line => ({ ...line, id: crypto.randomUUID() })));
  });
  return id;
}

export async function updatePersonOperation(entryId: string, input: PersonOperationInput): Promise<void> {
  const normalized = { ...input, amount: Math.round(input.amount) };
  const cash = await validateAndGetCash(normalized);
  await validateAvailable(normalized, entryId);
  const old = await definitionsDb.journalEntries.get(entryId);
  if (!old || !active(old)) throw new Error("سند فعال برای ویرایش پیدا نشد.");
  const lines = makeLines(normalized, entryId, cash);
  if (lines.reduce((s,l) => s + l.debit, 0) !== lines.reduce((s,l) => s + l.credit, 0)) throw new Error("سند حسابداری تراز نیست.");
  await definitionsDb.transaction("rw", definitionsDb.journalEntries, definitionsDb.journalLines, async () => {
    await definitionsDb.journalLines.where("entryId").equals(entryId).delete();
    await definitionsDb.journalLines.bulkAdd(lines.map(line => ({ ...line, id: crypto.randomUUID() })));
    await definitionsDb.journalEntries.put({ ...buildEntry(normalized, entryId, old), docNo: old.docNo });
  });
}

export async function voidPersonOperation(entryId: string, reason: string): Promise<void> {
  const entry = await definitionsDb.journalEntries.get(entryId);
  if (!entry || !active(entry)) throw new Error("سند فعال پیدا نشد.");
  await definitionsDb.journalEntries.update(entryId, { status: "void", voidReason: reason.trim() || "ابطال سند", updatedAt: new Date().toISOString() });
}

export async function deleteTestPersonOperation(entryId: string): Promise<void> {
  const entry = await definitionsDb.journalEntries.get(entryId);
  if (!entry || !entry.isTest) throw new Error("فقط سندی که به‌عنوان آزمایشی علامت‌گذاری شده باشد قابل حذف است.");
  await definitionsDb.transaction("rw", definitionsDb.journalEntries, definitionsDb.journalLines, async () => {
    await definitionsDb.journalLines.where("entryId").equals(entryId).delete();
    await definitionsDb.journalEntries.delete(entryId);
  });
}