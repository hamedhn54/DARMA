import { addMonths, format, isValid, parse } from "date-fns-jalali";
import { definitionsDb, type DefinitionRecord, type JournalEntry, type JournalLine } from "../database/definitionsDb";

export interface InstallmentRecord {
  id: string; ownerType: "loan" | "credit"; ownerId: string; installmentNo: number;
  dueDate: string; amount: number; paidAmount?: number; status: "pending" | "paid"; paidAt?: string; journalEntryId?: string;
}
export interface CreditPurchaseRecord {
  id: string; platform: string; title: string; amount: number; installmentCount: number;
  firstDueDate: string; note?: string; createdAt: string;
}
export interface LoanInput {
  name: string; principal: number; installmentCount: number; firstDueDate: string;
  timing: "existing" | "current"; paidInstallments?: number; cashAccountId?: string; note?: string;
}
export interface CreditInput {
  platform: string; title: string; amount: number; installmentCount: number;
  firstDueDate: string; note?: string;
}

const moneyInt = (n: number) => Number.isSafeInteger(n) && n > 0;
const cashKinds = ["bank", "cash", "wallet"];
const cashCode = (id: string) => `cash:${id}`;
const loanCode = (id: string) => `loan:${id}:principal`;
const creditCode = (id: string) => `credit:${id}`;
const jalaliDate = (value: string) => {
  const d = parse(value.replace(/-/g, "/"), "yyyy/MM/dd", new Date());
  if (!isValid(d) || format(d, "yyyy/MM/dd") !== value.replace(/-/g, "/")) throw new Error("تاریخ سررسید را به شکل ۱۴۰۵/۰۱/۰۱ وارد کن.");
  return d;
};
const makeSchedule = (ownerType: InstallmentRecord["ownerType"], ownerId: string, total: number, count: number, firstDueDate: string): InstallmentRecord[] => {
  const start = jalaliDate(firstDueDate);
  const base = Math.floor(total / count);
  let allocated = 0;
  return Array.from({ length: count }, (_, i) => {
    const amount = i === count - 1 ? total - allocated : base;
    allocated += amount;
    return { id: crypto.randomUUID(), ownerType, ownerId, installmentNo: i + 1, dueDate: format(addMonths(start, i), "yyyy/MM/dd"), amount, status: "pending" };
  });
};
const nextDocNo = async () => ((await definitionsDb.journalEntries.orderBy("docNo").last())?.docNo || 0) + 1;
const makeEntry = (id: string, docNo: number, date: string, type: JournalEntry["type"], amount: number, description: string, extra: Partial<JournalEntry> = {}): JournalEntry => {
  const now = new Date().toISOString();
  return { id, docNo, date, type, amount, description, createdAt: now, updatedAt: now, status: "active", ...extra };
};
const linesFor = (entryId: string, debitCode: string, creditCode: string, amount: number, debitCashId?: string, creditCashId?: string): Omit<JournalLine, "id">[] => [
  { entryId, accountCode: debitCode, debit: amount, credit: 0, ...(debitCashId ? { cashAccountId: debitCashId } : {}) },
  { entryId, accountCode: creditCode, debit: 0, credit: amount, ...(creditCashId ? { cashAccountId: creditCashId } : {}) },
];

