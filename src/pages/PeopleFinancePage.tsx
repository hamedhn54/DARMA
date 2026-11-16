import { useCallback, useEffect, useMemo, useState } from "react";
import { addMonths, eachDayOfInterval, endOfMonth, format, getDay, isValid, parse, startOfMonth, subMonths } from "date-fns-jalali";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, CalendarDays, Check, ChevronLeft, ChevronRight, FileText, HandCoins, Pencil, RefreshCw, Search, Trash2, UserRound, Wallet, X, Ban, Info } from "lucide-react";
import { definitionsDb, type DefinitionRecord, type JournalEntry, type JournalLine } from "../database/definitionsDb";
import { deleteTestPersonOperation, getCashBalances, getPersonBalances, getPersonHistory, postPersonOperation, updatePersonOperation, voidPersonOperation, type PersonBalance, type PersonOperation, type PersonJournalEntry } from "../services/personLedgerService";
import "./PeopleFinancePage.css";

const fmt = (n: number) => new Intl.NumberFormat("fa-IR").format(Math.abs(n)) + " ریال";
const numberText = (n: number) => new Intl.NumberFormat("fa-IR").format(n);
const toLatin = (value: string) => value.replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
const parseAmount = (value: string) => Number(toLatin(value).replace(/[^0-9]/g, ""));
const jalaliText = (date: Date) => format(date, "yyyy/MM/dd");
const parseJalali = (value: string) => {
  const normalized = toLatin(value).replace(/-/g, "/");
  const parsed = parse(normalized, "yyyy/MM/dd", new Date());
  return isValid(parsed) && jalaliText(parsed) === normalized ? parsed : null;
};
const opLabels: Record<JournalEntry["type"], string> = { lend: "قرض دادن", borrow: "قرض گرفتن", collect: "دریافت طلب", repay: "پرداخت بدهی", offset: "تهاتر", income: "دریافت", expense: "پرداخت", transfer: "انتقال", loan_receive: "دریافت وام", loan_payment: "پرداخت قسط وام", credit_purchase: "خرید اعتباری", credit_payment: "پرداخت قسط اعتباری" };
const opSigns: Record<PersonOperation, string> = { lend: "طلب جدید", borrow: "بدهی جدید", collect: "کاهش طلب", repay: "کاهش بدهی", offset: "تهاتر" };
const weekdays = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

