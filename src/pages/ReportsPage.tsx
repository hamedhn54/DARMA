import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, ChartNoAxesCombined, Wallet, CalendarClock, HandCoins, Printer, FileDown } from "lucide-react";
import { definitionsDb, type JournalEntry } from "../database/definitionsDb";
import { getFinancialTransactions } from "../services/transactionService";
import { getLoanAndCreditData, type InstallmentRecord } from "../services/loansCreditService";
import { getBudgets, type BudgetView } from "../services/budgetService";
import JalaliDateField from "../components/JalaliDateField";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import "./ReportsPage.css";

const money = (n: number) => new Intl.NumberFormat("fa-IR").format(Math.round(n));
const COLORS = ["#279b79", "#d5a85b", "#6487c8", "#cf7373", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

export default function ReportsPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [installments, setInstallments] = useState<InstallmentRecord[]>([]);
  const [budgets, setBudgets] = useState<BudgetView[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  
  // فیلتر تاریخ شمسی (پیش‌فرض: ۳۰ روز اخیر)
  const [startDate, setStartDate] = useState<Date>(new Date(new Date().setDate(new Date().getDate() - 30)));
  const [endDate, setEndDate] = useState<Date>(new Date());

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const [e, loanData, b, defs] = await Promise.all([
        getFinancialTransactions(), 
        getLoanAndCreditData(), 
        getBudgets(),
        definitionsDb.definitions.toArray()
      ]);
      setEntries(e.filter(x => x.status !== "void"));
      setInstallments(loanData.installments.filter(x => x.status === "pending"));
      setBudgets(b);
      setCategories(defs.filter(d => d.kind !== "person"));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  // فیلتر کردن تراکنش‌ها بر اساس بازه تاریخ
  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      const d = new Date(e.date);
      return d >= new Date(startDate.setHours(0,0,0,0)) && d <= new Date(endDate.setHours(23,59,59,999));
    });
  }, [entries, startDate, endDate]);

  // محاسبات بر اساس تراکنش‌های فیلترشده
  const totalIncome = filteredEntries.filter(e => e.type === "income").reduce((s, e) => s + e.amount, 0);
  const totalExpense = filteredEntries.filter(e => e.type === "expense" || e.type === "credit_purchase").reduce((s, e) => s + e.amount, 0);
  
  const expenseMap = new Map<string, number>();
  for (const entry of filteredEntries.filter(e => e.type === "expense" || e.type === "credit_purchase")) {
    const category = entry.type === "credit_purchase" ? "خریدهای اعتباری" : categories.find(d => d.id === entry.categoryId)?.name || "سایر";
    expenseMap.set(category, (expenseMap.get(category) || 0) + entry.amount);
  }
  
  const pieData = Array.from(expenseMap.entries()).map(([name, value]) => ({ name, value }));
  if (pieData.length === 0) pieData.push({ name: "بدون هزینه", value: 1 });
  
  const barData = [
    { name: "درآمد", amount: totalIncome },
    { name: "هزینه", amount: totalExpense }
  ];

  const pendingTotal = installments.reduce((s, x) => s + x.amount - (x.paidAmount || 0), 0);
  const nextDue = [...installments].sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 8);
  
  const budgetTotal = budgets.reduce((s, x) => s + x.amount, 0);
  const budgetSpent = budgets.reduce((s, x) => s + x.spent, 0);

  // تابع خروجی اکسل (CSV)
  const exportToExcel = () => {
    const rows = [
      ["نوع", "شرح", "تاریخ", "مبلغ (ریال)"],
      ...filteredEntries.map(e => [
        e.type === "income" ? "دریافت" : e.type === "expense" ? "پرداخت" : "انتقال",
        e.description,
        new Intl.DateTimeFormat("fa-IR").format(new Date(e.date)),
        e.amount
      ])
    ];
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + rows.map(r => r.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `DARMA-Report-${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <main className="rp-page" dir="rtl">
      <header className="rp-heading no-print">
        <div>
          <span>تحلیل داده‌های واقعی دفترکل</span>
          <h1>گزارش‌های مالی</h1>
          <p>اسناد باطل‌شده از محاسبات حذف می‌شوند؛ مبالغ به ریال نمایش داده می‌شوند.</p>
        </div>
        <div className="rp-actions">
          <button onClick={() => window.print()} className="btn-print"><Printer size={16}/> چاپ گزارش</button>
          <button onClick={exportToExcel} className="btn-excel"><FileDown size={16}/> خروجی اکسل</button>
          <button onClick={() => void refresh()} disabled={busy}><RefreshCw size={16}/> {busy ? "بروزرسانی..." : "به‌روزرسانی"}</button>
        </div>
      </header>

      {/* فیلتر تاریخ */}
      <section className="rp-filters no-print">
        <div className="rp-filter-group">
          <label>از تاریخ:</label>
          <JalaliDateField value={startDate} onChange={setStartDate} label="" />
        </div>
        <div className="rp-filter-group">
          <label>تا تاریخ:</label>
          <JalaliDateField value={endDate} onChange={setEndDate} label="" />
        </div>
      </section>

      <section className="rp-summary">
        <article><span>کل درآمد بازه</span><b>{money(totalIncome)} ریال</b></article>
        <article><span>کل هزینه بازه</span><b>{money(totalExpense)} ریال</b></article>
        <article><span>خالص درآمد و هزینه</span><b>{money(totalIncome - totalExpense)} ریال</b></article>
        <article><span>مانده کل اقساط</span><b>{money(pendingTotal)} ریال</b></article>
      </section>

      {/* نمودارها */}
      <section className="rp-charts">
        <article className="rp-panel">
          <h2><ChartNoAxesCombined size={17}/> مقایسه درآمد و هزینه</h2>
          <div style={{ width: '100%', height: 250, marginTop: 20 }}>
            <ResponsiveContainer>
              <BarChart data={barData} margin={{ top: 10, right: 20, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                <XAxis dataKey="name" tick={{ fill: 'var(--text)' }} />
                <YAxis tick={{ fill: 'var(--text)' }} tickFormatter={(val) => `‎${val / 1000}k`} />
                <Tooltip formatter={(val: any) => [`${money(val)} ریال`, ""]} contentStyle={{ borderRadius: 8, border: 'none', backgroundColor: 'var(--surface)', color: 'var(--text)' }} />
                <Bar dataKey="amount" fill="var(--green)" radius={[6, 6, 0, 0]} maxBarSize={60} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="rp-panel">
          <h2><Wallet size={17}/> ترکیب هزینه‌ها</h2>
          <div style={{ width: '100%', height: 250, display: 'flex', alignItems: 'center' }}>
            <ResponsiveContainer width="60%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                  {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(val: any) => `${money(val)} ریال`} contentStyle={{ borderRadius: 8, border: 'none', backgroundColor: 'var(--surface)', color: 'var(--text)' }} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ width: '40%', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pieData.slice(0, 6).map((item, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS[idx % COLORS.length] }}></span>
                  <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</span>
                  <b style={{ color: 'var(--muted)' }}>{money(item.value)}</b>
                </div>
              ))}
            </div>
          </div>
        </article>
      </section>

      {/* تعهدات و بودجه */}
      <section className="rp-grid">
        <article className="rp-panel">
          <h2><CalendarClock size={17}/> سررسیدهای پیش‌رو</h2>
          {nextDue.length ? nextDue.map(x => (
            <div className="rp-account" key={x.id}>
              <span>قسط {new Intl.NumberFormat("fa-IR").format(x.installmentNo)} · {x.dueDate}</span>
              <b>{money(x.amount - (x.paidAmount || 0))} ریال</b>
            </div>
          )) : <p className="rp-empty">قسط پرداخت‌نشده‌ای وجود ندارد.</p>}
        </article>

        <article className="rp-panel">
          <h2><HandCoins size={17}/> عملکرد بودجه ماه جاری</h2>
          <div className="rp-budget-meta">
            <span>مصرف‌شده: {money(budgetSpent)} ریال</span>
            <b>بودجه: {money(budgetTotal)} ریال</b>
          </div>
          <i className="rp-progress-bar"><span style={{ width: `${budgetTotal ? Math.min(100, budgetSpent / budgetTotal * 100) : 0}%` }} /></i>
          {budgets.length ? budgets.map(b => (
            <div className="rp-account" key={b.id}>
              <span>{b.definition.name}</span>
              <b>{money(b.spent)} / {money(b.amount)} ریال</b>
            </div>
          )) : <p className="rp-empty">برای ماه جاری بودجه‌ای ثبت نشده است.</p>}
        </article>
      </section>

      {/* لیست تراکنش‌ها */}
      <section className="rp-panel rp-table-panel">
        <h2>ریز تراکنش‌های بازه انتخابی</h2>
        <div className="rp-table-wrap">
          <table className="rp-table">
            <thead>
              <tr><th>تاریخ</th><th>نوع</th><th>شرح</th><th>مبلغ (ریال)</th></tr>
            </thead>
            <tbody>
              {filteredEntries.length ? filteredEntries.map(e => (
                <tr key={e.id}>
                  <td>{new Intl.DateTimeFormat("fa-IR").format(new Date(e.date))}</td>
                  <td>{e.type === "income" ? "دریافت" : e.type === "expense" ? "پرداخت" : "انتقال"}</td>
                  <td>{e.description}</td>
                  <td>{money(e.amount)}</td>
                </tr>
              )) : <tr><td colSpan={4} style={{textAlign: "center"}}>تراکنشی در این بازه یافت نشد.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}