export async function createLoan(input: LoanInput): Promise<string> {
  if (!input.name.trim()) throw new Error("عنوان وام را وارد کن.");
  if (!moneyInt(input.principal)) throw new Error("اصل وام باید مبلغ صحیح و بیشتر از صفر باشد.");
  if (!Number.isInteger(input.installmentCount) || input.installmentCount < 1 || input.installmentCount > 600) throw new Error("تعداد اقساط معتبر نیست.");
  jalaliDate(input.firstDueDate);
  let cash: DefinitionRecord | undefined;
  if (input.timing === "current") {
    if (!input.cashAccountId) throw new Error("برای وام جدید، حساب دریافت وجه را انتخاب کن.");
    cash = await definitionsDb.definitions.get(input.cashAccountId);
    if (!cash || !cashKinds.includes(cash.kind)) throw new Error("حساب دریافت وجه معتبر نیست.");
  }
  const paidCount = input.timing === "existing" ? (input.paidInstallments || 0) : 0;
  if (!Number.isInteger(paidCount) || paidCount < 0 || paidCount > input.installmentCount) {
    throw new Error("تعداد اقساط پرداخت‌شده باید از صفر تا کمتر از کل اقساط باشد.");
  }
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const schedule = makeSchedule("loan", id, input.principal, input.installmentCount, input.firstDueDate);
  for (const item of schedule.slice(0, paidCount)) {
    item.status = "paid";
    item.paidAt = now;
  }
  const openingBalance = schedule.filter(item => item.status === "pending").reduce((sum, item) => sum + item.amount, 0);
  const loan: DefinitionRecord = {
    id, name: input.name.trim(), root: "liabilities", parentId: "liabilities", kind: "loan",
    createdAt: now, updatedAt: now, loanTiming: input.timing, principal: input.principal,
    installmentAmount: Math.ceil(input.principal / input.installmentCount),
    totalInstallments: input.installmentCount, paidInstallments: paidCount,
    firstDueDate: input.firstDueDate, affectsCashOnCreate: input.timing === "current", note: input.note?.trim(),
  };
  const entryId = crypto.randomUUID();
  const openingAmount = input.timing === "current" ? input.principal : openingBalance;
  const entry = makeEntry(entryId, await nextDocNo(), now, "loan_receive", openingAmount,
    input.timing === "current" ? `دریافت وام: ${input.name}` : `ثبت مانده وام قبلی: ${input.name}`,
    { loanId: id, cashAccountId: cash?.id });
  const lines = input.timing === "current"
    ? linesFor(entryId, cashCode(cash!.id), loanCode(id), input.principal, cash!.id)
    : linesFor(entryId, "opening:loan-balance", loanCode(id), openingBalance);
  await definitionsDb.transaction("rw", definitionsDb.definitions, definitionsDb.journalEntries, definitionsDb.journalLines, definitionsDb.installments, async () => {
    await definitionsDb.definitions.add(loan);
    await definitionsDb.journalEntries.add(entry);
    await definitionsDb.journalLines.bulkAdd(lines.map(line => ({ ...line, id: crypto.randomUUID() })));
    await definitionsDb.installments.bulkAdd(schedule);
  });
  return id;
}

export async function createCreditPurchase(input: CreditInput): Promise<string> {
  if (!input.platform.trim() || !input.title.trim()) throw new Error("نام پلتفرم و شرح خرید را وارد کن.");
  if (!moneyInt(input.amount)) throw new Error("مبلغ خرید باید صحیح و بیشتر از صفر باشد.");
  if (!Number.isInteger(input.installmentCount) || input.installmentCount < 1 || input.installmentCount > 600) throw new Error("تعداد اقساط معتبر نیست.");
  jalaliDate(input.firstDueDate);
  const id = crypto.randomUUID(); const now = new Date().toISOString();
  const purchase: CreditPurchaseRecord = { id, platform: input.platform.trim(), title: input.title.trim(), amount: input.amount, installmentCount: input.installmentCount, firstDueDate: input.firstDueDate, note: input.note?.trim(), createdAt: now };
  const entryId = crypto.randomUUID();
  const entry = makeEntry(entryId, await nextDocNo(), new Date().toISOString(), "credit_purchase", input.amount, `خرید اعتباری ${purchase.platform}: ${purchase.title}`, { purchaseId: id, platform: purchase.platform });
  const schedule = makeSchedule("credit", id, input.amount, input.installmentCount, input.firstDueDate);
  await definitionsDb.transaction("rw", definitionsDb.creditPurchases, definitionsDb.journalEntries, definitionsDb.journalLines, definitionsDb.installments, async () => {
    await definitionsDb.creditPurchases.add(purchase);
    await definitionsDb.journalEntries.add(entry);
    await definitionsDb.journalLines.bulkAdd(linesFor(entryId, "expense:credit-purchase", creditCode(id), input.amount).map(l => ({ ...l, id: crypto.randomUUID() })));
    await definitionsDb.installments.bulkAdd(schedule);
  });
  return id;
}

