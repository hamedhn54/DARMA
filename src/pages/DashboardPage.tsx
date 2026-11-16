import { useCallback, useEffect, useState } from "react";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Landmark, Wallet, RefreshCw, PiggyBank, Clock, CreditCard } from "lucide-react";
import { getLedgerSummary } from "../services/transactionService";
import { getLoanAndCreditData, type InstallmentRecord } from "../services/loansCreditService";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import "./DashboardPage.css";

const money = (n: number) => new Intl.NumberFormat("fa-IR").format(Math.round(n));
const COLORS = ["#279b79", "#d5a85b", "#6487c8", "#cf7373", "#8b5cf6", "#ec4899"];

export default function DashboardPage({ onNavigate }: { onNavigate: (page: string) => void }) {
  const [data, setData] = useState<any>(null);
  const [installments, setInstallments] = useState<InstallmentRecord[]>([]);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [summary, loanData] = await Promise.all([getLedgerSummary(), getLoanAndCreditData()]);
      setData(summary);
      setInstallments(loanData.installments.filter(x => x.status === "pending").sort((a, b) => a.dueDate.localeCompare(b.dueDate)));
      setError("");
    } catch {
      setError("خواندن اطلاعات دفترکل انجام نشد.");
    }
  }, []);

  useEffect(() => {
    void refresh();
    const handler = () => void refresh();
    window.addEventListener("focus", handler);
    return () => window.removeEventListener("focus", handler);
  }, [refresh]);

  // آماده‌سازی داده‌ها برای نمودار دایره‌ای
  const pieData = data?.expenseMap ? Array.from(data.expenseMap.entries()).map(([name, value]) => ({ name, value })) : [];
  if (data?.totalFees && data.totalFees > 0 && !pieData.find((p: any) => p.name === "کارمزدهای بانکی")) {
    pieData.push({ name: "کارمزدهای بانکی", value: data.totalFees });
  }
  if (pieData.length === 0) pieData.push({ name: "بدون هزینه", value: 1 });

  // آماده‌سازی داده‌ها برای نمودار میله‌ای
  const barData = [
    { name: "درآمد", amount: data?.monthlyIncome || 0, fill: "var(--green)" },
    { name: "هزینه", amount: data?.monthlyExpense || 0, fill: "var(--red)" }
  ];

  return (
    <main className="db-page" dir="rtl">
      <header className="db-heading">
        <div>
          <span>اطلاعات زنده از دفترکل مشترک</span>
          <h1>خلاصه وضعیت مالی</h1>
          <p>مانده‌ها و گردش‌ها از اسناد ثبت‌شده محاسبه می‌شوند.</p>
        </div>
        <button onClick={() => void refresh()}><RefreshCw size={16} /> به‌روزرسانی</button>
      </header>

      {error && <p className="db-error">{error}</p>}

      {/* کارت‌های اصلی */}
      <section className="db-metrics">
        <article><span><Wallet size={17} /> موجودی کل حساب‌ها</span><b>{money(data?.cashTotal || 0)} <small>ریال</small></b></article>
        <article><span><ArrowDownLeft size={17} /> درآمد ثبت‌شده</span><b>{money(data?.incomeTotal || 0)} <small>ریال</small></b></article>
        <article><span><ArrowUpRight size={17} /> هزینه ثبت‌شده</span><b>{money(data?.expenseTotal || 0)} <small>ریال</small></b></article>
        <article><span><PiggyBank size={17} /> خالص نقدینگی</span><b>{money(data?.netWorth || 0)} <small>ریال</small></b></article>
      </section>

      {/* بخش نمودارها */}
      <section className="db-charts">
        <article className="db-panel chart-panel">
          <div className="db-panel-head"><div><h2>عملکرد ماه جاری</h2><small>مقایسه درآمد و هزینه</small></div></div>
          <div className="chart-container" style={{ width: "100%", height: 250 }}>
            <ResponsiveContainer>
              <BarChart data={barData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                <XAxis dataKey="name" tick={{ fill: 'var(--text)', fontSize: 12 }} />
                <YAxis tick={{ fill: 'var(--text)', fontSize: 11 }} tickFormatter={(val) => `‎${val / 1000}k`} />
                <Tooltip formatter={(val: any) => [`${money(val)} ریال`, ""]} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', backgroundColor: 'var(--surface)', color: 'var(--text)' }} />
                <Bar dataKey="amount" radius={[6, 6, 0, 0]} maxBarSize={60}>
                  {barData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="db-panel chart-panel">
          <div className="db-panel-head"><div><h2>ترکیب هزینه‌ها</h2><small>دسته‌بندی هزینه‌های ثبت‌شده</small></div></div>
          <div className="chart-container" style={{ width: "100%", height: 250, display: 'flex', alignItems: 'center' }}>
            <ResponsiveContainer width="60%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3}>
                  {pieData.map((entry: any, index: number) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(val: any) => `${money(val)} ریال`} contentStyle={{ borderRadius: 8, border: 'none', backgroundColor: 'var(--surface)', color: 'var(--text)' }} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ width: '40%', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pieData.map((item: any, idx: number) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS[idx % COLORS.length] }}></span>
                  <span style={{ flex: 1 }}>{item.name}</span>
                  <b style={{ color: 'var(--muted)' }}>{new Intl.NumberFormat("fa-IR").format(item.value)}</b>
                </div>
              ))}
            </div>
          </div>
        </article>
      </section>

      {/* بخش حساب‌ها و اقساط */}
      <section className="db-columns">
        <article className="db-panel">
          <div className="db-panel-head"><div><h2>حساب‌های بانکی و نقدی</h2><small>مانده اولیه به‌علاوه گردش دفترکل</small></div><button onClick={() => onNavigate("تعاریف")}>مدیریت حساب‌ها</button></div>
          {data?.accountBalances?.length ? data.accountBalances.map((x: any) => (
            <div className="db-account" key={x.account.id}><span><Landmark size={17} />{x.account.name}</span><b>{money(x.balance)} ریال</b></div>
          )) : <div className="db-empty">هنوز حساب بانکی یا صندوقی تعریف نشده است.</div>}
        </article>

        <article className="db-panel">
          <div className="db-panel-head"><div><h2>اقساط نزدیک به سررسید</h2><small>پرداخت‌نشده‌ها بر اساس تاریخ</small></div><button onClick={() => onNavigate("وام‌ها و خرید اعتباری")}>مشاهده همه</button></div>
          {installments.length > 0 ? installments.slice(0, 4).map(item => {
            const isLoan = item.ownerType === "loan";
            return (
              <div className="db-installment" key={item.id}>
                <span className="db-inst-icon">{isLoan ? <Wallet size={16} /> : <CreditCard size={16} />}</span>
                <div className="db-inst-info">
                  <b>{isLoan ? "قسط وام" : "قسط خرید"} شماره {item.installmentNo}</b>
                  <small><Clock size={12} /> سررسید: {item.dueDate}</small>
                </div>
                <strong>{money(item.amount - (item.paidAmount || 0))} <small>ریال</small></strong>
              </div>
            );
          }) : <div className="db-empty">اقساط پرداخت‌نشده‌ای وجود ندارد.</div>}
        </article>
      </section>

      {/* بخش آخرین تراکنش‌ها */}
      <section className="db-panel">
        <div className="db-panel-head"><div><h2>آخرین اسناد دفترکل</h2><small>شامل تراکنش‌های عمومی، اشخاص، وام‌ها و خریدها</small></div><button onClick={() => onNavigate("تراکنش‌ها")}>ثبت / مشاهده</button></div>
        {data?.recent?.length ? data.recent.map((e: any) => (
          <div className="db-recent" key={e.id}>
            <span className={`db-recent-icon ${e.type}`}>{e.type === "income" || e.type === "borrow" || e.type === "collect" ? <ArrowDownLeft size={17} /> : e.type === "transfer" || e.type === "offset" ? <ArrowLeftRight size={17} /> : <ArrowUpRight size={17} />}</span>
            <span><b>سند {e.docNo?.toLocaleString("fa-IR") || "—"} · {e.description}</b><small>{new Intl.DateTimeFormat("fa-IR").format(new Date(e.date))}{e.isTest ? " · آزمایشی" : ""}</small></span>
            <strong>{money(e.amount)} ریال</strong>
          </div>
        )) : <div className="db-empty">هنوز سندی ثبت نشده است.</div>}
      </section>
    </main>
  );
}