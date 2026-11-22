import { useState, useEffect, useRef } from "react";
import { Activity, Bell, ChevronDown, ChevronLeft, CircleHelp, FileChartColumn, HandCoins, LayoutDashboard, Menu, MoreHorizontal, Search, Settings2, ShieldCheck, Target, Wallet, X, ArrowLeftRight, AlertTriangle, Info, XCircle, Bot } from "lucide-react";
import "./App.css";
import DefinitionsPage from "./pages/DefinitionsPage";
import PeopleFinancePage from "./pages/PeopleFinancePage";
import DashboardPage from "./pages/DashboardPage";
import TransactionsPage from "./pages/TransactionsPage";
import ReportsPage from "./pages/ReportsPage";
import LoansPage from "./pages/LoansPage";
import BudgetPage from "./pages/BudgetPage";
import SettingsPage from "./pages/SettingsPage";
import GoalsPage from "./pages/GoalsPage";
import AIChatPage from "./pages/AIChatPage";
import { globalSearch, getSystemNotifications, type SearchResult, type SystemNotification } from "./services/searchService";

type Theme = "classic" | "light" | "hybrid";

function App() {
  const [theme, setTheme] = useState<Theme>("hybrid");
  const [active, setActive] = useState("داشبورد");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pendingInstallmentId, setPendingInstallmentId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);

  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const bgColors = { classic: "#0f172a", light: "#f8fafc", hybrid: "#f1f5f9" };
    document.body.style.background = bgColors[theme];
    document.body.style.transition = "background 0.3s ease";
  }, [theme]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      const results = await globalSearch(searchQuery);
      setSearchResults(results);
      setSearchOpen(true);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const toggleNotifications = async () => {
    if (!notifOpen) {
      const n = await getSystemNotifications();
      setNotifications(n);
    }
    setNotifOpen(!notifOpen);
    setSearchOpen(false);
  };

  const navigate = (page: string) => {
    setActive(page);
    setMobileOpen(false);
    setSearchOpen(false);
    setNotifOpen(false);
  };

  const nav = [
    { label: "داشبورد", icon: LayoutDashboard },
    { label: "دستیار هوشمند", icon: Bot },
    { label: "تراکنش‌ها", icon: ArrowLeftRight },
    { label: "تعاریف", icon: Wallet },
    { label: "اشخاص و مطالبات", icon: HandCoins },
    { label: "بودجه‌بندی", icon: Target },
    { label: "اهداف مالی", icon: Target },
    { label: "وام‌ها و خرید اعتباری", icon: HandCoins },
    { label: "گزارش‌های مالی", icon: FileChartColumn },
  ];

  return (
    <div className={`app theme-${theme}`} dir="rtl">
      {mobileOpen && <button className="scrim" aria-label="بستن منو" onClick={() => setMobileOpen(false)} />}
      
      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">D</div>
          <div><strong>DARMA</strong><span>مدیریت هوشمند مالی</span></div>
          <button className="icon-btn mobile-close" onClick={() => setMobileOpen(false)} aria-label="بستن"><X size={18} /></button>
        </div>
        <button className="workspace">
          <span className="workspace-icon"><Wallet size={18} /></span>
          <span><b>فضای مالی شخصی</b><small>حساب اصلی</small></span>
          <ChevronDown size={16} />
        </button>
        <div className="nav-caption">منوی اصلی</div>
        <nav>
          {nav.map(({ label, icon: Icon }) => (
            <button key={label} className={`nav-item ${active === label ? "selected" : ""}`} onClick={() => navigate(label)}>
              <Icon size={19} /><span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <div className="upgrade-card">
          <div className="upgrade-icon"><ShieldCheck size={18} /></div>
          <b>اطلاعات مالی شما، امن و در کنترل شما</b>
          <p>دارما با اولویت حفظ حریم خصوصی طراحی می‌شود.</p>
        </div>
        <button className={`nav-item ${active === "تنظیمات" ? "selected" : ""}`} onClick={() => navigate("تنظیمات")}>
          <Settings2 size={19} /><span>تنظیمات</span>
        </button>
        <button className="nav-item"><CircleHelp size={19} /><span>راهنما و پشتیبانی</span></button>
        <div className="profile">
          <div className="avatar">ح</div>
          <div><b>کاربر دارما</b><small>حساب شخصی</small></div>
          <MoreHorizontal size={19} />
        </div>
      </aside>
      
      <main className="main">
        <header className="topbar">
          <div className="topbar-start">
            <button className="icon-btn mobile-menu" onClick={() => setMobileOpen(true)} aria-label="منو"><Menu /></button>
            <div className="breadcrumb">دارما <ChevronLeft size={14} /> <b>{active}</b></div>
          </div>
          <div className="top-actions">
            <div className="search-box" ref={searchRef}>
              <Search size={17} />
              <input 
                placeholder="جستجو در دارما..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => { if (searchQuery.trim()) setSearchOpen(true); }}
              />
              {searchOpen && (
                <div className="search-results-dropdown">
                  {searchResults.length > 0 ? (
                    searchResults.map(r => (
                      <button key={r.id} className="search-result-item" onClick={() => navigate(r.targetPage)}>
                        <div className="sr-icon">{r.type === 'transaction' ? <ArrowLeftRight size={16}/> : r.type === 'person' ? <HandCoins size={16}/> : r.type === 'loan' ? <Wallet size={16}/> : <Target size={16}/>}</div>
                        <div className="sr-text"><b>{r.title}</b><small>{r.subtitle}</small></div>
                      </button>
                    ))
                  ) : (
                    <div className="search-no-result">نتیجه‌ای یافت نشد.</div>
                  )}
                </div>
              )}
            </div>

            <div className="notification-wrap" ref={notifRef}>
              <button className="icon-btn notification" onClick={toggleNotifications} aria-label="اعلان‌ها">
                <Bell size={19} />
                {notifications.length > 0 && <i className="badge">{notifications.length}</i>}
              </button>
              
              {notifOpen && (
                <div className="notif-dropdown">
                  <div className="notif-header"><b>اعلان‌ها</b><span>{notifications.length} مورد</span></div>
                  <div className="notif-list">
                    {notifications.length > 0 ? (
                      notifications.map(n => (
                        <button key={n.id} className={`notif-item ${n.type}`} onClick={() => navigate(n.targetPage)}>
                          <div className="notif-icon">
                            {n.type === "danger" ? <XCircle size={18}/> : n.type === "warning" ? <AlertTriangle size={18}/> : <Info size={18}/>}
                          </div>
                          <div className="notif-content">
                            <b>{n.title}</b>
                            <small>{n.message}</small>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="notif-empty">هیچ اعلان جدیدی ندارید.</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="theme-picker">
              <span>پوسته</span>
              <select value={theme} onChange={(e) => setTheme(e.target.value as Theme)} aria-label="انتخاب پوسته">
                <option value="hybrid">ترکیبی (تیره/طلایی)</option>
                <option value="classic">کلاسیک لوکس (سرمه‌ای)</option>
                <option value="light">روشن مدرن (سبز)</option>
              </select>
            </div>
          </div>
        </header>
        
        <div className="content">
          {active === "تعاریف" ? <DefinitionsPage /> :
           active === "اشخاص و مطالبات" ? <PeopleFinancePage /> :
           active === "تراکنش‌ها" ? <TransactionsPage initialInstallmentId={pendingInstallmentId} onInitialInstallmentHandled={() => setPendingInstallmentId(null)} /> :
           active === "گزارش‌های مالی" ? <ReportsPage /> :
           active === "وام‌ها و خرید اعتباری" ? <LoansPage /> :
           active === "بودجه‌بندی" ? <BudgetPage /> :
           active === "اهداف مالی" ? <GoalsPage /> :
           active === "دستیار هوشمند" ? <AIChatPage /> :
           active === "داشبورد" ? <DashboardPage onNavigate={navigate} /> :
           active === "تنظیمات" ? <SettingsPage /> :
           <main className="db-page" dir="rtl">
             <div className="db-heading"><div><span>ماژول در حال توسعه</span><h1>{active}</h1><p>این بخش پس از تکمیل زیرساخت دفترکل مشترک توسعه داده می‌شود.</p></div></div>
             <section className="db-panel"><div className="db-empty"><Activity size={22} /> این ماژول هنوز به دفترکل متصل نشده است.</div></section>
           </main>}
        </div>
      </main>
    </div>
  );
}

export default App;