export async function payInstallmentPartial(installmentId: string, cashAccountId: string, paymentAmount: number, paymentDate = new Date().toISOString(), descriptionOverride?: string, bankFee = 0): Promise<void> {
  if (!Number.isSafeInteger(bankFee) || bankFee < 0) throw new Error("کارمزد باید عدد صحیح و نامنفی باشد.");
  if (!Number.isSafeInteger(paymentAmount) || paymentAmount <= 0) throw new Error("مبلغ پرداخت باید عدد صحیح و بیشتر از صفر باشد.");
  const installment = await definitionsDb.installments.get(installmentId);
  if (!installment || installment.status !== "pending") throw new Error("قسط پرداخت‌نشده پیدا نشد.");
  const alreadyPaid = installment.paidAmount || 0;
  const remaining = installment.amount - alreadyPaid;
  if (paymentAmount > remaining) throw new Error("مبلغ پرداخت از مانده قسط بیشتر است.");
  const cash = await definitionsDb.definitions.get(cashAccountId);
  if (!cash || !cashKinds.includes(cash.kind)) throw new Error("حساب پرداخت معتبر نیست.");
  const isLoan = installment.ownerType === "loan";
  const owner = isLoan ? await definitionsDb.definitions.get(installment.ownerId) : await definitionsDb.creditPurchases.get(installment.ownerId);
  if (!owner) throw new Error("پرونده وام یا خرید اعتباری پیدا نشد.");
  const entryId = crypto.randomUUID(); const docNo = await nextDocNo();
  const label = isLoan ? (owner as DefinitionRecord).name : (owner as CreditPurchaseRecord).title;
  const newPaid = alreadyPaid + paymentAmount;
  const fullyPaid = newPaid === installment.amount;
  const entry = makeEntry(entryId, docNo, paymentDate, isLoan ? "loan_payment" : "credit_payment", paymentAmount,
    descriptionOverride?.trim() || `پرداخت ${fullyPaid ? "کامل" : "جزئی"} قسط ${installment.installmentNo}: ${label}`,
    { loanId: isLoan ? installment.ownerId : undefined, purchaseId: isLoan ? undefined : installment.ownerId, cashAccountId: cash.id, installmentId, fee: bankFee });
  const liabilityCode = isLoan ? loanCode(installment.ownerId) : creditCode(installment.ownerId);
  await definitionsDb.transaction("rw", definitionsDb.journalEntries, definitionsDb.journalLines, definitionsDb.installments, definitionsDb.definitions, async () => {
    const current = await definitionsDb.installments.get(installmentId);
    if (!current || current.status !== "pending" || (current.paidAmount || 0) !== alreadyPaid) throw new Error("وضعیت قسط تغییر کرده؛ اطلاعات را تازه‌سازی کن.");
    await definitionsDb.journalEntries.add(entry);
    const paymentLines = linesFor(entryId, liabilityCode, cashCode(cash.id), paymentAmount, undefined, cash.id);
    if (bankFee) {
      paymentLines[1].credit = paymentAmount + bankFee;
      paymentLines.push({ entryId, accountCode: "expense:bank-fee", debit: bankFee, credit: 0 });
    }
    await definitionsDb.journalLines.bulkAdd(paymentLines.map(l => ({ ...l, id: crypto.randomUUID() })));
    await definitionsDb.installments.update(installment.id, { paidAmount: newPaid, status: fullyPaid ? "paid" : "pending", ...(fullyPaid ? { paidAt: new Date().toISOString(), journalEntryId: entryId } : {}) });
    if (isLoan && fullyPaid) {
      const loan = owner as DefinitionRecord;
      await definitionsDb.definitions.update(loan.id, { paidInstallments: (loan.paidInstallments || 0) + 1, updatedAt: new Date().toISOString() });
    }
  });
}

export async function payInstallment(installmentId: string, cashAccountId: string, paymentDate = new Date().toISOString(), descriptionOverride?: string): Promise<void> {
  const installment = await definitionsDb.installments.get(installmentId);
  if (!installment || installment.status !== "pending") throw new Error("قسط پرداخت‌نشده پیدا نشد.");
  await payInstallmentPartial(installmentId, cashAccountId, installment.amount - (installment.paidAmount || 0), paymentDate, descriptionOverride);
}

export interface UpdateLoanInput {
  name: string; principal: number; installmentCount: number; firstDueDate: string; note?: string;
}

