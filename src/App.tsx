import { useState } from "react";
import { Activity, Bell, ChevronDown, ChevronLeft, CircleHelp, FileChartColumn, HandCoins, LayoutDashboard, Menu, MoreHorizontal, Search, Settings2, ShieldCheck, Target, Wallet, X, ArrowLeftRight } from "lucide-react";
import "./App.css";
import DefinitionsPage from "./pages/DefinitionsPage";
import PeopleFinancePage from "./pages/PeopleFinancePage";
import DashboardPage from "./pages/DashboardPage";
import TransactionsPage from "./pages/TransactionsPage";
import ReportsPage from "./pages/ReportsPage";
import LoansPage from "./pages/LoansPage";
import BudgetPage from "./pages/BudgetPage";

type Theme = "light" | "dark" | "hybrid";
function App() {
 const [theme,setTheme]=useState<Theme>("hybrid");const[active,setActive]=useState("داشبورد");const[mobileOpen,setMobileOpen]=useState(false);const[pendingInstallmentId,setPendingInstallmentId]=useState<string|null>(null);
 const nav=[{label:"داشبورد",icon:LayoutDashboard},{label:"تراکنش‌ها",icon:ArrowLeftRight},{label:"تعاریف",icon:Wallet},{label:"اشخاص و مطالبات",icon:HandCoins},{label:"بودجه‌بندی",icon:Target},{label:"وام‌ها و خرید اعتباری",icon:HandCoins},{label:"گزارش‌های مالی",icon:FileChartColumn}];
 const navigate=(page:string)=>setActive(page);
 return <div className={`app theme-${theme}`} dir="rtl">
  {mobileOpen&&<button className="scrim" aria-label="بستن منو" onClick={()=>setMobileOpen(false)}/>}
  <aside className={`sidebar ${mobileOpen?"sidebar-open":""}`}><div className="brand"><div className="brand-mark">D</div><div><strong>DARMA</strong><span>مدیریت هوشمند مالی</span></div><button className="icon-btn mobile-close" onClick={()=>setMobileOpen(false)} aria-label="بستن"><X size={18}/></button></div>
   <button className="workspace"><span className="workspace-icon"><Wallet size={18}/></span><span><b>فضای مالی شخصی</b><small>حساب اصلی</small></span><ChevronDown size={16}/></button><div className="nav-caption">منوی اصلی</div>
   <nav>{nav.map(({label,icon:Icon})=><button key={label} className={`nav-item ${active===label?"selected":""}`} onClick={()=>{setActive(label);setMobileOpen(false)}}><Icon size={19}/><span>{label}</span>{label==="وام‌ها و خرید اعتباری"&&<i>۳</i>}</button>)}</nav>
   <div className="sidebar-spacer"/><div className="upgrade-card"><div className="upgrade-icon"><ShieldCheck size={18}/></div><b>اطلاعات مالی شما، امن و در کنترل شما</b><p>دارما با اولویت حفظ حریم خصوصی طراحی می‌شود.</p></div><button className="nav-item"><Settings2 size={19}/><span>تنظیمات</span></button><button className="nav-item"><CircleHelp size={19}/><span>راهنما و پشتیبانی</span></button><div className="profile"><div className="avatar">ح</div><div><b>کاربر دارما</b><small>حساب شخصی</small></div><MoreHorizontal size={19}/></div>
  </aside>
  <main className="main"><header className="topbar"><div className="topbar-start"><button className="icon-btn mobile-menu" onClick={()=>setMobileOpen(true)} aria-label="منو"><Menu/></button><div className="breadcrumb">دارما <ChevronLeft size={14}/> <b>{active}</b></div></div><div className="top-actions"><div className="search-box"><Search size={17}/><input placeholder="جستجو در دارما..." aria-label="جستجو"/></div><button className="icon-btn notification" aria-label="اعلان‌ها"><Bell size={19}/><i/></button><div className="theme-picker"><span>پوسته</span><select value={theme} onChange={e=>setTheme(e.target.value as Theme)} aria-label="انتخاب پوسته"><option value="hybrid">ترکیبی</option><option value="light">روشن</option><option value="dark">تیره</option></select></div></div></header>
   <div className="content">{active==="تعاریف"?<DefinitionsPage/>:active==="اشخاص و مطالبات"?<PeopleFinancePage/>:active==="تراکنش‌ها"?<TransactionsPage initialInstallmentId={pendingInstallmentId} onInitialInstallmentHandled={()=>setPendingInstallmentId(null)}/>:active==="گزارش‌های مالی"?<ReportsPage/>:active==="وام‌ها و خرید اعتباری"?<LoansPage/>:active==="بودجه‌بندی"?<BudgetPage/>:active==="داشبورد"?<DashboardPage onNavigate={navigate}/>:<main className="db-page" dir="rtl"><div className="db-heading"><div><span>ماژول در حال توسعه</span><h1>{active}</h1><p>این بخش پس از تکمیل زیرساخت دفترکل مشترک توسعه داده می‌شود.</p></div></div><section className="db-panel"><div className="db-empty"><Activity size={22}/> این ماژول هنوز به دفترکل متصل نشده است.</div></section></main>}</div>
  </main>
 </div>
}
export default App;
