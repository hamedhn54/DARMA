import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Plus, Search, ChevronDown, ChevronLeft, Pencil, Trash2, Landmark,
  Wallet, Banknote, UserRound, HandCoins, Folder, FolderPlus, X,
  Check, AlertCircle, RefreshCw
} from "lucide-react";
import {
  definitionsDb, ROOTS, seedRootCategories,
  type DefinitionRecord, type RootGroup, type DefinitionKind
} from "../database/definitionsDb";
import { getCashBalances } from "../services/personLedgerService";
import "./DefinitionsPage.css";
import "./DefinitionsPeople.css";

type Draft = {
  name: string; root: RootGroup; parentId: string; kind: DefinitionKind;
  bankName: string; cardNumber: string; accountNumber: string; iban: string;
  initialBalance: string; personRole: "creditor" | "debtor" | "both";
  loanTiming: "existing" | "current"; principal: string; installmentAmount: string;
  totalInstallments: string; paidInstallments: string; firstDueDate: string; note: string;
};

const blankDraft = (root: RootGroup): Draft => ({
  name: "", root, parentId: root, kind: "account", bankName: "", cardNumber: "",
  accountNumber: "", iban: "", initialBalance: "", personRole: "both",
  loanTiming: "current", principal: "", installmentAmount: "", totalInstallments: "",
  paidInstallments: "0", firstDueDate: "", note: "",
});

const money = (value?: number) => new Intl.NumberFormat("fa-IR").format(value || 0) + " ریال";
const kindLabel: Record<string, string> = {
  category: "معین", account: "تفصیلی", bank: "حساب بانکی", cash: "صندوق",
  wallet: "کیف پول", person: "شخص", loan: "وام",
};
const iconFor = (kind: DefinitionKind) => {
  if (kind === "bank") return <Landmark size={17}/>;
  if (kind === "cash") return <Banknote size={17}/>;
  if (kind === "wallet") return <Wallet size={17}/>;
  if (kind === "person") return <UserRound size={17}/>;
  if (kind === "loan") return <HandCoins size={17}/>;
  return <Folder size={17}/>;
};

