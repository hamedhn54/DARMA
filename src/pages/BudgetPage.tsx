import { useCallback, useEffect, useState } from "react";
import { Plus, RefreshCw, Trash2, Target, Copy, AlertTriangle, CheckCircle2, Pencil } from "lucide-react";
import { definitionsDb, type DefinitionRecord } from "../database/definitionsDb";
import { copyBudgetsFromPreviousMonth, deleteBudget, getBudgets, saveBudget, type BudgetView } from "../services/budgetService";
import "./BudgetPage.css";

const money = (n: number) => new Intl.NumberFormat("fa-IR").format(n);
const digits = (v: string) => v.replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[^0-9]/g, "");
const formatted = (v: string) => { 
  const n = Number(digits(v)); 
  return n ? new Intl.NumberFormat("fa-IR").format(n) : ""; 
};

const MONTHS = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
const YEARS = [1403, 1404, 1405, 1406, 1407];

export default function BudgetPage() {
  const [rows, setRows] = useState<BudgetView[]>([]);
  const [categories, setCategories] = useState<DefinitionRecord[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  
  const now = new Date();
  const [year, setYear] = useState(1405); 
  const [month, setMonth] = useState(String(now.getMonth() + 1).padStart(2, "0")); 
  const period = `${year}-${month}`; 
  
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const [b, d] = await Promise.all([getBudgets(period), definitionsDb.definitions.toArray()]);
    setRows(b);
    setCategories(d.filter(x => x.kind === "category" && x.parentId !== null && (x.root === "expenses" || x.root === "income")));
  }, [period]);

  useEffect(() => { void refresh(); }, [refresh]);

  const total = rows.reduce((s, x) => s + x.amount, 0);
  const spent = rows.reduce((s, x) => s + x.spent, 0);

  // تابع جدید برای شروع ویرایش
  const startEdit = (r: BudgetView) => {
    setCategoryId(r.definitionId);
    setAmount(formatted(String(r.amount)));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setCategoryId("");
    setAmount("");
    setError("");
  };

  const submit = async () => {
    setError(""); setSuccess(""); setBusy(true);
    try {
      await saveBudget(categoryId, Number(digits(amount)), period);
      setCategoryId(""); setAmount(""); setSuccess("بودجه با موفقیت ثبت/ویرایش شد.");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ثبت بودجه انجام نشد.");
    } finally { setBusy(false); }
  };

  const handleCopy = async () => {
    if (!window.confirm(`آیا از بودجه‌های ماه قبل برای ${MONTHS[Number(month)-1]} کپی شود؟`)) return;
    setBusy(true); setError(""); setSuccess("");
    try {
      const count = await copyBudgetsFromPreviousMonth(period);
      if (count > 0) setSuccess(`${count} ردیف بودجه از ماه قبل کپی شد.`);
      else setSuccess("هیچ بودجه جدیدی برای کپی یافت نشد (یا از قبل وجود داشتند).");
      await refresh();
    } catch (e) {
      setError("کپی بودجه انجام نشد.");
    } finally { setBusy(false); }
  };

  return (
    <main className="budget-page" dir="rtl">
      <header className="budget-head">
        <div>
          <span>برنامه‌ریزی مالی ماهانه</span>
          <h1>بودجه‌بندی</h1>
          <p>بودجه‌ها بر اساس دسته‌بندی تعریف می‌شوند و عملکردشان از تراکنش‌های واقعی دفترکل محاسبه می‌شود.</p>
        </div>
        <button onClick={() => void refresh()} disabled={busy}><RefreshCw size={16} /> به‌روزرسانی</button>
      </header>

      <section className="budget-period">
        <div className="budget-period-select">
          <label>ماه:</label>
          <select value={month} onChange={e => setMonth(e.target.value)}>
            {MONTHS.map((m, i) => <option key={i} value={String(i + 1).padStart(2, "0")}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))}>
            {YEARS.map(y => <option key={y} value={y}>{y.toString().replace("140", "۱۴۰")}</option>)}
          </select>
        </div>
        <button className="budget-copy-btn" onClick={() => void handleCopy()} disabled={busy}>
          <Copy size={16} /> کپی از ماه قبل
        </button>
      </section>

      <section className="budget-kpis">
        <article><span>کل بودجه ماه</span><b>{money(total)} ریال</b></article>
        <article><span>هزینه ثبت‌شده در دسته‌های بودجه‌دار</span><b>{money(spent)} ریال</b></article>
        <article><span>مانده بودجه</span><b>{money(total - spent)} ریال</b></article>
      </section>

      {error && <div className="budget-alert error">{error}</div>}
      {success && <div className="budget-alert success"><CheckCircle2 size={16}/> {success}</div>}

      <section className="budget-add">
        <h2><Plus size={18} /> تعریف یا اصلاح بودجه</h2>
        <div className="budget-fields">
          <label>دسته‌بندی
            <select value={categoryId} onChange={e => setCategoryId(e.target.value)}>
              <option value="">انتخاب دسته‌بندی</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.root === "income" ? "درآمد" : "هزینه"} · {c.name}</option>)}
            </select>
          </label>
          <label>مبلغ بودجه (ریال)
            <input value={amount} inputMode="numeric" onChange={e => setAmount(formatted(e.target.value))} placeholder="مثلاً ۵۰,۰۰۰,۰۰۰" />
          </label>
          <div className="budget-form-actions">
            <button disabled={busy || !categoryId || !digits(amount)} onClick={() => void submit()}>
              {busy ? "در حال ذخیره..." : "ذخیره بودجه"}
            </button>
            {(categoryId || amount) && (
              <button className="budget-cancel-btn" onClick={cancelEdit}>انصراف</button>
            )}
          </div>
        </div>
      </section>

      <section className="budget-list">
        <h2><Target size={18} /> بودجه‌های {MONTHS[Number(month)-1]} {year.toString().replace("140", "۱۴۰")}</h2>
        {rows.length === 0 ? (
          <p className="budget-empty">برای این ماه بودجه‌ای ثبت نشده است.</p>
        ) : (
          rows.map(r => {
            const isOver = r.percent > 100;
            const isNear = r.percent >= 80 && r.percent <= 100;
            return (
              <article className="budget-row" key={r.id}>
                <div className="budget-row-top">
                  <div>
                    <b>{r.definition.name}</b>
                    <small>{r.definition.root === "income" ? "بودجه درآمد" : "بودجه هزینه"}</small>
                  </div>
                  <div>
                    <b>{money(r.spent)} / {money(r.amount)} ریال</b>
                    <small style={{ color: isOver ? "var(--red)" : "var(--muted)" }}>
                      {isOver ? "عبور از سقف بودجه!" : `مانده: ${money(r.remaining)} ریال`}
                    </small>
                  </div>
                  <div className="budget-actions">
                    <button title="ویرایش بودجه" className="edit-btn" onClick={() => startEdit(r)}>
                      <Pencil size={16} />
                    </button>
                    <button title="حذف بودجه" className="delete-btn" onClick={async () => {
                      if (window.confirm("این بودجه حذف شود؟")) { await deleteBudget(r.id); await refresh(); }
                    }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="budget-track">
                  <i className={isOver ? "over" : isNear ? "near" : ""} style={{ width: `${Math.min(100, r.percent)}%` }} />
                </div>
                <div className="budget-row-footer">
                  <small className={isOver ? "over-text" : isNear ? "near-text" : ""}>{money(r.percent)}٪ مصرف‌شده</small>
                  {isOver && <span className="budget-warning"><AlertTriangle size={14}/> بیش از بودجه</span>}
                  {isNear && <span className="budget-near"><AlertTriangle size={14}/> نزدیک به سقف</span>}
                </div>
              </article>
            );
          })
        )}
      </section>
    </main>
  );
}