export async function updateLoan(loanId: string, input: UpdateLoanInput): Promise<void> {
  if (!input.name.trim()) throw new Error("عنوان وام را وارد کن.");
  if (!moneyInt(input.principal)) throw new Error("اصل وام باید مبلغ صحیح و بیشتر از صفر باشد.");
  if (!Number.isInteger(input.installmentCount) || input.installmentCount < 1 || input.installmentCount > 600) throw new Error("تعداد اقساط معتبر نیست.");
  jalaliDate(input.firstDueDate);
  const loan = await definitionsDb.definitions.get(loanId);
  if (!loan || loan.kind !== "loan") throw new Error("پرونده وام پیدا نشد.");
  const rows = await definitionsDb.installments.where("ownerId").equals(loanId).toArray();
  const paidRows = rows.filter(x => x.status === "paid").sort((a,b)=>a.installmentNo-b.installmentNo);
  const pendingRows = rows.filter(x => x.status === "pending").sort((a,b)=>a.installmentNo-b.installmentNo);
  if (input.installmentCount < paidRows.length) throw new Error("تعداد کل اقساط نمی‌تواند کمتر از اقساط پرداخت‌شده باشد.");
  const paidAmount = paidRows.reduce((sum,x)=>sum+x.amount,0);
  if (input.principal < paidAmount || (input.principal === paidAmount && input.installmentCount > paidRows.length)) throw new Error("اصل وام باید حداقل برابر مجموع اقساط پرداخت‌شده باشد و برای مانده بدهی قسط باقی‌مانده تعریف شود.");
  const remainingAmount = input.principal - paidAmount;
  const remainingCount = input.installmentCount - paidRows.length;
  if (remainingCount === 0 && remainingAmount !== 0) throw new Error("برای مانده بدهی، تعداد اقساط باقی‌مانده باید بیشتر از صفر باشد.");
  const openingEntry = await definitionsDb.journalEntries.where("loanId").equals(loanId).first();
  if (!openingEntry) throw new Error("سند افتتاحیه وام پیدا نشد؛ برای جلوگیری از مغایرت، ویرایش متوقف شد.");
  const newSchedule = remainingCount ? makeSchedule("loan", loanId, remainingAmount, remainingCount, input.firstDueDate) : [];
  const now = new Date().toISOString();
  await definitionsDb.transaction("rw", definitionsDb.definitions, definitionsDb.installments, definitionsDb.journalEntries, definitionsDb.journalLines, async () => {
    await definitionsDb.definitions.update(loanId, {
      name: input.name.trim(), principal: input.principal,
      installmentAmount: remainingCount ? Math.ceil(remainingAmount / remainingCount) : 0,
      totalInstallments: input.installmentCount, paidInstallments: paidRows.length,
      firstDueDate: input.firstDueDate, note: input.note?.trim(), updatedAt: now,
    });
    for (let i=0; i<newSchedule.length; i++) {
      const next = newSchedule[i];
      const old = pendingRows[i];
      if (old) await definitionsDb.installments.update(old.id, { installmentNo: paidRows.length+i+1, dueDate: next.dueDate, amount: next.amount });
      else await definitionsDb.installments.add({ ...next, installmentNo: paidRows.length+i+1 });
    }
    if (pendingRows.length > newSchedule.length) {
      await definitionsDb.installments.bulkDelete(pendingRows.slice(newSchedule.length).map(x=>x.id));
    }
    await definitionsDb.journalEntries.update(openingEntry.id, {
      amount: loan.loanTiming === "current" ? input.principal : remainingAmount,
      description: loan.loanTiming === "current" ? `دریافت وام: ${input.name.trim()}` : `ثبت مانده وام قبلی: ${input.name.trim()}`,
      updatedAt: now,
    });
    const lines = await definitionsDb.journalLines.where("entryId").equals(openingEntry.id).toArray();
    if (lines.length !== 2) throw new Error("ساختار سند افتتاحیه وام معتبر نیست؛ تغییری ثبت نشد.");
    const liabilityLine = lines.find(x=>x.accountCode===loanCode(loanId));
    const amountLine = lines.find(x=>x.id!==liabilityLine?.id);
    if (!liabilityLine || !amountLine) throw new Error("ردیف بدهی سند افتتاحیه پیدا نشد؛ تغییری ثبت نشد.");
    const journalAmount = loan.loanTiming === "current" ? input.principal : remainingAmount;
    await definitionsDb.journalLines.update(liabilityLine.id, { credit: journalAmount, debit: 0 });
    await definitionsDb.journalLines.update(amountLine.id, {
      debit: journalAmount, credit: 0,
      accountCode: loan.loanTiming === "current" ? amountLine.accountCode : "opening:loan-balance",
    });
  });
}