export default function DefinitionsPage() {
  const [records, setRecords] = useState<DefinitionRecord[]>([]);
  const [cashBalances, setCashBalances] = useState<{ accountId: string; balance: number }[]>([]);
  const [activeRoot, setActiveRoot] = useState<RootGroup>("assets");
  const [search, setSearch] = useState("");
  const [peopleSearch, setPeopleSearch] = useState("");
  const [expanded, setExpanded] = useState<string[]>(["assets"]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(blankDraft("assets"));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    await seedRootCategories();
    const [allRecords, balances] = await Promise.all([definitionsDb.definitions.toArray(), getCashBalances()]);
    setRecords(allRecords);
    setCashBalances(balances);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const roots = useMemo(() => records.filter(x => x.parentId === null), [records]);
  const activeRecords = useMemo(() => records.filter(x => x.root === activeRoot), [records, activeRoot]);
  // اشخاص در فهرست مستقل مدیریت می‌شوند و عضو درخت حساب‌ها نیستند.
  const childrenOf = (parentId: string) => activeRecords.filter(x => x.parentId === parentId && x.kind !== "person");
  const people = useMemo(() => records.filter(x => x.kind === "person"), [records]);
  const filteredPeople = useMemo(() => {
    const q = peopleSearch.trim().toLocaleLowerCase();
    return q ? people.filter(x => x.name.toLocaleLowerCase().includes(q)) : people;
  }, [people, peopleSearch]);
  const filtered = search.trim()
    ? activeRecords.filter(x => x.name.toLowerCase().includes(search.trim().toLowerCase()))
    : activeRecords;

  const openNew = (parentId: string, kind: DefinitionKind) => {
    const d = blankDraft(kind === "person" ? "assets" : activeRoot);
    d.parentId = kind === "person" ? "assets" : parentId;
    d.kind = kind;
    setDraft(d); setEditing(null); setError(""); setModal(true);
  };

  const openEdit = (record: DefinitionRecord) => {
    setDraft({
      ...blankDraft(record.root), name: record.name, root: record.root,
      parentId: record.parentId || record.root, kind: record.kind,
      bankName: record.bankName || "", cardNumber: record.cardNumber || "",
      accountNumber: record.accountNumber || "", iban: record.iban || "",
      initialBalance: record.initialBalance == null ? "" : String(record.initialBalance),
      personRole: record.personRole || "both", loanTiming: record.loanTiming || "current",
      principal: record.principal == null ? "" : String(record.principal),
      installmentAmount: record.installmentAmount == null ? "" : String(record.installmentAmount),
      totalInstallments: record.totalInstallments == null ? "" : String(record.totalInstallments),
      paidInstallments: record.paidInstallments == null ? "0" : String(record.paidInstallments),
      firstDueDate: record.firstDueDate || "", note: record.note || "",
    });
    setEditing(record.id); setError(""); setModal(true);
  };

  const save = async () => {
    if (!draft.name.trim()) { setError("نام را وارد کن."); return; }
    if (draft.kind === "bank" || draft.kind === "cash" || draft.kind === "wallet" || draft.kind === "account") {
      const parent = await definitionsDb.definitions.get(draft.parentId);
      if (!parent || parent.kind !== "category") {
        setError("ابتدا یک حساب معین انتخاب کن؛ حساب تفصیلی باید زیر معین ثبت شود."); return;
      }
    }
    if (draft.kind === "loan" && (!draft.principal || Number(draft.principal) <= 0)) {
      setError("مبلغ اصل وام باید بیشتر از صفر باشد."); return;
    }
    setBusy(true); setError("");
    try {
      const now = new Date().toISOString();
      const old = editing ? await definitionsDb.definitions.get(editing) : undefined;
      const isPerson = draft.kind === "person";
      const record: DefinitionRecord = {
        id: editing || crypto.randomUUID(), name: draft.name.trim(),
        root: isPerson ? "assets" : draft.root,
        parentId: isPerson ? "assets" : draft.parentId, kind: draft.kind,
        createdAt: old?.createdAt || now, updatedAt: now,
        ...(draft.kind === "bank" || draft.kind === "cash" || draft.kind === "wallet" ? {
          bankName: draft.bankName || undefined, cardNumber: draft.cardNumber || undefined,
          accountNumber: draft.accountNumber || undefined, iban: draft.iban || undefined,
          initialBalance: Number(draft.initialBalance || 0),
        } : {}),
        ...(draft.kind === "person" ? { personRole: draft.personRole } : {}),
        ...(draft.kind === "loan" ? {
          loanTiming: draft.loanTiming, principal: Number(draft.principal || 0),
          installmentAmount: Number(draft.installmentAmount || 0),
          totalInstallments: Number(draft.totalInstallments || 0),
          paidInstallments: Number(draft.paidInstallments || 0),
          firstDueDate: draft.firstDueDate || undefined,
          affectsCashOnCreate: draft.loanTiming === "current",
        } : {}),
        note: draft.note || undefined,
      };
      await definitionsDb.definitions.put(record);
      await refresh(); setModal(false);
    } catch {
      setError("ذخیره انجام نشد. دوباره تلاش کن.");
    } finally { setBusy(false); }
  };

  const remove = async (record: DefinitionRecord) => {
    if (record.parentId === null) return;
    const descendants = new Set<string>([record.id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const item of records) if (item.parentId && descendants.has(item.parentId) && !descendants.has(item.id)) {
        descendants.add(item.id); changed = true;
      }
    }
    if (!window.confirm(`«${record.name}» و ${descendants.size - 1} زیرمجموعه آن حذف شود؟`)) return;
    await definitionsDb.definitions.bulkDelete([...descendants]);
    await refresh();
  };

  const toggle = (id: string) => setExpanded(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const renderRecord = (record: DefinitionRecord, depth = 0): ReactNode => {
    const kids = childrenOf(record.id);
    const isOpen = expanded.includes(record.id);
    const isRoot = record.parentId === null;
    if (search && !filtered.some(x => x.id === record.id) && !kids.some(k => filtered.some(f => f.id === k.id))) return null;
    return (
      <div className="darma-tree-node" key={record.id}>
        <div className={`darma-tree-row ${isRoot ? "is-root" : ""}`} style={{ paddingInlineStart: 12 + depth * 24 }}>
          <button className="darma-tree-toggle" onClick={() => toggle(record.id)} aria-label="باز و بسته کردن">
            {kids.length ? (isOpen ? <ChevronDown size={16}/> : <ChevronLeft size={16}/>) : <span className="darma-tree-dot"/>}
          </button>
          <span className={`darma-kind-icon kind-${record.kind}`}>{iconFor(record.kind)}</span>
          <div className="darma-tree-name">
            <strong>{record.name}</strong>
            {!isRoot && <small>{kindLabel[record.kind]}</small>}
            {(record.kind === "bank" || record.kind === "cash" || record.kind === "wallet") &&
              <small className="darma-balance">{money(cashBalances.find(x => x.accountId === record.id)?.balance ?? record.initialBalance)}</small>}
            {record.kind === "loan" && <small>{money(record.principal)} · {record.paidInstallments || 0} از {record.totalInstallments || 0} قسط پرداخت‌شده</small>}
          </div>
          {!isRoot && <div className="darma-row-actions">
            <button title="ویرایش" onClick={() => openEdit(record)}><Pencil size={15}/></button>
            <button title="حذف" onClick={() => void remove(record)}><Trash2 size={15}/></button>
          </div>}
          {record.kind === "category" && <button className="darma-add-child" onClick={() => openNew(record.id, "account")}><Plus size={14}/> افزودن تفصیلی</button>}
        </div>
        {isOpen && kids.map(k => renderRecord(k, depth + 1))}
      </div>
    );
  };

  const selectedRoot = ROOTS.find(x => x.id === activeRoot)!;

  return (
    <main className="darma-definitions" dir="rtl">
      <header className="darma-def-header">
        <div><span className="darma-eyebrow">مدیریت ساختار مالی</span><h1>تعاریف و حساب‌ها</h1>
          <p>گروه‌بندی حساب‌ها، اشخاص، بانک‌ها و وام‌ها را مدیریت کن.</p></div>
        <button className="darma-primary" onClick={() => openNew(activeRoot, "category")}><FolderPlus size={17}/> معین جدید</button>
      </header>

      <nav className="darma-root-tabs">
        {ROOTS.map(root => <button key={root.id} className={activeRoot === root.id ? "active" : ""}
          onClick={() => { setActiveRoot(root.id); setDraft(blankDraft(root.id)); }}>
          <span className={`darma-root-mark root-${root.id}`}/>{root.name}
          <small>{records.filter(r => r.root === root.id && r.parentId !== null && r.kind !== "person").length.toLocaleString("fa-IR")}</small>
        </button>)}
      </nav>

      <section className="darma-def-panel">
        <div className="darma-panel-toolbar">
          <div><h2>{selectedRoot.name}</h2><p>ساختار معین و تفصیلی این گروه</p></div>
          <label className="darma-search"><Search size={16}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="جست‌وجوی حساب..."/>
            {search && <button onClick={() => setSearch("")}><X size={14}/></button>}</label>
        </div>
        <div className="darma-tree">
          {roots.filter(r => r.id === activeRoot).map(r => renderRecord(r))}
          {activeRecords.length <= 1 && <div className="darma-empty"><Folder size={28}/><strong>هنوز معینی ثبت نشده</strong><span>برای شروع، یک حساب معین ایجاد کن.</span></div>}
        </div>
        <div className="darma-panel-footer">
          <span>گروه‌های اصلی دارما ثابت هستند و قابل حذف یا تغییر نام نیستند.</span>
          <button onClick={() => void refresh()}><RefreshCw size={14}/> به‌روزرسانی</button>
        </div>
      </section>

      <section className="darma-def-panel darma-people-panel">
        <div className="darma-panel-toolbar">
          <div><h2>اشخاص</h2><p>فهرست مستقل اشخاص برای ثبت و پیگیری طلب و بدهی‌های شخصی</p></div>
          <div className="darma-people-toolbar">
            <label className="darma-search"><Search size={16}/><input value={peopleSearch} onChange={e => setPeopleSearch(e.target.value)} placeholder="جست‌وجوی اشخاص..."/>
              {peopleSearch && <button onClick={() => setPeopleSearch("")}><X size={14}/></button>}</label>
            <button className="darma-primary" onClick={() => openNew("assets", "person")}><Plus size={16}/> شخص جدید</button>
          </div>
        </div>
        <div className="darma-tree darma-people-list">
          {filteredPeople.length === 0 ? <div className="darma-empty"><UserRound size={28}/><strong>{people.length ? "شخصی با این نام پیدا نشد" : "هنوز شخصی ثبت نشده"}</strong><span>{people.length ? "عبارت جست‌وجو را تغییر بده." : "برای شروع، اولین شخص را ثبت کن."}</span></div> :
            filteredPeople.map(person => <div className="darma-tree-row darma-person-row" key={person.id}>
              <span className="darma-kind-icon kind-person"><UserRound size={17}/></span>
              <div className="darma-tree-name"><strong>{person.name}</strong><small>{person.personRole === "creditor" ? "فقط طلبکار" : person.personRole === "debtor" ? "فقط بدهکار" : "طلبکار و بدهکار"}</small>{person.note && <small>{person.note}</small>}</div>
              <div className="darma-row-actions">
                <button title="ویرایش شخص" onClick={() => openEdit(person)}><Pencil size={15}/></button>
                <button title="حذف شخص" onClick={() => void remove(person)}><Trash2 size={15}/></button>
              </div>
            </div>)}
        </div>
        <div className="darma-panel-footer"><span>{people.length.toLocaleString("fa-IR")} شخص ثبت‌شده</span><button onClick={() => void refresh()}><RefreshCw size={14}/> به‌روزرسانی</button></div>
      </section>

      <section className="darma-special-grid">
        <article><div className="darma-special-icon"><Landmark/></div><div><strong>بانک، صندوق و کیف پول</strong><p>به‌عنوان حساب تفصیلی زیر یک معین ثبت می‌شوند.</p></div>
          <button onClick={() => openNew(activeRoot, "bank")}><Plus size={15}/> حساب بانکی</button>
          <button onClick={() => openNew(activeRoot, "cash")}><Plus size={15}/> صندوق</button>
          <button onClick={() => openNew(activeRoot, "wallet")}><Plus size={15}/> کیف پول</button>
        </article>
        <article><div className="darma-special-icon"><UserRound/></div><div><strong>اشخاص</strong><p>فهرست اشخاص در بخش مستقل بالا مدیریت می‌شود.</p></div></article>
        <article><div className="darma-special-icon"><HandCoins/></div><div><strong>وام‌ها</strong><p>ثبت وام‌های قبلی یا وام‌هایی که اکنون دریافت می‌کنی.</p></div>
          <button onClick={() => openNew("liabilities", "loan")}><Plus size={15}/> وام جدید</button>
        </article>
      </section>

      {modal && <div className="darma-modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setModal(false); }}>
        <section className="darma-modal" dir="rtl">
          <header><div><span className="darma-eyebrow">فرم اطلاعات</span><h2>{editing ? "ویرایش" : "افزودن"} {kindLabel[draft.kind]}</h2></div>
            <button className="darma-close" onClick={() => setModal(false)}><X/></button></header>
          <div className="darma-form-grid">
            <label className="full">نام <b>*</b><input autoFocus value={draft.name} onChange={e => setDraft({...draft, name:e.target.value})} placeholder="نام را وارد کن"/></label>
            {draft.kind !== "person" && <>
              <label>گروه اصلی<select value={draft.root} disabled={draft.kind === "loan"} onChange={e => setDraft({...draft, root:e.target.value as RootGroup, parentId:e.target.value})}>
                {ROOTS.map(r => <option value={r.id} key={r.id}>{r.name}</option>)}</select></label>
              <label>حساب معین<select value={draft.parentId} onChange={e => setDraft({...draft,parentId:e.target.value})}>
                <option value={draft.root}>انتخاب معین (ریشه)</option>
                {records.filter(r => r.root === draft.root && r.kind === "category").map(r => <option value={r.id} key={r.id}>{r.name}</option>)}
              </select></label>
            </>}
            {(draft.kind === "bank" || draft.kind === "cash" || draft.kind === "wallet") && <>
              {draft.kind === "bank" && <label>نام بانک<input value={draft.bankName} onChange={e=>setDraft({...draft,bankName:e.target.value})} placeholder="مثلاً بانک ملت"/></label>}
              <label>مانده اولیه (ریال)<input inputMode="numeric" value={draft.initialBalance} onChange={e=>setDraft({...draft,initialBalance:e.target.value.replace(/[^\d]/g,"")})} placeholder="۰"/></label>
              {draft.kind === "bank" && <>
                <label>شماره کارت<input value={draft.cardNumber} onChange={e=>setDraft({...draft,cardNumber:e.target.value})} placeholder="اختیاری"/></label>
                <label>شماره حساب<input value={draft.accountNumber} onChange={e=>setDraft({...draft,accountNumber:e.target.value})} placeholder="اختیاری"/></label>
                <label className="full">شماره شبا<input value={draft.iban} onChange={e=>setDraft({...draft,iban:e.target.value})} placeholder="اختیاری"/></label>
              </>}
            </>}
            {draft.kind === "person" && <label>نوع رابطه<select value={draft.personRole} onChange={e=>setDraft({...draft,personRole:e.target.value as Draft["personRole"]})}>
              <option value="both">طلبکار و بدهکار</option><option value="creditor">فقط طلبکار</option><option value="debtor">فقط بدهکار</option>
            </select></label>}
            {draft.kind === "loan" && <>
              <label className="full">زمان دریافت وام<select value={draft.loanTiming} onChange={e=>setDraft({...draft,loanTiming:e.target.value as Draft["loanTiming"]})}>
                <option value="current">اکنون دریافت می‌کنم</option><option value="existing">قبلاً دریافت کرده‌ام</option>
              </select><small className="darma-help">{draft.loanTiming === "existing" ? "ثبت وام قبلی مانده حساب بانکی را افزایش نمی‌دهد." : "این وام به‌عنوان دریافت جدید ثبت می‌شود؛ اثر واقعی بر مانده پس از اتصال به موتور حسابداری اعمال خواهد شد."}</small></label>
              <label>مبلغ اصل وام (ریال)<input inputMode="numeric" value={draft.principal} onChange={e=>setDraft({...draft,principal:e.target.value.replace(/[^\d]/g,"")})}/></label>
              <label>مبلغ هر قسط (ریال)<input inputMode="numeric" value={draft.installmentAmount} onChange={e=>setDraft({...draft,installmentAmount:e.target.value.replace(/[^\d]/g,"")})}/></label>
              <label>تعداد کل اقساط<input inputMode="numeric" value={draft.totalInstallments} onChange={e=>setDraft({...draft,totalInstallments:e.target.value.replace(/[^\d]/g,"")})}/></label>
              <label>اقساط پرداخت‌شده<input inputMode="numeric" value={draft.paidInstallments} onChange={e=>setDraft({...draft,paidInstallments:e.target.value.replace(/[^\d]/g,"")})}/></label>
              <label>اولین سررسید (شمسی)<input value={draft.firstDueDate} onChange={e=>setDraft({...draft,firstDueDate:e.target.value})} placeholder="۱۴۰۵/۰۱/۰۱"/></label>
            </>}
            <label className="full">توضیحات <textarea rows={2} value={draft.note} onChange={e=>setDraft({...draft,note:e.target.value})} placeholder="اختیاری"/></label>
          </div>
          {error && <div className="darma-form-error"><AlertCircle size={16}/>{error}</div>}
          <footer><button className="darma-secondary" onClick={()=>setModal(false)}>انصراف</button>
            <button className="darma-primary" disabled={busy} onClick={()=>void save()}>{busy ? "در حال ذخیره..." : <><Check size={16}/> ذخیره اطلاعات</>}</button></footer>
        </section>
      </div>}
    </main>
  );
}
