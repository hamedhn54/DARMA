import { getLedgerSummary } from "../transactionService";
import { getLoanAndCreditData } from "../loansCreditService";
import { getBudgets } from "../budgetService";
import { getGoals } from "../goalService";

export async function getFinancialContext(): Promise<string> {
  const [summary, loans, budgets, goals] = await Promise.all([
    getLedgerSummary(),
    getLoanAndCreditData(),
    getBudgets(),
    getGoals()
  ]);

  const pendingInstallments = loans.installments.filter(i => i.status === "pending");
  const totalInstallmentAmount = pendingInstallments.reduce((s, i) => s + i.amount - (i.paidAmount || 0), 0);
  
  const context = {
    موجودی_کل_حسابها: summary.cashTotal,
    درآمد_کل: summary.incomeTotal,
    هزینه_کل: summary.expenseTotal,
    درآمد_ماه_جاری: summary.monthlyIncome,
    هزینه_ماه_جاری: summary.monthlyExpense,
    مانده_اقساط: totalInstallmentAmount,
    تعداد_اقساط_باقیمانده: pendingInstallments.length,
    بودجه‌های_تعریف_شده: budgets.map(b => ({ دسته: b.definition.name, بودجه: b.amount, مصرف‌شده: b.spent })),
    اهداف_مالی: goals.map(g => ({ عنوان: g.title, هدف: g.targetAmount, پس‌انداز: g.savedAmount }))
  };

  return JSON.stringify(context, null, 2);
}