export async function updateCreditPurchase(purchaseId: string, input: CreditInput): Promise<void> {
  if (!input.platform.trim() || !input.title.trim()) throw new Error("نام پلتفرم و شرح خرید را وارد کن.");
  if (!moneyInt(input.amount)) throw new Error("مبلغ خرید باید صحیح و بیشتر از صفر باشد.");
  if (!Number.isInteger(input.installmentCount) || input.installmentCount < 1 || input.installmentCount > 600) throw new Error("تعداد اقساط معتبر نیست.");
  jalaliDate(input.firstDueDate);

  const purchase = await definitionsDb.creditPurchases.get(purchaseId);
  if (!purchase) throw new Error("پرونده خرید پیدا نشد.");

  const rows = await definitionsDb.installments.where("ownerId").equals(purchaseId).toArray();
  const paidRows = rows.filter(x => x.status === "paid").sort((a,b)=>a.installmentNo-b.installmentNo);
  const pendingRows = rows.filter(x => x.status === "pending").sort((a,b)=>a.installmentNo-b.installmentNo);

  if (input.installmentCount < paidRows.length) throw new Error("تعداد کل اقساط نمی‌تواند کمتر از اقساط پرداخت‌شده باشد.");
  const paidAmount = paidRows.reduce((sum,x)=>sum+x.amount,0);
  if (input.amount < paidAmount) throw new Error("مبلغ خرید نمی‌تواند کمتر از مجموع اقساط پرداخت‌شده باشد.");

  const remainingAmount = input.amount - paidAmount;
  const remainingCount = input.installmentCount - paidRows.length;

  if (remainingCount === 0 && remainingAmount !== 0) throw new Error("برای مانده بدهی، تعداد اقساط باقی‌مانده باید بیشتر از صفر باشد.");

  const openingEntry = await definitionsDb.journalEntries.where("purchaseId").equals(purchaseId).first();
  if (!openingEntry) throw new Error("سند افتتاحیه خرید پیدا نشد؛ برای جلوگیری از مغایرت، ویرایش متوقف شد.");

  const newSchedule = remainingCount ? makeSchedule("credit", purchaseId, remainingAmount, remainingCount, input.firstDueDate) : [];
  const now = new Date().toISOString();

  await definitionsDb.transaction("rw", definitionsDb.creditPurchases, definitionsDb.installments, definitionsDb.journalEntries, definitionsDb.journalLines, async () => {
    await definitionsDb.creditPurchases.update(purchaseId, {
      platform: input.platform.trim(),
      title: input.title.trim(),
      amount: input.amount,
      installmentCount: input.installmentCount,
      firstDueDate: input.firstDueDate,
      note: input.note?.trim(),
    });

    for (let i=0; i<newSchedule.length; i++) {
      const next = newSchedule[i];
      const old = pendingRows[i];
      if (old) await definitionsDb.installments.update(old.id, { installmentNo: paidRows.length+i+1, dueDate: next.dueDate, amount: next.amount });
      else await definitionsDb.installments.add({ ...next, installmentNo: paidRows.length+i+1 });
    }
    if (pendingRows.length > newSchedule.length) {
      await definitionsDb.installments.bulkDelete(pendingRows.slice(newSchedule.length).map(x=>x.id));
    }

    await definitionsDb.journalEntries.update(openingEntry.id, {
      amount: input.amount,
      description: `خرید اعتباری ${input.platform.trim()}: ${input.title.trim()}`,
      updatedAt: now,
    });

    const lines = await definitionsDb.journalLines.where("entryId").equals(openingEntry.id).toArray();
    const liabilityLine = lines.find(x=>x.accountCode===creditCode(purchaseId));
    const expenseLine = lines.find(x=>x.id!==liabilityLine?.id);
    if (!liabilityLine || !expenseLine) throw new Error("ردیف سند افتتاحیه خرید پیدا نشد؛ تغییری ثبت نشد.");
    await definitionsDb.journalLines.update(liabilityLine.id, { credit: input.amount, debit: 0 });
    await definitionsDb.journalLines.update(expenseLine.id, { debit: input.amount, credit: 0 });
  });
}

