import { definitionsDb } from "../database/definitionsDb";

export interface SearchResult {
  id: string;
  type: "transaction" | "person" | "account" | "loan" | "credit";
  title: string;
  subtitle: string;
  targetPage: string;
}

export interface SystemNotification {
  id: string;
  type: "danger" | "warning" | "info";
  title: string;
  message: string;
  targetPage: string;
}

export async function globalSearch(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];
  const q = query.trim().toLowerCase();

  const [definitions, entries, purchases] = await Promise.all([
    definitionsDb.definitions.toArray(),
    definitionsDb.journalEntries.toArray(),
    definitionsDb.creditPurchases.toArray(),
  ]);

  const results: SearchResult[] = [];

  // جستجو در تعاریف (حساب‌ها، اشخاص، وام‌ها)
  for (const d of definitions) {
    if (d.name.toLowerCase().includes(q)) {
      if (d.kind === "person") {
        results.push({ id: d.id, type: "person", title: d.name, subtitle: "شخص / طرف حساب", targetPage: "اشخاص و مطالبات" });
      } else if (d.kind === "loan") {
        results.push({ id: d.id, type: "loan", title: d.name, subtitle: "وام و اقساط", targetPage: "وام‌ها و خرید اعتباری" });
      } else if (["bank", "cash", "wallet"].includes(d.kind)) {
        results.push({ id: d.id, type: "account", title: d.name, subtitle: "حساب بانکی یا نقدی", targetPage: "تعاریف" });
      } else if (d.kind === "category") {
        results.push({ id: d.id, type: "account", title: d.name, subtitle: "دسته‌بندی", targetPage: "تعاریف" });
      }
    }
  }

  // جستجو در تراکنش‌ها
  for (const e of entries) {
    if (e.status !== "void" && (e.description.toLowerCase().includes(q) || String(e.docNo).includes(q))) {
      results.push({ id: e.id, type: "transaction", title: e.description, subtitle: `سند شماره ${e.docNo?.toLocaleString("fa-IR")}`, targetPage: "تراکنش‌ها" });
    }
  }

  // جستجو در خریدهای اعتباری
  for (const p of purchases) {
    if (p.title.toLowerCase().includes(q) || p.platform.toLowerCase().includes(q)) {
      results.push({ id: p.id, type: "credit", title: p.title, subtitle: `خرید اعتباری - ${p.platform}`, targetPage: "وام‌ها و خرید اعتباری" });
    }
  }

  return results.slice(0, 10); // حداکثر ۱۰ نتیجه برای جلوگیری از شلوغی
}

export async function getSystemNotifications(): Promise<SystemNotification[]> {
  const [installments, budgets, definitions] = await Promise.all([
    definitionsDb.installments.toArray(),
    definitionsDb.budgets.toArray(),
    definitionsDb.definitions.toArray(),
  ]);

  const notifications: SystemNotification[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // بررسی اقساط
  const pendingInstallments = installments.filter(x => x.status === "pending");
  for (const inst of pendingInstallments) {
    // تبدیل تاریخ شمسی سررسید به میلادی برای مقایسه
    const [y, m, d] = inst.dueDate.split("/").map(Number);
    const dueDate = new Date(y + 621, m - 1, d); 
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      notifications.push({
        id: inst.id, type: "danger",
        title: "قسط عقب‌افتاده",
        message: `قسط شماره ${inst.installmentNo} با سررسید ${inst.dueDate} پرداخت نشده است.`,
        targetPage: "وام‌ها و خرید اعتباری"
      });
    } else if (diffDays <= 7) {
      notifications.push({
        id: inst.id, type: "warning",
        title: "نزدیک به سررسید",
        message: `قسط شماره ${inst.installmentNo} تا ${diffDays} روز دیگر سررسید می‌شود.`,
        targetPage: "وام‌ها و خرید اعتباری"
      });
    }
  }

  // بررسی بودجه‌ها (ماه جاری)
  const currentMonthStr = new Intl.DateTimeFormat('en-US-u-ca-persian', { year: 'numeric', month: '2-digit' }).format(new Date()).replace(/\//g, '-');
  const currentBudgets = budgets.filter(b => b.period === currentMonthStr);
  
  for (const b of currentBudgets) {
    const def = definitions.find(d => d.id === b.definitionId);
    if (!def) continue;
    // محاسبه سریع مصرف بودجه
    const spent = (await definitionsDb.journalEntries.where("categoryId").equals(def.id).toArray())
      .filter(e => e.status !== "void").reduce((s, e) => s + e.amount, 0);
    const percent = (spent / b.amount) * 100;
    
    if (percent > 100) {
      notifications.push({ id: b.id, type: "danger", title: "عبور از بودجه", message: `بودجه ${def.name} از سقف تعیین‌شده عبور کرده است.`, targetPage: "بودجه‌بندی" });
    } else if (percent >= 80) {
      notifications.push({ id: b.id, type: "warning", title: "هشدار بودجه", message: `بیش از ۸۰٪ بودجه ${def.name} مصرف شده است.`, targetPage: "بودجه‌بندی" });
    }
  }

  return notifications;
}