function JalaliDateField({ value, onChange, label }: { value: Date | null; onChange: (date: Date) => void; label: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(value ? jalaliText(value) : "");
  const [month, setMonth] = useState(startOfMonth(value || new Date()));
  useEffect(() => { setText(value ? jalaliText(value) : ""); }, [value]);
  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
  const offset = (getDay(startOfMonth(month)) + 1) % 7;
  return <label className="pf-date-field">{label}<div className="pf-date-control"><input value={text} onChange={e => { setText(e.target.value); const d = parseJalali(e.target.value); if (d) onChange(d); }} placeholder="۱۴۰۵/۰۱/۰۱"/><button type="button" aria-label="بازکردن تقویم" onClick={() => { setMonth(startOfMonth(value || new Date())); setOpen(v => !v); }}><CalendarDays size={16}/></button></div>{open && <div className="pf-calendar" dir="rtl"><div className="pf-calendar-head"><button type="button" onClick={() => setMonth(m => addMonths(m, 1))}><ChevronRight size={17}/></button><b>{format(month, "MMMM yyyy")}</b><button type="button" onClick={() => setMonth(m => subMonths(m, 1))}><ChevronLeft size={17}/></button></div><div className="pf-calendar-grid">{weekdays.map(d => <span className="weekday" key={d}>{d}</span>)}{Array.from({ length: offset }, (_, i) => <span key={`blank-${i}`}/>)}{days.map(day => <button type="button" key={day.toISOString()} className={value && jalaliText(day) === jalaliText(value) ? "selected" : ""} onClick={() => { onChange(day); setOpen(false); }}>{format(day, "d")}</button>)}</div><div className="pf-calendar-foot"><button type="button" onClick={() => { onChange(new Date()); setOpen(false); }}>امروز</button><button type="button" onClick={() => setOpen(false)}>بستن</button></div></div>}</label>;
}

export default function PeopleFinancePage() {
  const [people, setPeople] = useState<DefinitionRecord[]>([]);
  const [accounts, setAccounts] = useState<DefinitionRecord[]>([]);
  const [balances, setBalances] = useState<PersonBalance[]>([]);
  const [cashBalances, setCashBalances] = useState<{ accountId: string; balance: number }[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [history, setHistory] = useState<PersonJournalEntry[]>([]);
  const [query, setQuery] = useState("");
  const [type, setType] = useState<PersonOperation>("lend");
  const [amount, setAmount] = useState("");
  const [cashAccountId, setCashAccountId] = useState("");
  const [date, setDate] = useState(new Date());
  const [description, setDescription] = useState("");
  const [isTest, setIsTest] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterPerson, setFilterPerson] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [showVoided, setShowVoided] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailLines, setDetailLines] = useState<JournalLine[]>([]);

  const refresh = useCallback(async () => {
    const [p, a, b, cb, h] = await Promise.all([
      definitionsDb.definitions.where("kind").equals("person").toArray(), definitionsDb.definitions.toArray(),
      getPersonBalances(), getCashBalances(), getPersonHistory(),
    ]);
    setPeople(p); setAccounts(a.filter(x => ["bank", "cash", "wallet"].includes(x.kind)));
    setBalances(b); setCashBalances(cb); setHistory(h);
    setSelectedId(current => current || p[0]?.id || "");
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const filteredPeople = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    return people.filter(p => !q || p.name.toLocaleLowerCase().includes(q));
  }, [people, query]);
  const selected = people.find(p => p.id === selectedId);
  const balance = balances.find(b => b.personId === selectedId) || { receivable: 0, payable: 0, net: 0 };
  const totals = balances.reduce((t, b) => ({ receivable: t.receivable + b.receivable, payable: t.payable + b.payable }), { receivable: 0, payable: 0 });
  
  const filteredHistory = useMemo(() => history.filter(entry => {
    if (!showVoided && entry.status === "void") return false;
    if (filterPerson && entry.personId !== filterPerson) return false;
    if (filterType && entry.type !== filterType) return false;
    const day = jalaliText(new Date(entry.date));
    if (filterFrom && day < filterFrom) return false;
    if (filterTo && day > filterTo) return false;
    return true;
  }), [history, filterPerson, filterType, filterFrom, filterTo, showVoided]);

  const resetForm = () => { setEditingId(null); setAmount(""); setDescription(""); setType("lend"); setCashAccountId(""); setDate(new Date()); setIsTest(false); setError(""); };
  
  const startEdit = (entry: PersonJournalEntry) => {
    setEditingId(entry.id); setSelectedId(entry.personId); setType(entry.type); setAmount(numberText(entry.amount));
    setCashAccountId(entry.cashAccountId || ""); setDate(new Date(entry.date)); setDescription(entry.description); setIsTest(!!entry.isTest); setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  
  const submit = async () => {
    setError("");
    if (!selectedId) { setError("ابتدا یک شخص انتخاب کن."); return; }
    const numericAmount = parseAmount(amount);
    if (!numericAmount || numericAmount <= 0) { setError("مبلغ معتبر را به ریال وارد کن."); return; }
    if (type !== "offset" && !cashAccountId) { setError("حساب بانکی، صندوق یا کیف پول را انتخاب کن."); return; }
    setBusy(true);
    try {
      const input = { personId: selectedId, type, amount: numericAmount, cashAccountId: type === "offset" ? undefined : cashAccountId, date: date.toISOString(), description, isTest };
      if (editingId) await updatePersonOperation(editingId, input); else await postPersonOperation(input);
      resetForm(); await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "ذخیره عملیات انجام نشد."); }
    finally { setBusy(false); }
  };
  
  const openDetails = async (entry: PersonJournalEntry) => {
    setDetailId(entry.id); setDetailLines(await definitionsDb.journalLines.where("entryId").equals(entry.id).toArray());
  };
  
  const voidEntry = async (entry: PersonJournalEntry) => {
    const reason = window.prompt("علت ابطال سند را وارد کن:", "ثبت اشتباه");
    if (reason === null) return;
    if (!window.confirm(`سند شماره ${entry.docNo ?? "—"} باطل شود؟`)) return;
    try { await voidPersonOperation(entry.id, reason); await refresh(); if (detailId === entry.id) setDetailId(null); }
    catch (e) { window.alert(e instanceof Error ? e.message : "ابطال انجام نشد."); }
  };
  
  const deleteTest = async (entry: PersonJournalEntry) => {
    if (!window.confirm(`سند آزمایشی شماره ${entry.docNo ?? "—"} برای همیشه حذف شود؟`)) return;
    try { await deleteTestPersonOperation(entry.id); await refresh(); if (detailId === entry.id) setDetailId(null); }
    catch (e) { window.alert(e instanceof Error ? e.message : "حذف انجام نشد."); }
  };
  
  const markTest = async (entry: PersonJournalEntry) => {
    if (!window.confirm("این سند به‌عنوان آزمایشی علامت‌گذاری شود؟ پس از آن امکان حذف کنترل‌شده خواهد داشت.")) return;
    await definitionsDb.journalEntries.update(entry.id, { isTest: true }); await refresh();
  };
  
  const personName = (id: string) => people.find(p => p.id === id)?.name || "شخص حذف‌شده";
  const accountName = (id?: string) => accounts.find(a => a.id === id)?.name || "—";

  return <main className="people-finance" dir="rtl">
    <header className="pf-heading"><div><span>مدیریت مطالبات و تعهدات</span><h1>اشخاص و گردش مالی</h1><p>ثبت قرض، بازپرداخت و تهاتر با سند حسابداری متوازن</p></div><button onClick={() => void refresh()}><RefreshCw size={16}/> به‌روزرسانی</button></header>
    <section className="pf-summary">
      <article><span>مجموع طلب ناخالص</span><b>{fmt(totals.receivable)}</b></article>
      <article><span>مجموع بدهی ناخالص</span><b>{fmt(totals.payable)}</b></article>
      <article><span>خالص مطالبات</span><b>{fmt(totals.receivable - totals.payable)}</b><small>طلب منهای بدهی</small></article>
    </section>
    <section className="pf-cash-strip"><b>مانده حساب‌های نقد و بانک</b>{accounts.map(account => <span key={account.id}>{account.name}: <strong>{fmt(cashBalances.find(x => x.accountId === account.id)?.balance || 0)}</strong></span>)}</section>
    <div className="pf-layout">
      <section className="pf-panel pf-people"><div className="pf-panel-title"><div><h2>فهرست اشخاص</h2><small>{people.length.toLocaleString("fa-IR")} شخص</small></div></div>
        <label className="pf-search"><Search size={16}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="جست‌وجوی نام شخص"/></label>
        {filteredPeople.length ? filteredPeople.map(p => { const b = balances.find(x => x.personId === p.id); return <button key={p.id} className={`pf-person ${selectedId === p.id ? "active" : ""}`} onClick={() => setSelectedId(p.id)}><span className="pf-avatar"><UserRound size={18}/></span><span className="pf-person-name"><b>{p.name}</b><small>طلب: {fmt(b?.receivable || 0)} · بدهی: {fmt(b?.payable || 0)}</small></span><span className="pf-net">{(b?.net || 0) >= 0 ? "طلبکار" : "بدهکار"}<small>{fmt(b?.net || 0)}</small></span></button>; }) : <div className="pf-empty">شخصی ثبت نشده است. ابتدا از بخش تعاریف، شخص جدید اضافه کن.</div>}
      </section>
      <section className="pf-main">
        {selected ? <>
          <div className="pf-panel pf-person-detail"><div className="pf-panel-title"><div><h2>{selected.name}</h2><small>پرونده مالی شخص</small></div><span className="pf-role">{selected.personRole === "creditor" ? "طلبکار" : selected.personRole === "debtor" ? "بدهکار" : "طلبکار و بدهکار"}</span></div>
            <div className="pf-balance-grid"><div><small>طلب ناخالص باقی‌مانده</small><b>{fmt(balance.receivable)}</b></div><div><small>بدهی ناخالص باقی‌مانده</small><b>{fmt(balance.payable)}</b></div><div><small>خالص وضعیت</small><b>{balance.net >= 0 ? "طلب " : "بدهی "}{fmt(balance.net)}</b></div></div>
          </div>
          <div className="pf-panel pf-operation"><div className="pf-panel-title"><div><h2>{editingId ? "ویرایش سند مالی" : "ثبت عملیات مالی"}</h2><small>{editingId ? "تغییرات روی همان سند ذخیره می‌شود." : "هر عملیات به‌صورت سند دوطرفه ذخیره می‌شود."}</small></div><HandCoins size={20}/></div>
            
            {/* نمایش موجودی فعلی شخص بالای فرم */}
            <div className="pf-form-hint" style={{ background: 'var(--surface-soft)', padding: '10px', borderRadius: '8px', marginBottom: '15px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--muted)' }}>
              <Info size={16} />
              وضعیت فعلی {selected.name}: {balance.net >= 0 ? "طلبکار" : "بدهکار"} به مبلغ {fmt(balance.net)}
            </div>

            <div className="pf-form">
              <label>نوع عملیات<select value={type} onChange={e => setType(e.target.value as PersonOperation)}>{Object.entries(opLabels).filter(([v]) => ["lend", "borrow", "collect", "repay", "offset"].includes(v)).map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></label>
              <label>مبلغ (ریال)<input inputMode="numeric" value={amount} onChange={e => { const n = parseAmount(e.target.value); setAmount(n ? numberText(n) : ""); }} placeholder="مبلغ را وارد کن"/></label>
              {type !== "offset" && <label>حساب بانکی / صندوق<select value={cashAccountId} onChange={e => setCashAccountId(e.target.value)}><option value="">انتخاب حساب</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>}
              <JalaliDateField label="تاریخ شمسی" value={date} onChange={setDate}/>
              <label className="pf-wide">شرح عملیات<input value={description} onChange={e => setDescription(e.target.value)} placeholder={opSigns[type]}/></label>
            </div>
            <label className="pf-test-check"><input type="checkbox" checked={isTest} onChange={e => setIsTest(e.target.checked)}/> این سند آزمایشی است (بعداً قابل حذف کنترل‌شده خواهد بود)</label>
            <div className="pf-operation-hint">{type === "lend" ? "طلب از شخص افزایش می‌یابد و موجودی حساب انتخابی کاهش پیدا می‌کند." : type === "borrow" ? "بدهی به شخص افزایش می‌یابد و موجودی حساب انتخابی افزایش پیدا می‌کند." : type === "collect" ? "طلب کاهش می‌یابد و وجه به حساب انتخابی وارد می‌شود." : type === "repay" ? "بدهی کاهش می‌یابد و وجه از حساب انتخابی خارج می‌شود." : "طلب و بدهی این شخص به یک میزان کاهش می‌یابد؛ وجه نقد جابه‌جا نمی‌شود."}</div>
            {error && <div className="pf-error">{error}</div>}
            <div className="pf-form-actions"><button className="pf-submit" disabled={busy} onClick={() => void submit()}>{busy ? "در حال ذخیره..." : editingId ? "ذخیره ویرایش" : "ثبت سند مالی"}</button>{editingId && <button className="pf-cancel" onClick={resetForm}>انصراف</button>}</div>
            {accounts.length === 0 && <p className="pf-warning"><Wallet size={15}/> برای عملیات نقدی ابتدا در بخش تعاریف یک حساب بانکی، صندوق یا کیف پول بساز.</p>}
          </div>
        </> : <div className="pf-panel pf-empty">برای شروع، از بخش تعاریف یک شخص ثبت کن.</div>}
      </section>
    </div>
    <section className="pf-panel pf-history"><div className="pf-panel-title"><div><h2>تاریخچه اسناد مالی</h2><small>{filteredHistory.length.toLocaleString("fa-IR")} سند مطابق فیلتر</small></div><FileText size={19}/></div>
      <div className="pf-filters"><label>شخص<select value={filterPerson} onChange={e => setFilterPerson(e.target.value)}><option value="">همه اشخاص</option>{people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>نوع عملیات<select value={filterType} onChange={e => setFilterType(e.target.value)}><option value="">همه عملیات</option>{Object.entries(opLabels).filter(([v]) => ["lend", "borrow", "collect", "repay", "offset"].includes(v)).map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></label><JalaliDateField label="از تاریخ" value={filterFrom ? parseJalali(filterFrom) : null} onChange={d => setFilterFrom(jalaliText(d))}/><JalaliDateField label="تا تاریخ" value={filterTo ? parseJalali(filterTo) : null} onChange={d => setFilterTo(jalaliText(d))}/><label className="pf-show-void"><input type="checkbox" checked={showVoided} onChange={e => setShowVoided(e.target.checked)}/> نمایش اسناد باطل‌شده</label><button className="pf-clear-filter" onClick={() => { setFilterPerson(""); setFilterType(""); setFilterFrom(""); setFilterTo(""); setShowVoided(false); }}>پاک‌کردن فیلترها</button></div>
      {filteredHistory.length ? filteredHistory.map(entry => <div className={`pf-history-row ${entry.status === "void" ? "voided" : ""}`} key={entry.id}><span className={`pf-history-icon ${entry.type}`}>{entry.type === "lend" || entry.type === "repay" ? <ArrowUpRight size={17}/> : entry.type === "borrow" || entry.type === "collect" ? <ArrowDownLeft size={17}/> : <ArrowLeftRight size={17}/>}</span><span className="pf-history-info"><b>سند {numberText(entry.docNo || 0)} · {opLabels[entry.type]} · {personName(entry.personId)}</b><small>{entry.description} · {jalaliText(new Date(entry.date))} · حساب: {accountName(entry.cashAccountId)} {entry.isTest ? "· آزمایشی" : ""} {entry.status === "void" ? "· باطل‌شده" : ""}</small></span><strong>{fmt(entry.amount)}</strong><div className="pf-row-actions"><button title="جزئیات سند" onClick={() => void openDetails(entry)}><FileText size={15}/></button>{entry.status !== "void" && <button title="ویرایش سند" onClick={() => startEdit(entry)}><Pencil size={15}/></button>}{entry.status !== "void" && <button title="ابطال سند" onClick={() => void voidEntry(entry)}><Ban size={15}/></button>}{entry.isTest && <button title="حذف سند آزمایشی" onClick={() => void deleteTest(entry)}><Trash2 size={15}/></button>}{!entry.isTest && entry.status !== "void" && <button title="علامت‌گذاری به‌عنوان آزمایشی" onClick={() => void markTest(entry)}><Check size={15}/></button>}</div></div>) : <div className="pf-empty">سندی با این فیلترها پیدا نشد.</div>}
    </section>
    {detailId && <div className="pf-modal-backdrop" onClick={() => setDetailId(null)}><section className="pf-modal" onClick={e => e.stopPropagation()}><header><div><h2>جزئیات سند حسابداری</h2><small>شماره {numberText(history.find(x => x.id === detailId)?.docNo || 0)}</small></div><button onClick={() => setDetailId(null)}><X size={18}/></button></header>{(() => { const entry = history.find(x => x.id === detailId); if (!entry) return null; return <><div className="pf-modal-meta"><span>شخص: {personName(entry.personId)}</span><span>تاریخ: {jalaliText(new Date(entry.date))}</span><span>نوع: {opLabels[entry.type]}</span><span>شرح: {entry.description}</span><span>مبلغ: {fmt(entry.amount)}</span><span>وضعیت: {entry.status === "void" ? "باطل‌شده" : "فعال"}</span></div><table className="pf-journal-table"><thead><tr><th>حساب</th><th>بدهکار</th><th>بستانکار</th></tr></thead><tbody>{detailLines.map(line => <tr key={line.id}><td>{line.personId ? `${personName(line.personId)} · ${line.accountCode.includes("receivable") ? "مطالبات" : "بدهی اشخاص"}` : accountName(line.cashAccountId)}</td><td>{line.debit ? fmt(line.debit) : "—"}</td><td>{line.credit ? fmt(line.credit) : "—"}</td></tr>)}</tbody><tfoot><tr><th>جمع</th><th>{fmt(detailLines.reduce((s,l) => s + l.debit,0))}</th><th>{fmt(detailLines.reduce((s,l) => s + l.credit,0))}</th></tr></tfoot></table></>; })()}</section></div>}
  </main>;
}