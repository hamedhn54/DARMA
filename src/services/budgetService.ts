import { format } from "date-fns-jalali";
import { definitionsDb, type BudgetRecord, type DefinitionRecord } from "../database/definitionsDb";

export interface BudgetView extends BudgetRecord { definition: DefinitionRecord; spent: number; remaining: number; percent: number }
const periodNow = () => format(new Date(), "yyyy-MM");

export async function getBudgets(period = periodNow()): Promise<BudgetView[]> {
  const [budgets, definitions, entries] = await Promise.all([
    definitionsDb.budgets.where("period").equals(period).toArray(),
    definitionsDb.definitions.toArray(),
    definitionsDb.journalEntries.toArray(),
  ]);
  return budgets.map(b => {
    const definition = definitions.find(d => d.id === b.definitionId);
    if (!definition) return null;
    
    // پیدا کردن تمام زیرمجموعه‌های این دسته (تفصیلی‌ها)
    const ids = new Set<string>([definition.id]);
    let frontier = [definition.id];
    while (frontier.length) {
      const children = definitions.filter(d => !!d.parentId && frontier.includes(d.parentId)).map(d => d.id);
      children.forEach(id => ids.add(id));
      frontier = children;
    }
    
    const expectedType = definition.root === "income" ? "income" : "expense";
    const spent = entries.filter(e => e.status !== "void" && e.type === expectedType && format(new Date(e.date), "yyyy-MM") === period && !!e.categoryId && ids.has(e.categoryId)).reduce((sum, e) => sum + e.amount, 0);
    
    return { ...b, definition, spent, remaining: b.amount - spent, percent: b.amount ? Math.round(spent / b.amount * 100) : 0 };
  }).filter((x): x is BudgetView => !!x).sort((a,b) => a.definition.name.localeCompare(b.definition.name, "fa"));
}

export async function saveBudget(definitionId: string, amount: number, period = periodNow()): Promise<void> {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new Error("فرمت ماه نامعتبر است.");
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("مبلغ بودجه باید عدد صحیح و بیشتر از صفر باشد.");
  const definition = await definitionsDb.definitions.get(definitionId);
  if (!definition || definition.kind === "person" || definition.kind === "loan" || !["income", "expenses"].includes(definition.root)) throw new Error("فقط دسته‌بندی درآمد یا هزینه قابل بودجه‌بندی است.");
  
  const existing = await definitionsDb.budgets.where("[period+definitionId]").equals([period, definitionId]).first();
  const now = new Date().toISOString();
  const record: BudgetRecord = { id: existing?.id || crypto.randomUUID(), period, definitionId, amount, createdAt: existing?.createdAt || now, updatedAt: now };
  await definitionsDb.budgets.put(record);
}

export async function deleteBudget(id: string): Promise<void> { 
  await definitionsDb.budgets.delete(id); 
}

export async function copyBudgetsFromPreviousMonth(toPeriod: string): Promise<number> {
  const [year, month] = toPeriod.split("-").map(Number);
  let prevYear = year;
  let prevMonth = month - 1;
  if (prevMonth === 0) { prevMonth = 12; prevYear -= 1; }
  const prevPeriod = `${prevYear}-${String(prevMonth).padStart(2, "0")}`;
  
  const prevBudgets = await definitionsDb.budgets.where("period").equals(prevPeriod).toArray();
  let count = 0;
  for (const b of prevBudgets) {
    const existing = await definitionsDb.budgets.where("[period+definitionId]").equals([toPeriod, b.definitionId]).first();
    if (!existing) {
      await saveBudget(b.definitionId, b.amount, toPeriod);
      count++;
    }
  }
  return count;
}

export { periodNow };