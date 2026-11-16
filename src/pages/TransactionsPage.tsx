import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, RefreshCw, Search, Pencil, Ban, Trash2, FileText, X } from "lucide-react";
import { definitionsDb, type DefinitionRecord, type JournalEntry } from "../database/definitionsDb";
import { deleteTestFinancialTransaction, getFinancialTransactions, postFinancialTransaction, updateFinancialTransaction, voidFinancialTransaction, type FinancialTransactionType } from "../services/transactionService";
import JalaliDateField from "../components/JalaliDateField";
import { getLoanAndCreditData, payInstallmentPartial, type InstallmentRecord } from "../services/loansCreditService";
import "./TransactionsPage.css";

const labels: Record<FinancialTransactionType, string> = { income: "دریافت", expense: "پرداخت", transfer: "انتقال" };
const entryLabel = (type: string) => type === "loan_payment" ? "پرداخت قسط وام" : type === "credit_payment" ? "پرداخت قسط خرید اعتباری" : labels[type as FinancialTransactionType];
const money = (value: number) => `${new Intl.NumberFormat("fa-IR").format(Math.abs(value))} ریال`;
const latinDigits = (value: string) => value.replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));

export default function TransactionsPage({ initialInstallmentId, onInitialInstallmentHandled }: { initialInstallmentId?: string | null; onInitialInstallmentHandled?: () => void }) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<DefinitionRecord[]>([]);
  const [pendingInstallments, setPendingInstallments] = useState<InstallmentRecord[]>([]);
  const [loans, setLoans] = useState<DefinitionRecord[]>([]);
  const [loanPickerOpen, setLoanPickerOpen] = useState(false);
  const [loanPickerId, setLoanPickerId] = useState<string | null>(null);
  const [selectedInstallmentId, setSelectedInstallmentId] = useState("");
  const [categories, setCategories] = useState<DefinitionRecord[]>([]);
  const [type, setType] = useState<FinancialTransactionType>("expense");
  const [amount, setAmount] = useState("");
  const [fee, setFee] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [categoryModal, setCategoryModal] = useState(false);
  const [categoryParent, setCategoryParent] = useState<string | null>(null);
  const [categorySearch, setCategorySearch] = useState("");
  const [date, setDate] = useState(new Date());
  const [description, setDescription] = useState("");
  const [accountId, setAccountId] = useState("");
  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [isTest, setIsTest] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detailEntry, setDetailEntry] = useState<JournalEntry | null>(null);
  const [detailLines, setDetailLines] = useState<import("../database/definitionsDb").JournalLine[]>([]);
  const [detailAttachments, setDetailAttachments] = useState<import("../database/definitionsDb").AttachmentRecord[]>([]);
  const [query, setQuery] = useState("");
  const [filterType, setFilterType] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  
  const refresh = useCallback(async () => {
    const [a, e, loanData] = await Promise.all([definitionsDb.definitions.toArray(), getFinancialTransactions(), getLoanAndCreditData()]);
    const cash = a.filter(x => ["bank", "cash", "wallet"].includes(x.kind));
    setAccounts(cash); setLoans(loanData.loans); setPendingInstallments(loanData.installments.filter(x => x.ownerType === "loan" && x.status === "pending")); setCategories(a.filter(x => x.kind !== "person" && x.parentId !== null && (x.root === "income" || x.root === "expenses"))); setEntries(e);
    setAccountId(v => v || cash[0]?.id || ""); setFromAccountId(v => v || cash[0]?.id || ""); setToAccountId(v => v || cash[1]?.id || "");
  }, []);
  
  useEffect(() => { void refresh(); }, [refresh]);
  
  useEffect(() => {
    if (!initialInstallmentId || pendingInstallments.length === 0) return;
    const item = pendingInstallments.find(x => x.id === initialInstallmentId);
    if (item) {
      setType("expense"); setSelectedInstallmentId(item.id);
      setAmount(new Intl.NumberFormat("fa-IR").format(item.amount));
      setDescription(`پرداخت قسط شماره ${item.installmentNo}`);
      setEditingId(null);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    onInitialInstallmentHandled?.();
  }, [initialInstallmentId, pendingInstallments, onInitialInstallmentHandled]);

  const visible = useMemo(() => entries.filter(e => e.status !== "void" && (!filterType || e.type === filterType) && (!query || `${e.description} ${e.docNo}`.toLowerCase().includes(query.toLowerCase()))), [entries, filterType, query]);
  
  const startEdit = (entry: JournalEntry) => {
    if (entry.type !== "income" && entry.type !== "expense" && entry.type !== "transfer") return;
    setEditingId(entry.id); 
    setType(entry.type); 
    setAmount(new Intl.NumberFormat("fa-IR").format(entry.amount));
    setDate(new Date(entry.date)); 
    setDescription(entry.description); 
    setAccountId(entry.cashAccountId || "");
    setFromAccountId(entry.fromAccountId || ""); 
    setToAccountId(entry.toAccountId || ""); 
    setCategoryId(entry.categoryId || ""); 
    setFee(entry.fee ? new Intl.NumberFormat("fa-IR").format(entry.fee) : ""); 
    setFiles([]); 
    setIsTest(!!entry.isTest);
    setSelectedInstallmentId(""); // پاک کردن اتصال قسط در زمان ویرایش
    setError("");
    window.scrollTo({top:0,behavior:"smooth"});
  };
  
  const cancelEdit = () => { 
    setEditingId(null); 
    setAmount(""); 
    setFee(""); 
    setFiles([]); 
    setDescription(""); 
    setCategoryId(""); 
    setIsTest(false); 
    setSelectedInstallmentId("");
    setError("");
  };
  
  const openDetails = async (entry: JournalEntry) => { 
    setDetailEntry(entry); 
    const [lines, files] = await Promise.all([definitionsDb.journalLines.where("entryId").equals(entry.id).toArray(), definitionsDb.attachments.where("transactionId").equals(entry.id).toArray()]); 
    setDetailLines(lines); 
    setDetailAttachments(files); 
  };
  
  const lineName = (line: import("../database/definitionsDb").JournalLine) => {
    if (line.cashAccountId) return accounts.find(a=>a.id===line.cashAccountId)?.name || "حساب حذف‌شده";
    const id=line.accountCode.split(":").slice(1).join(":");
    return line.accountCode === "expense:bank-fee" ? "کارمزد بانکی" : categories.find(c=>c.id===id)?.name || (line.accountCode.startsWith("income:")?"درآمد بدون دسته‌بندی":"هزینه بدون دسته‌بندی");
  };
  
  const voidEntry = async (entry: JournalEntry) => { 
    const reason=window.prompt("علت ابطال سند:","ثبت اشتباه"); 
    if(reason===null) return; 
    if(!window.confirm(`سند شماره ${entry.docNo||"—"} باطل شود؟`)) return; 
    setBusy(true); setError("");
    try {
      await voidFinancialTransaction(entry.id,reason); 
      await refresh(); 
    } catch (e) {
      setError(e instanceof Error ? e.message : "ابطال سند انجام نشد.");
    } finally { setBusy(false); }
  };
  
  const deleteTest = async (entry: JournalEntry) => { 
    if(!window.confirm(`سند آزمایشی شماره ${entry.docNo||"—"} برای همیشه حذف شود؟`)) return; 
    setBusy(true); setError("");
    try {
      await deleteTestFinancialTransaction(entry.id); 
      await refresh(); 
    } catch (e) {
      setError(e instanceof Error ? e.message : "حذف سند انجام نشد.");
    } finally { setBusy(false); }
  };
  
  const save = async () => {
    setError(""); setBusy(true);
    try {
      const numeric = Number(latinDigits(amount).replace(/[^0-9]/g, ""));
      const feeValue = Number(latinDigits(fee).replace(/[^0-9]/g, ""));
      if (files.length > 10 || files.reduce((sum, file) => sum + file.size, 0) > 15 * 1024 * 1024) throw new Error("حداکثر ۱۰ پیوست با مجموع حجم ۱۵ مگابایت مجاز است.");
      const input = { type, amount: numeric, fee: feeValue, date: date.toISOString(), description, accountId, fromAccountId, toAccountId, categoryId: categoryId || undefined, isTest };
      let transactionId = editingId;
      if (selectedInstallmentId && !editingId) {
        await payInstallmentPartial(selectedInstallmentId, accountId, numeric, date.toISOString(), description, feeValue);
        setSelectedInstallmentId("");
      } else if (editingId) await updateFinancialTransaction(editingId, input); else transactionId = await postFinancialTransaction(input);
      if (transactionId && files.length) {
        await definitionsDb.transaction("rw", definitionsDb.attachments, async () => {
          for (const file of files) await definitionsDb.attachments.add({ id: crypto.randomUUID(), transactionId: transactionId!, name: file.name, mimeType: file.type || "application/octet-stream", size: file.size, blob: file, createdAt: new Date().toISOString() });
        });
      }
      cancelEdit(); await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "ثبت تراکنش انجام نشد."); }
    finally { setBusy(false); }
  };

  return <main className="tx-page" dir="rtl">
    <header className="tx-heading"><div><span>دفترکل مشترک دارما</span><h1>تراکنش‌ها</h1><p>دریافت، پرداخت و انتقال؛ هر عملیات با سند دوطرفه در دفترکل ثبت می‌شود.</p></div><button onClick={() => void refresh()}><RefreshCw size={16}/> به‌روزرسانی</button></header>
    
    <section className="tx-layout">
      <article className="tx-panel tx-form-panel"><div className="tx-title"><h2>{editingId?"ویرایش تراکنش":"ثبت تراکنش جدید"}</h2><span>سند حسابداری خودکار</span></div>
        <div className="tx-type-tabs">{(["income","expense","transfer"] as FinancialTransactionType[]).map(t => <button key={t} className={type===t?"active":""} onClick={()=>{setType(t); setCategoryId(""); if(t!=="expense")setSelectedInstallmentId("");}}>{t==="income"?<ArrowDownLeft size={17}/>:t==="expense"?<ArrowUpRight size={17}/>:<ArrowLeftRight size={17}/>} {labels[t]}</button>)}</div>
        <div className="tx-fields"><label>مبلغ (ریال)<input inputMode="numeric" value={amount} onChange={e=>{const raw=latinDigits(e.target.value).replace(/[^0-9]/g,"");setAmount(raw?new Intl.NumberFormat("fa-IR").format(Number(raw)):"")}} placeholder="مثلاً ۱۲٬۵۰۰٬۰۰۰"/></label>
          <JalaliDateField value={date} onChange={setDate}/>
          {type !== "transfer" && <label>حساب {type === "income" ? "واریز به" : "پرداخت از"}<select value={accountId} onChange={e=>setAccountId(e.target.value)}><option value="">انتخاب حساب</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>}
          {type === "transfer" && <><label>حساب مبدأ<select value={fromAccountId} onChange={e=>setFromAccountId(e.target.value)}><option value="">انتخاب مبدأ</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label><label>حساب مقصد<select value={toAccountId} onChange={e=>setToAccountId(e.target.value)}><option value="">انتخاب مقصد</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label></>}
          {type !== "transfer" && <label>دسته‌بندی<button type="button" className="tx-category-picker" onClick={()=>{setCategoryParent(null);setCategorySearch("");setCategoryModal(true)}}>{categories.find(c=>c.id===categoryId)?.name || "انتخاب دسته‌بندی"}</button></label>}
          {type === "expense" && <label className="tx-wide">اتصال به قسط وام<button type="button" className="tx-category-picker" onClick={()=>{setLoanPickerId(null);setLoanPickerOpen(true)}}>{selectedInstallmentId?`قسط ${pendingInstallments.find(x=>x.id===selectedInstallmentId)?.installmentNo} انتخاب شده`:"انتخاب وام و قسط (اختیاری)"}</button>{selectedInstallmentId&&<button type="button" className="tx-cancel" onClick={()=>{setSelectedInstallmentId("");setAmount("")}}>حذف اتصال قسط</button>}</label>}
          <label>کارمزد (ریال)<input inputMode="numeric" value={fee} onChange={e=>{const raw=latinDigits(e.target.value).replace(/[^0-9]/g,"");setFee(raw?new Intl.NumberFormat("fa-IR").format(Number(raw)):"")}} placeholder="در صورت وجود"/></label>
          <label className="tx-wide">پیوست رسید یا فایل<input type="file" multiple accept="image/*,.pdf,.jpg,.jpeg,.png" onChange={e=>setFiles(Array.from(e.target.files||[]))}/>{files.length>0&&<small>{files.map(f=>f.name).join("، ")}</small>}</label>
          <label className="tx-wide">شرح تراکنش<input value={description} onChange={e=>setDescription(e.target.value)} placeholder="شرح مختصر و قابل پیگیری"/></label>
        </div>
        <label className="tx-test"><input type="checkbox" checked={isTest} onChange={e=>setIsTest(e.target.checked)}/> ثبت به‌عنوان سند آزمایشی</label>
        {error && <p className="tx-error">{error}</p>}
        <button className="tx-submit" disabled={busy || accounts.length===0} onClick={()=>void save()}>{busy?"در حال ذخیره...":editingId?"ذخیره ویرایش":"ثبت تراکنش"}</button>{editingId&&<button className="tx-cancel" onClick={cancelEdit}>انصراف از ویرایش</button>}
        {accounts.length===0 && <p className="tx-warning">برای ثبت تراکنش، ابتدا در تعاریف یک حساب بانکی، صندوق یا کیف پول ایجاد کن.</p>}
      </article>
      
      <article className="tx-panel tx-list-panel"><div className="tx-title"><div><h2>دفتر تراکنش‌ها</h2><small>{visible.length.toLocaleString("fa-IR")} سند</small></div><div className="tx-filter"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="جست‌وجوی شرح یا شماره"/><select value={filterType} onChange={e=>setFilterType(e.target.value)}><option value="">همه انواع</option><option value="income">دریافت</option><option value="expense">پرداخت</option><option value="transfer">انتقال</option><option value="loan_payment">پرداخت قسط وام</option><option value="credit_payment">پرداخت قسط خرید اعتباری</option></select></div></div>
        {visible.length ? visible.map(e=><div className="tx-row" key={e.id}><span className={`tx-icon ${e.type}`}>{e.type==="income"?<ArrowDownLeft size={17}/>:e.type==="expense"?<ArrowUpRight size={17}/>:<ArrowLeftRight size={17}/>}</span><span className="tx-row-info"><b>سند {e.docNo?.toLocaleString("fa-IR")} · {entryLabel(e.type)}</b><small>{e.description} · {new Intl.DateTimeFormat("fa-IR").format(new Date(e.date))}{e.isTest?" · آزمایشی":""}</small></span><strong>{money(e.amount)}</strong><div className="tx-row-actions">
          <button className="tx-action-btn" title="جزئیات سند" onClick={()=>void openDetails(e)}><FileText size={14}/></button>
          {(e.type === "income" || e.type === "expense" || e.type === "transfer") && <>
            <button className="tx-action-btn edit" title="ویرایش سند" onClick={()=>startEdit(e)} disabled={busy}><Pencil size={14}/></button>
            <button className="tx-action-btn void" title="ابطال سند" onClick={()=>void voidEntry(e)} disabled={busy}><Ban size={14}/></button>
            {e.isTest && <button className="tx-action-btn delete" title="حذف سند آزمایشی" onClick={()=>void deleteTest(e)} disabled={busy}><Trash2 size={14}/></button>}
          </>}
        </div></div>):<div className="tx-empty">هنوز تراکنش عمومی ثبت نشده است.</div>}
      </article>
    </section>
    
    {loanPickerOpen&&<div className="tx-modal-backdrop" onClick={()=>setLoanPickerOpen(false)}><section className="tx-modal tx-category-modal" onClick={e=>e.stopPropagation()}><header><div><h2>انتخاب قسط وام</h2><small>{loanPickerId?"اقساط پرداخت‌نشده وام منتخب":"ابتدا وام را انتخاب کن"}</small></div><button onClick={()=>setLoanPickerOpen(false)}><X size={17}/></button></header>{!loanPickerId?loans.map(loan=><button className="tx-category-option" key={loan.id} onClick={()=>setLoanPickerId(loan.id)}>{loan.name}<span>انتخاب وام ←</span></button>):<><button className="tx-category-back" onClick={()=>setLoanPickerId(null)}>بازگشت به فهرست وام‌ها</button>{pendingInstallments.filter(x=>x.ownerId===loanPickerId).sort((a,b)=>a.dueDate.localeCompare(b.dueDate)||a.installmentNo-b.installmentNo).map(item=><button className="tx-category-option" key={item.id} onClick={()=>{setSelectedInstallmentId(item.id);setAmount(new Intl.NumberFormat("fa-IR").format(item.amount-(item.paidAmount||0)));setDescription(`پرداخت قسط شماره ${item.installmentNo}`);setLoanPickerOpen(false)}}>قسط {new Intl.NumberFormat("fa-IR").format(item.installmentNo)} · سررسید {item.dueDate}<span>مانده {new Intl.NumberFormat("fa-IR").format(item.amount-(item.paidAmount||0))} ریال</span></button>)}{pendingInstallments.filter(x=>x.ownerId===loanPickerId).length===0&&<p className="tx-empty">این وام قسط پرداخت‌نشده ندارد.</p>}</>}</section></div>}
    
    {categoryModal&&<div className="tx-modal-backdrop" onClick={()=>setCategoryModal(false)}><section className="tx-modal tx-category-modal" onClick={e=>e.stopPropagation()}><header><div><h2>انتخاب دسته‌بندی</h2><small>{categoryParent?"انتخاب تفصیلی":"ابتدا معین را انتخاب کن"}</small></div><button onClick={()=>setCategoryModal(false)}><X size={17}/></button></header><input className="tx-category-search" value={categorySearch} onChange={e=>setCategorySearch(e.target.value)} placeholder="جست‌وجوی دسته‌بندی..."/>{categorySearch?categories.filter(c=>c.root===(type==="income"?"income":"expenses")&&c.name.includes(categorySearch)).map(c=><button className="tx-category-option" key={c.id} onClick={()=>{setCategoryId(c.id);setCategoryModal(false)}}>{c.name}</button>):!categoryParent?categories.filter(c=>c.root===(type==="income"?"income":"expenses")&&c.parentId===(type==="income"?"income":"expenses")).map(c=><button className="tx-category-option" key={c.id} onClick={()=>setCategoryParent(c.id)}>{c.name} <span>انتخاب معین ←</span></button>):<><button className="tx-category-back" onClick={()=>setCategoryParent(null)}>بازگشت به معین‌ها</button>{categories.filter(c=>c.root===(type==="income"?"income":"expenses")&&c.parentId===categoryParent).map(c=><button className="tx-category-option" key={c.id} onClick={()=>{setCategoryId(c.id);setCategoryModal(false)}}>{c.name}</button>)}<button className="tx-category-option" onClick={()=>{setCategoryId(categoryParent);setCategoryModal(false)}}>ثبت روی خود معین</button></>}</section></div>}
    
    {detailEntry&&<div className="tx-modal-backdrop" onClick={()=>setDetailEntry(null)}><section className="tx-modal" onClick={e=>e.stopPropagation()}><header><div><h2>جزئیات سند حسابداری</h2><small>شماره {detailEntry.docNo?.toLocaleString("fa-IR")||"—"}</small></div><button onClick={()=>setDetailEntry(null)}><X size={17}/></button></header><div className="tx-modal-meta"><span>نوع: {labels[detailEntry.type as FinancialTransactionType]}</span><span>تاریخ: {new Intl.DateTimeFormat("fa-IR").format(new Date(detailEntry.date))}</span><span>شرح: {detailEntry.description}</span><span>مبلغ: {money(detailEntry.amount)}</span></div><table><thead><tr><th>حساب</th><th>بدهکار</th><th>بستانکار</th></tr></thead><tbody>{detailLines.map(line=><tr key={line.id}><td>{lineName(line)}</td><td>{line.debit?money(line.debit):"—"}</td><td>{line.credit?money(line.credit):"—"}</td></tr>)}</tbody><tfoot><tr><th>جمع</th><th>{money(detailLines.reduce((s,l)=>s+l.debit,0))}</th><th>{money(detailLines.reduce((s,l)=>s+l.credit,0))}</th></tr></tfoot></table><div className="tx-attachments"><h3>پیوست‌ها</h3>{detailAttachments.length?detailAttachments.map(file=><button key={file.id} onClick={()=>{const url=URL.createObjectURL(file.blob);const a=document.createElement("a");a.href=url;a.download=file.name;a.click();URL.revokeObjectURL(url)}}>{file.name} · {Math.ceil(file.size/1024)} KB</button>):<small>برای این سند پیوستی ثبت نشده است.</small>}</div></section></div>}
  </main>;
}