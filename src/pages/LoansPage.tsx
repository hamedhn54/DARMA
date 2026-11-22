import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, CircleDollarSign, CreditCard, HandCoins, Plus, RefreshCw, Pencil, Trash2, X } from "lucide-react";
import type { DefinitionRecord } from "../database/definitionsDb";
import { createCreditPurchase, createLoan, updateLoan, deleteLoan, updateCreditPurchase, deleteCreditPurchase, payInstallmentPartial, getLoanAndCreditData, type CreditPurchaseRecord, type InstallmentRecord } from "../services/loansCreditService";
import JalaliDateField from "../components/JalaliDateField";
import AmountInput from "../components/AmountInput"; // اضافه شد
import { format, parse, isValid } from "date-fns-jalali";
import "./LoansPage.css";

type Tab = "loans" | "credit";
const money = (n: number) => `${new Intl.NumberFormat("fa-IR").format(n)} ریال`;
const digits = (v: string) => v.replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
const amount = (v: string) => Number(digits(v).replace(/[^0-9]/g, ""));
const toJalali = (d: Date) => format(d, "yyyy/MM/dd");

export default function LoansPage() {
  const [tab, setTab] = useState<Tab>("loans");
  const [loans, setLoans] = useState<DefinitionRecord[]>([]);
  const [purchases, setPurchases] = useState<CreditPurchaseRecord[]>([]);
  const [installments, setInstallments] = useState<InstallmentRecord[]>([]);
  const [accounts, setAccounts] = useState<DefinitionRecord[]>([]);
  const [cashId, setCashId] = useState("");
  const [showForm, setShowForm] = useState(false);
  
  const [editingLoanId, setEditingLoanId] = useState<string | null>(null);
  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null); 
  
  const [payingInstallment, setPayingInstallment] = useState<InstallmentRecord | null>(null);
  const [paymentDate, setPaymentDate] = useState(new Date());
  const [paymentDescription, setPaymentDescription] = useState("");
  const [partialAmount, setPartialAmount] = useState("");
  
  const [name, setName] = useState(""); 
  const [principal, setPrincipal] = useState("");
  const [count, setCount] = useState("12"); 
  const [paidCount, setPaidCount] = useState("0"); 
  const [firstDue, setFirstDue] = useState(new Date());
  const [timing, setTiming] = useState<"existing" | "current">("current"); 
  const [note, setNote] = useState("");
  
  const [platform, setPlatform] = useState("دیجی‌پی"); 
  const [title, setTitle] = useState(""); 
  const [creditAmount, setCreditAmount] = useState("");
  const [creditCount, setCreditCount] = useState("4"); 
  const [creditDue, setCreditDue] = useState(new Date()); 
  const [creditNote, setCreditNote] = useState("");
  
  const [error, setError] = useState(""); 
  const [success, setSuccess] = useState(""); 
  const [busy, setBusy] = useState(false);
  
  const refresh = useCallback(async () => { 
    const data = await getLoanAndCreditData(); 
    setLoans(data.loans); setPurchases(data.purchases); setInstallments(data.installments); setAccounts(data.accounts); 
    setCashId(v => v || data.accounts[0]?.id || ""); 
  }, []);
  
  useEffect(() => { void refresh(); }, [refresh]);
  
  const pending = useMemo(() => {
    if (tab === "loans") {
      const loanIds = new Set(loans.map(l => l.id));
      return installments.filter(x => x.status === "pending" && x.ownerType === "loan" && loanIds.has(x.ownerId));
    } else {
      const purchaseIds = new Set(purchases.map(p => p.id));
      return installments.filter(x => x.status === "pending" && x.ownerType === "credit" && purchaseIds.has(x.ownerId));
    }
  }, [installments, loans, purchases, tab]);

  const paidTotal = (ownerType: "loan" | "credit", ownerId: string) => installments.filter(x => x.ownerType === ownerType && x.ownerId === ownerId).reduce((s, x) => s + (x.paidAmount ?? (x.status === "paid" ? x.amount : 0)), 0);
  
  const submit = async () => {
    setError(""); setSuccess(""); setBusy(true);
    try {
      if (tab === "loans") {
        const loanInput = { name, principal: amount(principal), installmentCount: Number(digits(count)), firstDueDate: toJalali(firstDue), timing, paidInstallments: Number(digits(paidCount)), cashAccountId: cashId, note };
        if (editingLoanId) { await updateLoan(editingLoanId, loanInput); setSuccess("اطلاعات وام اصلاح شد؛ اقساط پرداخت‌شده حفظ شدند."); }
        else { await createLoan(loanInput); setSuccess("پرونده وام و برنامه اقساط ثبت شد."); }
        setEditingLoanId(null); setName(""); setPrincipal(""); setNote("");
      } else {
        const creditInput = { platform, title, amount: amount(creditAmount), installmentCount: Number(digits(creditCount)), firstDueDate: toJalali(creditDue), note: creditNote };
        if (editingPurchaseId) { await updateCreditPurchase(editingPurchaseId, creditInput); setSuccess("اطلاعات خرید اعتباری اصلاح شد؛ اقساط پرداخت‌شده حفظ شدند."); }
        else { await createCreditPurchase(creditInput); setSuccess("خرید اعتباری و سررسیدهای آن ثبت شد."); }
        setEditingPurchaseId(null); setTitle(""); setCreditAmount(""); setCreditNote("");
      }
      setShowForm(false); await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "ثبت اطلاعات ناموفق بود."); }
    finally { setBusy(false); }
  };

  const startEditLoan = (loan: DefinitionRecord) => {
    setTab("loans"); setEditingLoanId(loan.id); setShowForm(true);
    setName(loan.name); setPrincipal(String(loan.principal || 0));
    setCount(String(loan.totalInstallments || 1)); setPaidCount(String(loan.paidInstallments || 0));
    const parsed = parse((loan.firstDueDate || toJalali(new Date())).replace(/-/g,"/"), "yyyy/MM/dd", new Date());
    setFirstDue(isValid(parsed) ? parsed : new Date()); setTiming(loan.loanTiming || "current"); setNote(loan.note || "");
    setError(""); setSuccess("");
  };
  
  const removeLoan = async (loan: DefinitionRecord) => {
    const accepted = window.confirm(`وام «${loan.name}» حذف شود؟ این عملیات فقط برای وامی مجاز است که هیچ تراکنش بانکی نداشته باشد.`);
    if (!accepted) return;
    setBusy(true); setError(""); setSuccess("");
    try {
      await deleteLoan(loan.id);
      setSuccess(`وام «${loan.name}» و اقساط ثبت‌نشده آن حذف شد.`);
      if (editingLoanId === loan.id) { setEditingLoanId(null); setShowForm(false); }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "حذف وام انجام نشد.");
    } finally { setBusy(false); }
  };

  const startEditPurchase = (purchase: CreditPurchaseRecord) => {
    setTab("credit"); setEditingPurchaseId(purchase.id); setShowForm(true);
    setPlatform(purchase.platform); setTitle(purchase.title);
    setCreditAmount(String(purchase.amount));
    setCreditCount(String(purchase.installmentCount));
    const parsed = parse((purchase.firstDueDate || toJalali(new Date())).replace(/-/g,"/"), "yyyy/MM/dd", new Date());
    setCreditDue(isValid(parsed) ? parsed : new Date()); setCreditNote(purchase.note || "");
    setError(""); setSuccess("");
  };

  const removePurchase = async (purchase: CreditPurchaseRecord) => {
    const accepted = window.confirm(`خرید «${purchase.title}» حذف شود؟ این عملیات فقط برای خریدی مجاز است که هیچ تراکنش بانکی نداشته باشد.`);
    if (!accepted) return;
    setBusy(true); setError(""); setSuccess("");
    try {
      await deleteCreditPurchase(purchase.id);
      setSuccess(`خرید «${purchase.title}» و اقساط ثبت‌نشده آن حذف شد.`);
      if (editingPurchaseId === purchase.id) { setEditingPurchaseId(null); setShowForm(false); }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "حذف خرید انجام نشد.");
    } finally { setBusy(false); }
  };

  const submitInstallmentPayment = async () => {
    if (!payingInstallment) return;
    setBusy(true); setError("");
    try {
      if (!cashId) throw new Error("حساب پرداخت را انتخاب کن.");
      await payInstallmentPartial(payingInstallment.id, cashId, amount(partialAmount), paymentDate.toISOString(), paymentDescription);
      setPayingInstallment(null); setPaymentDescription(""); setPartialAmount(""); setSuccess("پرداخت قسط ثبت شد؛ در صورت پرداخت کامل، قسط تسویه شد."); await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "ثبت پرداخت انجام نشد."); }
    finally { setBusy(false); }
  };

  return <section className="loans-page" dir="rtl">
    <div className="loans-heading">
      <div><span>مدیریت تعهدات مالی</span><h1>وام‌ها، اقساط و خرید اعتباری</h1><p>ثبت تعهد، برنامه سررسید و ثبت پرداخت در دفترکل مشترک دارما</p></div>
      <button className="loans-refresh" onClick={() => void refresh()}><RefreshCw size={16}/> بروزرسانی</button>
    </div>
    
    <div className="loans-tabs">
      <button className={tab === "loans" ? "active" : ""} onClick={() => { setTab("loans"); setShowForm(false); setError(""); }}><HandCoins size={17}/> وام‌ها و اقساط</button>
      <button className={tab === "credit" ? "active" : ""} onClick={() => { setTab("credit"); setShowForm(false); setError(""); }}><CreditCard size={17}/> خریدهای اعتباری</button>
    </div>
    
    <div className="loans-summary">
      <div><span>تعداد اقساط پرداخت‌نشده</span><b>{new Intl.NumberFormat("fa-IR").format(pending.length)}</b></div>
      <div><span>مانده اقساط پرداخت‌نشده</span><b>{money(pending.reduce((s, x) => s + x.amount-(x.paidAmount||0), 0))}</b></div>
      <div><span>پرونده‌های فعال</span><b>{new Intl.NumberFormat("fa-IR").format(tab === "loans" ? loans.length : purchases.length)}</b></div>
    </div>
    
    <div className="loans-toolbar">
      <h2>{tab === "loans" ? "فهرست وام‌ها" : "فهرست خریدهای اعتباری"}</h2>
      <button className="loans-primary" onClick={() => { setShowForm(v => !v); setEditingLoanId(null); setEditingPurchaseId(null); setError(""); }}><Plus size={17}/>{tab === "loans" ? "ثبت وام جدید" : "ثبت خرید اعتباری"}</button>
    </div>
    
    {error && <div className="loans-alert error">{error}</div>}
    {success && <div className="loans-alert success">{success}</div>}
    
    {showForm && <div className="loans-form">
      {tab === "loans" ? <>
        <h3>{editingLoanId ? "ویرایش اطلاعات وام" : "اطلاعات وام"}</h3>
        <div className="loans-fields">
          <label>عنوان وام<input value={name} onChange={e => setName(e.target.value)} placeholder="مثلاً وام بانک ملت"/></label>
          
          <label>مبلغ اصل وام (ریال)
            <AmountInput value={principal} onChange={setPrincipal} placeholder="مبلغ به ریال" />
          </label>

          <label>تعداد اقساط<input value={count} onChange={e => setCount(e.target.value)} inputMode="numeric"/></label>
          <JalaliDateField value={firstDue} onChange={setFirstDue} label="اولین سررسید شمسی"/>
          <label>وضعیت دریافت<select value={timing} onChange={e => setTiming(e.target.value as "existing" | "current")}><option value="current">وام جدید؛ وجه اکنون دریافت می‌شود</option><option value="existing">وام قبلی؛ فقط مانده بدهی ثبت شود</option></select></label>
          {timing === "existing" && <label>تعداد اقساط پرداخت‌شده تا امروز<input value={paidCount} onChange={e => setPaidCount(digits(e.target.value).replace(/[^0-9]/g, ""))} inputMode="numeric" placeholder="مثلاً ۲۴"/></label>}
          {timing === "current" && <label>واریز به حساب<select value={cashId} onChange={e => setCashId(e.target.value)}>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>}
          <label className="wide">توضیحات<input value={note} onChange={e => setNote(e.target.value)} placeholder="اختیاری"/></label>
        </div>
        <p className="loans-hint">برای وام قبلی، مانده بدهی ثبت می‌شود و موجودی بانک افزایش پیدا نمی‌کند. برای وام جدید، دریافت وجه در دفترکل ثبت خواهد شد.</p>
      </> : <>
        <h3>{editingPurchaseId ? "ویرایش اطلاعات خرید اعتباری" : "اطلاعات خرید اعتباری"}</h3>
        <div className="loans-fields">
          <label>پلتفرم / اعتباردهنده<input value={platform} onChange={e => setPlatform(e.target.value)} placeholder="تارا، دیجی‌پی، اسنپ‌پی..."/></label>
          <label>شرح خرید<input value={title} onChange={e => setTitle(e.target.value)} placeholder="مثلاً خرید لوازم خانه"/></label>
          
          <label>مبلغ خرید (ریال)
            <AmountInput value={creditAmount} onChange={setCreditAmount} placeholder="مبلغ خرید" />
          </label>

          <label>تعداد اقساط<input value={creditCount} onChange={e => setCreditCount(e.target.value)} inputMode="numeric"/></label>
          <JalaliDateField value={creditDue} onChange={setCreditDue} label="اولین سررسید شمسی"/>
          <label className="wide">توضیحات<input value={creditNote} onChange={e => setCreditNote(e.target.value)} placeholder="اختیاری"/></label>
        </div>
        <p className="loans-hint">خرید در زمان ثبت به‌عنوان هزینه و بدهی اعتباری ثبت می‌شود؛ پرداخت هر قسط، بدهی را کاهش داده و از حساب انتخابی وجه کم می‌کند.</p>
      </>}
      <div className="loans-form-actions">
        <button disabled={busy} onClick={() => void submit()}>{busy ? "در حال ثبت..." : editingLoanId ? "ذخیره اصلاحات وام" : editingPurchaseId ? "ذخیره اصلاحات خرید" : "ثبت اطلاعات"}</button>
        <button className="secondary" onClick={() => { setShowForm(false); setEditingLoanId(null); setEditingPurchaseId(null); }}>انصراف</button>
      </div>
    </div>}
    
    {tab === "loans" ? <div className="loans-list">
      {loans.length === 0 ? <div className="loans-empty"><HandCoins size={25}/> هنوز وامی ثبت نشده است.</div> : loans.map(loan => {
        const rows = installments.filter(x => x.ownerType === "loan" && x.ownerId === loan.id).sort((a,b) => a.installmentNo-b.installmentNo);
        const paid = paidTotal("loan", loan.id);
        const remaining = rows.filter(x => x.status === "pending");
        return <article className="loan-card" key={loan.id}>
          <div className="loan-card-head">
            <div><b>{loan.name}</b><small>{loan.loanTiming === "existing" ? "وام قبلی" : "وام جدید"} · {new Intl.NumberFormat("fa-IR").format(loan.totalInstallments || 0)} قسط</small></div>
            <strong>{money(remaining.reduce((sum,x)=>sum+x.amount-(x.paidAmount||0),0))}</strong>
            <div className="loan-card-actions">
              <button className="loan-edit" title="ویرایش وام" onClick={() => startEditLoan(loan)}><Pencil size={15}/> ویرایش</button>
              <button className="loan-delete" title="حذف وام" disabled={busy} onClick={() => void removeLoan(loan)}><Trash2 size={15}/> حذف</button>
            </div>
          </div>
          <div className="loan-progress"><i style={{ width: `${rows.length ? (rows.length-remaining.length)/rows.length*100 : 0}%` }}/></div>
          <div className="loan-meta"><span>اصل وام: {money(loan.principal || 0)}</span><span>پرداخت‌شده: {money(paid)}</span><span>باقی‌مانده: {new Intl.NumberFormat("fa-IR").format(remaining.length)} قسط</span></div>
          <details className="installment-accordion">
            <summary><span>مشاهده جزئیات اقساط ({new Intl.NumberFormat("fa-IR").format(rows.length)})</span><ChevronDown size={17}/></summary>
            <div className="installment-list">
              {rows.map(item => <div className="installment-row" key={item.id}>
                <span>قسط {new Intl.NumberFormat("fa-IR").format(item.installmentNo)} · {item.dueDate}</span>
                <b>{money(item.amount-(item.paidAmount||0))}{(item.paidAmount||0)>0&&<small> · پرداخت‌شده: {money(item.paidAmount||0)}</small>}</b>
                {item.status === "paid" ? <em className="paid"><CheckCircle2 size={14}/> پرداخت‌شده</em> : <button disabled={busy} onClick={() => { setPayingInstallment(item); setPaymentDate(new Date()); setPartialAmount(String(item.amount-(item.paidAmount||0))); setPaymentDescription(`پرداخت قسط شماره ${item.installmentNo}`); }}>ثبت پرداخت</button>}
              </div>)}
            </div>
          </details>
        </article>;
      })}
    </div> : <div className="loans-list">
      {purchases.length === 0 ? <div className="loans-empty"><CreditCard size={25}/> هنوز خرید اعتباری ثبت نشده است.</div> : purchases.map(purchase => {
        const rows = installments.filter(x => x.ownerType === "credit" && x.ownerId === purchase.id).sort((a,b) => a.installmentNo-b.installmentNo);
        const paid = paidTotal("credit", purchase.id);
        return <article className="loan-card" key={purchase.id}>
          <div className="loan-card-head">
            <div><b>{purchase.title}</b><small>{purchase.platform} · {new Intl.NumberFormat("fa-IR").format(purchase.installmentCount)} قسط</small></div>
            <strong>{money(Math.max(0, purchase.amount-paid))}</strong>
            <div className="loan-card-actions">
              <button className="loan-edit" title="ویرایش خرید" onClick={() => startEditPurchase(purchase)}><Pencil size={15}/> ویرایش</button>
              <button className="loan-delete" title="حذف خرید" disabled={busy} onClick={() => void removePurchase(purchase)}><Trash2 size={15}/> حذف</button>
            </div>
          </div>
          <div className="loan-progress"><i style={{ width: `${purchase.amount ? Math.min(100, paid / purchase.amount * 100) : 0}%` }}/></div>
          <div className="loan-meta"><span>مبلغ خرید: {money(purchase.amount)}</span><span>پرداخت‌شده: {money(paid)}</span><span>مانده: {money(Math.max(0,purchase.amount-paid))}</span></div>
          <details className="installment-accordion">
            <summary><span>مشاهده جزئیات اقساط ({new Intl.NumberFormat("fa-IR").format(rows.length)})</span><ChevronDown size={17}/></summary>
            <div className="installment-list">
              {rows.map(item => <div className="installment-row" key={item.id}>
                <span>قسط {new Intl.NumberFormat("fa-IR").format(item.installmentNo)} · {item.dueDate}</span>
                <b>{money(item.amount-(item.paidAmount||0))}{(item.paidAmount||0)>0&&<small> · پرداخت‌شده: {money(item.paidAmount||0)}</small>}</b>
                {item.status === "paid" ? <em className="paid"><CheckCircle2 size={14}/> پرداخت‌شده</em> : <button disabled={busy} onClick={() => { setPayingInstallment(item); setPaymentDate(new Date()); setPartialAmount(String(item.amount-(item.paidAmount||0))); setPaymentDescription(`پرداخت قسط شماره ${item.installmentNo}`); }}>ثبت پرداخت</button>}
              </div>)}
            </div>
          </details>
        </article>;
      })}
    </div>}
    
    {payingInstallment && <div className="loan-modal-backdrop" onClick={() => setPayingInstallment(null)}>
      <section className="loan-payment-modal" onClick={e=>e.stopPropagation()}>
        <header>
          <div><h3>ثبت پرداخت قسط</h3><small>قسط {new Intl.NumberFormat("fa-IR").format(payingInstallment.installmentNo)} · مانده {money(payingInstallment.amount-(payingInstallment.paidAmount||0))}</small></div>
          <button onClick={()=>setPayingInstallment(null)} aria-label="بستن"><X size={18}/></button>
        </header>
        <div className="loans-fields">
          
          <label>مبلغ پرداخت (ریال)
            <AmountInput value={partialAmount} onChange={setPartialAmount} placeholder="مبلغ پرداخت" />
          </label>

          <label>پرداخت از حساب<select value={cashId} onChange={e=>setCashId(e.target.value)}>{accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
          <JalaliDateField value={paymentDate} onChange={setPaymentDate} label="تاریخ پرداخت"/>
          <label className="wide">شرح پرداخت<input value={paymentDescription} onChange={e=>setPaymentDescription(e.target.value)}/></label>
        </div>
        <p className="loans-hint">با تأیید، سند دوطرفه پرداخت صادر و مانده بدهی و حساب بانکی به‌روزرسانی می‌شود.</p>
        <div className="loans-form-actions">
          <button disabled={busy || !accounts.length} onClick={()=>void submitInstallmentPayment()}>{busy?"در حال ثبت...":"تأیید و ثبت پرداخت"}</button>
          <button className="secondary" onClick={()=>{setPayingInstallment(null);setPartialAmount("")}}>انصراف</button>
        </div>
      </section>
    </div>}
    
    <div className="loans-payment-account">
      <CircleDollarSign size={17}/>
      <span>حساب پرداخت اقساط:</span>
      <select value={cashId} onChange={e => setCashId(e.target.value)}>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
      {accounts.length === 0 && <small>برای ثبت پرداخت، ابتدا در تعاریف یک حساب بانکی یا صندوق بساز.</small>}
    </div>
  </section>;
}