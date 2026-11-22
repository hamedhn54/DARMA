import { useCallback, useEffect, useState } from "react";
import { Plus, Target, Trash2, Pencil, RefreshCw, CheckCircle2, X, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { format, parse, isValid } from "date-fns-jalali";
import { getGoals, saveGoal, deleteGoal, addFundsToGoal, withdrawFundsFromGoal } from "../services/goalService";
import { definitionsDb, type GoalRecord, type DefinitionRecord } from "../database/definitionsDb";
import AmountInput from "../components/AmountInput";
import JalaliDateField from "../components/JalaliDateField";
import "./GoalsPage.css";

const money = (n: number) => new Intl.NumberFormat("fa-IR").format(n);
const toJalali = (d: Date) => format(d, "yyyy/MM/dd");

export default function GoalsPage() {
  const [goals, setGoals] = useState<GoalRecord[]>([]);
  const [accounts, setAccounts] = useState<DefinitionRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [deadline, setDeadline] = useState(new Date());
  const [note, setNote] = useState("");
  const [color, setColor] = useState("#059669");

  const [transactionMode, setTransactionMode] = useState<"deposit" | "withdraw">("deposit");
  const [activeGoal, setActiveGoal] = useState<GoalRecord | null>(null);
  const [txAmount, setTxAmount] = useState("");
  const [cashAccountId, setCashAccountId] = useState("");

  const colors = ["#059669", "#0284c7", "#d97706", "#dc2626", "#8b5cf6", "#ec4899"];

  const refresh = useCallback(async () => {
    const [g, a] = await Promise.all([getGoals(), definitionsDb.definitions.toArray()]);
    setGoals(g);
    setAccounts(a.filter(x => ["bank", "cash", "wallet"].includes(x.kind)));
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const resetForm = () => {
    setEditingId(null); setTitle(""); setTargetAmount(""); setDeadline(new Date()); setNote(""); setColor("#059669"); setError("");
  };

  const startEdit = (goal: GoalRecord) => {
    setEditingId(goal.id); setTitle(goal.title); setTargetAmount(String(goal.targetAmount));
    const parsed = parse((goal.deadline || toJalali(new Date())).replace(/-/g,"/"), "yyyy/MM/dd", new Date());
    setDeadline(isValid(parsed) ? parsed : new Date()); setNote(goal.note || ""); setColor(goal.color || "#059669");
    setShowForm(true); setError(""); setSuccess("");
  };

  const submit = async () => {
    setError(""); setSuccess(""); setBusy(true);
    try {
      const numericTarget = Number(targetAmount.replace(/[^0-9]/g, ""));
      if (!title.trim()) throw new Error("عنوان هدف را وارد کنید.");
      if (!numericTarget || numericTarget <= 0) throw new Error("مبلغ هدف معتبر نیست.");
      
      const input = {
        title: title.trim(),
        targetAmount: numericTarget,
        savedAmount: editingId ? (goals.find(g => g.id === editingId)?.savedAmount || 0) : 0,
        deadline: toJalali(deadline),
        color,
        note: note.trim()
      };
      
      await saveGoal(input, editingId || undefined);
      setSuccess(editingId ? "هدف مالی ویرایش شد." : "هدف مالی جدید ثبت شد.");
      setShowForm(false); resetForm(); await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در ثبت هدف.");
    } finally { setBusy(false); }
  };

  const handleDelete = async (goal: GoalRecord) => {
    if (!window.confirm(`هدف «${goal.title}» حذف شود؟`)) return;
    setBusy(true);
    try {
      await deleteGoal(goal.id);
      await refresh();
    } finally { setBusy(false); }
  };

  const openTransaction = (goal: GoalRecord, mode: "deposit" | "withdraw") => {
    setActiveGoal(goal);
    setTransactionMode(mode);
    setTxAmount("");
    setCashAccountId(accounts[0]?.id || "");
    setError("");
  };

  const handleTransaction = async () => {
    if (!activeGoal) return;
    setBusy(true); setError(""); setSuccess("");
    try {
      const numericAmount = Number(txAmount.replace(/[^0-9]/g, ""));
      if (!numericAmount || numericAmount <= 0) throw new Error("مبلغ معتبر نیست.");
      if (!cashAccountId) throw new Error("حساب بانکی را انتخاب کنید.");
      
      if (transactionMode === "deposit") {
        await addFundsToGoal(activeGoal.id, numericAmount, cashAccountId);
        setSuccess("مبلغ با موفقیت به هدف واریز شد.");
      } else {
        await withdrawFundsFromGoal(activeGoal.id, numericAmount, cashAccountId);
        setSuccess("مبلغ با موفقیت از هدف برداشت شد.");
      }
      
      setActiveGoal(null); setTxAmount(""); setCashAccountId("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در انجام عملیات.");
    } finally { setBusy(false); }
  };

  const totalSaved = goals.reduce((s, g) => s + g.savedAmount, 0);
  const totalTarget = goals.reduce((s, g) => s + g.targetAmount, 0);

  return (
    <main className="goals-page" dir="rtl">
      <header className="goals-heading">
        <div>
          <span>برنامه‌ریزی برای آینده</span>
          <h1>اهداف مالی و پس‌انداز</h1>
          <p>برای رویاهای خود هدف تعیین کنید و پیشرفت خود را تماشا کنید.</p>
        </div>
        <div className="goals-actions">
          <button onClick={() => void refresh()} disabled={busy}><RefreshCw size={16} /> به‌روزرسانی</button>
          <button className="goals-primary" onClick={() => { resetForm(); setShowForm(v => !v); }}>
            <Plus size={16} /> هدف جدید
          </button>
        </div>
      </header>

      <section className="goals-summary">
        <article><span>مجموع پس‌انداز شده</span><b>{money(totalSaved)} ریال</b></article>
        <article><span>مجموع مبلغ اهداف</span><b>{money(totalTarget)} ریال</b></article>
        <article><span>درصد پیشرفت کلی</span><b>{totalTarget ? Math.round((totalSaved / totalTarget) * 100) : 0}٪</b></article>
      </section>

      {error && <div className="goals-alert error">{error}</div>}
      {success && <div className="goals-alert success"><CheckCircle2 size={16} /> {success}</div>}

      {showForm && (
        <div className="goals-form-card">
          <h2>{editingId ? "ویرایش هدف" : "تعریف هدف جدید"}</h2>
          <div className="goals-form-grid">
            <label>عنوان هدف
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="مثلاً خرید ماشین، سفر به ژاپن..." />
            </label>
            <label>مبلغ هدف (ریال)
              <AmountInput value={targetAmount} onChange={setTargetAmount} placeholder="مبلغ هدف" />
            </label>
            <label>تاریخ سررسید هدف
              <JalaliDateField value={deadline} onChange={setDeadline} label="" />
            </label>
            <label>رنگ اختصاصی
              <div className="color-picker">
                {colors.map(c => (
                  <button key={c} type="button" style={{ background: c, outline: color === c ? "2px solid var(--text)" : "none" }} onClick={() => setColor(c)} />
                ))}
              </div>
            </label>
            <label className="wide">توضیحات (اختیاری)
              <input value={note} onChange={e => setNote(e.target.value)} placeholder="یادداشت..." />
            </label>
          </div>
          <div className="goals-form-actions">
            <button className="goals-primary" disabled={busy} onClick={() => void submit()}>{busy ? "در حال ذخیره..." : "ذخیره هدف"}</button>
            <button className="goals-secondary" onClick={() => { setShowForm(false); resetForm(); }}>انصراف</button>
          </div>
        </div>
      )}

      <div className="goals-grid">
        {goals.length === 0 ? (
          <div className="goals-empty">
            <Target size={40} />
            <h2>هنوز هدفی تعیین نکرده‌اید</h2>
            <p>اولین قدم برای رسیدن به رویاها، تعیین یک هدف است.</p>
          </div>
        ) : goals.map(goal => {
          const percent = goal.targetAmount ? Math.min(100, Math.round((goal.savedAmount / goal.targetAmount) * 100)) : 0;
          const isCompleted = percent >= 100;
          return (
            <article className="goal-card" key={goal.id} style={{ borderTop: `4px solid ${goal.color}` }}>
              <div className="goal-card-header">
                <div>
                  <h3>{goal.title}</h3>
                  <small>سررسید: {goal.deadline}</small>
                </div>
                <div className="goal-card-actions">
                  <button title="ویرایش" onClick={() => startEdit(goal)}><Pencil size={15}/></button>
                  <button title="حذف" onClick={() => void handleDelete(goal)}><Trash2 size={15}/></button>
                </div>
              </div>

              <div className="goal-progress">
                <div className="goal-progress-bar">
                  <div className="goal-progress-fill" style={{ width: `${percent}%`, background: goal.color }} />
                </div>
                <span>{percent}٪</span>
              </div>

              <div className="goal-amounts">
                <div><span>پس‌انداز شده</span><b>{money(goal.savedAmount)} ریال</b></div>
                <div><span>هدف</span><b>{money(goal.targetAmount)} ریال</b></div>
              </div>

              {goal.note && <p className="goal-note">{goal.note}</p>}

              {/* دکمه‌های جدید و زیبا */}
              <div className="goal-actions-row">
                <button
                  className="goal-btn deposit-btn"
                  onClick={() => openTransaction(goal, "deposit")}
                  disabled={isCompleted}
                  style={{ background: isCompleted ? "var(--surface-soft)" : goal.color, color: isCompleted ? "var(--muted)" : "#fff" }}
                >
                  {isCompleted ? <><CheckCircle2 size={16}/> تکمیل شده</> : <><ArrowDownLeft size={16}/> واریز وجه</>}
                </button>
                
                <button
                  className="goal-btn withdraw-btn"
                  onClick={() => openTransaction(goal, "withdraw")}
                  disabled={goal.savedAmount === 0}
                >
                  <ArrowUpRight size={16}/> برداشت
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {activeGoal && (
        <div className="goals-modal-backdrop" onClick={() => setActiveGoal(null)}>
          <div className="goals-modal" onClick={e => e.stopPropagation()}>
            <header>
              <h2>{transactionMode === "deposit" ? "واریز به هدف" : "برداشت از هدف"}: {activeGoal.title}</h2>
              <button onClick={() => setActiveGoal(null)}><X size={20}/></button>
            </header>
            <p>
              {transactionMode === "deposit" 
                ? "مبلغی که می‌خواهید از حساب بانکی به این هدف منتقل کنید را وارد نمایید." 
                : `مبلغی که می‌خواهید از این هدف به حساب بانکی برگردانید را وارد نمایید. (حداکثر: ${money(activeGoal.savedAmount)} ریال)`}
            </p>
            
            <label className="goals-form-grid" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '15px' }}>
              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                {transactionMode === "deposit" ? "حساب بانکی مبدأ:" : "حساب بانکی مقصد:"}
              </span>
              <select value={cashAccountId} onChange={e => setCashAccountId(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--surface-soft)', color: 'var(--text)', fontFamily: 'inherit', outline: 'none' }}>
                <option value="">انتخاب حساب...</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>

            <AmountInput value={txAmount} onChange={setTxAmount} placeholder="مبلغ..." />
            
            {accounts.length === 0 && <p style={{ color: 'var(--red)', fontSize: '11px', marginTop: '10px' }}>برای این عملیات، ابتدا در بخش تعاریف یک حساب بانکی بسازید.</p>}

            <div className="goals-modal-actions">
              <button className={`goals-primary ${transactionMode === "withdraw" ? "modal-withdraw-btn" : ""}`} disabled={busy || accounts.length === 0} onClick={() => void handleTransaction()}>
                {busy ? "..." : (transactionMode === "deposit" ? "تأیید و واریز" : "تأیید و برداشت")}
              </button>
              <button className="goals-secondary" onClick={() => setActiveGoal(null)}>انصراف</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}