export async function getLoanAndCreditData() {
  const [loans, purchases, installments, accounts] = await Promise.all([
    definitionsDb.definitions.where("kind").equals("loan").toArray(),
    definitionsDb.creditPurchases.toArray(), definitionsDb.installments.toArray(), definitionsDb.definitions.toArray(),
  ]);
  return { loans, purchases, installments, accounts: accounts.filter(a => cashKinds.includes(a.kind)) };
}

export async function deleteLoan(loanId: string): Promise<void> {
  const loan = await definitionsDb.definitions.get(loanId);
  if (!loan || loan.kind !== "loan") throw new Error("پرونده وام پیدا نشد.");

  const linkedEntries = await definitionsDb.journalEntries.where("loanId").equals(loanId).toArray();
  const linkedEntryIds = linkedEntries.map(entry => entry.id);
  const linkedLines = linkedEntryIds.length
    ? await definitionsDb.journalLines.where("entryId").anyOf(linkedEntryIds).toArray()
    : [];
  const hasBankMovement = linkedEntries.some(entry => entry.status !== "void" && !!entry.cashAccountId)
    || linkedLines.some(line => !!line.cashAccountId);

  if (hasBankMovement) {
    throw new Error("به علت ثبت تراکنش بانکی برای این وام، امکان حذف آن وجود ندارد.");
  }

  await definitionsDb.transaction("rw", definitionsDb.definitions, definitionsDb.installments, definitionsDb.journalEntries, definitionsDb.journalLines, async () => {
    const currentEntries = await definitionsDb.journalEntries.where("loanId").equals(loanId).toArray();
    const currentIds = currentEntries.map(entry => entry.id);
    const currentLines = currentIds.length
      ? await definitionsDb.journalLines.where("entryId").anyOf(currentIds).toArray()
      : [];
    if (currentEntries.some(entry => entry.status !== "void" && !!entry.cashAccountId) || currentLines.some(line => !!line.cashAccountId)) {
      throw new Error("به علت ثبت تراکنش بانکی برای این وام، امکان حذف آن وجود ندارد.");
    }
    await definitionsDb.installments.where("ownerId").equals(loanId).delete();
    if (currentIds.length) {
      await definitionsDb.journalLines.where("entryId").anyOf(currentIds).delete();
      await definitionsDb.journalEntries.where("loanId").equals(loanId).delete();
    }
    await definitionsDb.definitions.delete(loanId);
  });
}

export async function deleteCreditPurchase(purchaseId: string): Promise<void> {
  const purchase = await definitionsDb.creditPurchases.get(purchaseId);
  if (!purchase) throw new Error("پرونده خرید پیدا نشد.");

  const linkedEntries = await definitionsDb.journalEntries.where("purchaseId").equals(purchaseId).toArray();
  const linkedEntryIds = linkedEntries.map(entry => entry.id);
  const linkedLines = linkedEntryIds.length
    ? await definitionsDb.journalLines.where("entryId").anyOf(linkedEntryIds).toArray()
    : [];
  const hasBankMovement = linkedEntries.some(entry => entry.status !== "void" && !!entry.cashAccountId)
    || linkedLines.some(line => !!line.cashAccountId);

  if (hasBankMovement) {
    throw new Error("به علت ثبت تراکنش بانکی برای این خرید، امکان حذف آن وجود ندارد.");
  }

  await definitionsDb.transaction("rw", definitionsDb.creditPurchases, definitionsDb.installments, definitionsDb.journalEntries, definitionsDb.journalLines, async () => {
    const currentEntries = await definitionsDb.journalEntries.where("purchaseId").equals(purchaseId).toArray();
    const currentIds = currentEntries.map(entry => entry.id);
    const currentLines = currentIds.length
      ? await definitionsDb.journalLines.where("entryId").anyOf(currentIds).toArray()
      : [];
    if (currentEntries.some(entry => entry.status !== "void" && !!entry.cashAccountId) || currentLines.some(line => !!line.cashAccountId)) {
      throw new Error("به علت ثبت تراکنش بانکی برای این خرید، امکان حذف آن وجود ندارد.");
    }
    await definitionsDb.installments.where("ownerId").equals(purchaseId).delete();
    if (currentIds.length) {
      await definitionsDb.journalLines.where("entryId").anyOf(currentIds).delete();
      await definitionsDb.journalEntries.where("purchaseId").equals(purchaseId).delete();
    }
    await definitionsDb.creditPurchases.delete(purchaseId);
  });
}