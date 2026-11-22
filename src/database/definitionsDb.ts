import Dexie, { type Table } from "dexie";

export type RootGroup = "assets" | "liabilities" | "income" | "expenses";
export type DefinitionKind = "category" | "account" | "bank" | "cash" | "wallet" | "person" | "loan" | "credit_card" | "platform";

export interface DefinitionRecord {
  id: string;
  name: string;
  root: RootGroup;
  parentId: string | null;
  kind: DefinitionKind;
  createdAt: string;
  updatedAt: string;
  bankName?: string;
  cardNumber?: string;
  accountNumber?: string;
  iban?: string;
  initialBalance?: number;
  initialBalanceDate?: string;
  loanTiming?: "existing" | "current";
  principal?: number;
  installmentAmount?: number;
  totalInstallments?: number;
  paidInstallments?: number;
  firstDueDate?: string;
  affectsCashOnCreate?: boolean;
  note?: string;
  personRole?: "creditor" | "debtor" | "both";
}

export interface JournalEntry {
  id: string;
  docNo?: number;
  date: string;
  type: string; // "income" | "expense" | "transfer" | "loan_receive" | "loan_payment" | "credit_purchase" | "credit_payment" | "lend" | "borrow" | "collect" | "repay" | "offset"
  amount: number;
  fee?: number;
  description: string;
  cashAccountId?: string;
  fromAccountId?: string;
  toAccountId?: string;
  categoryId?: string;
  personId?: string;
  loanId?: string;
  purchaseId?: string;
  platform?: string;
  installmentId?: string;
  createdAt: string;
  updatedAt: string;
  status: "active" | "void";
  voidReason?: string;
  isTest?: boolean;
}

export interface JournalLine {
  id: string;
  entryId: string;
  accountCode: string;
  debit: number;
  credit: number;
  personId?: string;
  cashAccountId?: string;
}

export interface BudgetRecord {
  id: string;
  period: string;
  definitionId: string;
  amount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AttachmentRecord {
  id: string;
  transactionId: string;
  name: string;
  mimeType: string;
  size: number;
  blob: Blob;
  createdAt: string;
}

export interface InstallmentRecord {
  id: string;
  ownerType: "loan" | "credit";
  ownerId: string;
  installmentNo: number;
  dueDate: string;
  amount: number;
  paidAmount?: number;
  status: "pending" | "paid";
  paidAt?: string;
  journalEntryId?: string;
}

export interface CreditPurchaseRecord {
  id: string;
  platform: string;
  title: string;
  amount: number;
  installmentCount: number;
  firstDueDate: string;
  note?: string;
  createdAt: string;
}

// اینترفیس جدید برای اهداف مالی
export interface GoalRecord {
  id: string;
  title: string;
  targetAmount: number;
  savedAmount: number;
  deadline: string; // Jalali yyyy/MM/dd
  color: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

class DarmaDefinitionsDB extends Dexie {
  definitions!: Table<DefinitionRecord>;
  journalEntries!: Table<JournalEntry>;
  journalLines!: Table<JournalLine>;
  installments!: Table<InstallmentRecord>;
  creditPurchases!: Table<CreditPurchaseRecord>;
  budgets!: Table<BudgetRecord>;
  attachments!: Table<AttachmentRecord>;
  financialGoals!: Table<GoalRecord>; // جدول جدید

  constructor() {
    super("DARMA_DB");
    this.version(1).stores({
      definitions: "id, root, parentId, kind, name, updatedAt",
    });
    this.version(2).stores({
      definitions: "id, root, parentId, kind, name, updatedAt",
      journalEntries: "id, date, type, personId, cashAccountId, createdAt",
      journalLines: "id, entryId, accountCode, personId, cashAccountId",
    });
    this.version(3).stores({
      definitions: "id, root, parentId, kind, name, updatedAt",
      journalEntries: "id, date, type, personId, cashAccountId, createdAt, status",
      journalLines: "id, entryId, accountCode, personId, cashAccountId",
    }).upgrade(async tx => {
      const table = tx.table("journalEntries");
      const entries = await table.toArray();
      entries.sort((a, b) => String(a.createdAt || a.date).localeCompare(String(b.createdAt || b.date)));
      for (let i = 0; i < entries.length; i++) {
        await table.update(entries[i].id, { docNo: i + 1, status: entries[i].status || "active" });
      }
    });
    this.version(4).stores({
      definitions: "id, root, parentId, kind, name, updatedAt",
      journalEntries: "id, date, type, personId, cashAccountId, fromAccountId, toAccountId, categoryId, createdAt, status, docNo",
      journalLines: "id, entryId, accountCode, personId, cashAccountId",
    });
    this.version(5).stores({
      definitions: "id, root, parentId, kind, name, updatedAt",
      journalEntries: "id, date, type, personId, cashAccountId, fromAccountId, toAccountId, categoryId, createdAt, status, docNo, loanId, purchaseId, installmentId",
      journalLines: "id, entryId, accountCode, personId, cashAccountId",
      installments: "id, ownerType, ownerId, installmentNo, dueDate, status",
      creditPurchases: "id, platform, title, createdAt",
    });
    this.version(6).stores({
      definitions: "id, root, parentId, kind, name, updatedAt",
      journalEntries: "id, date, type, personId, cashAccountId, fromAccountId, toAccountId, categoryId, createdAt, status, docNo, loanId, purchaseId, installmentId",
      journalLines: "id, entryId, accountCode, personId, cashAccountId",
      installments: "id, ownerType, ownerId, installmentNo, dueDate, status",
      creditPurchases: "id, platform, title, createdAt",
      budgets: "id, period, definitionId, [period+definitionId]",
      attachments: "id, transactionId, createdAt",
    });
    // نسخه ۷ برای اضافه کردن اهداف مالی
    this.version(7).stores({
      definitions: "id, root, parentId, kind, name, updatedAt",
      journalEntries: "id, date, type, personId, cashAccountId, fromAccountId, toAccountId, categoryId, createdAt, status, docNo, loanId, purchaseId, installmentId",
      journalLines: "id, entryId, accountCode, personId, cashAccountId",
      installments: "id, ownerType, ownerId, installmentNo, dueDate, status",
      creditPurchases: "id, platform, title, createdAt",
      budgets: "id, period, definitionId, [period+definitionId]",
      attachments: "id, transactionId, createdAt",
      financialGoals: "id, title, deadline, createdAt",
    });
  }
}

export const definitionsDb = new DarmaDefinitionsDB();

export const ROOTS: { id: RootGroup; name: string; kind: "asset" | "liability" | "income" | "expense" }[] = [
  { id: "assets", name: "دارایی‌ها", kind: "asset" },
  { id: "liabilities", name: "بدهی‌ها", kind: "liability" },
  { id: "income", name: "درآمدها", kind: "income" },
  { id: "expenses", name: "هزینه‌ها", kind: "expense" },
];

export async function seedRootCategories() {
  const now = new Date().toISOString();
  await definitionsDb.transaction("rw", definitionsDb.definitions, async () => {
    for (const root of ROOTS) {
      const exists = await definitionsDb.definitions.get(root.id);
      if (!exists) {
        await definitionsDb.definitions.put({
          id: root.id, name: root.name, root: root.id, parentId: null,
          kind: "category", createdAt: now, updatedAt: now,
        });
      }
    }
  });
}