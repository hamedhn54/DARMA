import { useState, useEffect } from "react";
import { Download, Upload, AlertTriangle, Trash2, CheckCircle2, RefreshCcw, Key } from "lucide-react";
import { exportDatabaseToFile, importDatabaseFromFile, cleanupOrphanData, resetAllData } from "../services/backupService";
import "./SettingsPage.css";

export default function SettingsPage() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [apiKey, setApiKey] = useState("");

  useEffect(() => {
    const savedKey = localStorage.getItem("darma_deepseek_key") || "";
    setApiKey(savedKey);
  }, []);

  const saveApiKey = () => {
    localStorage.setItem("darma_deepseek_key", apiKey);
    setMessage("کلید API با موفقیت ذخیره شد.");
    setTimeout(() => setMessage(""), 3000);
  };

  const handleBackup = async () => {
    setBusy(true); setMessage(""); setError("");
    try {
      await exportDatabaseToFile();
      setMessage("فایل پشتیبان با موفقیت دانلود شد.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در پشتیبان‌گیری.");
    } finally { setBusy(false); }
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!window.confirm("با بازیابی، تمام اطلاعات فعلی پاک شده و اطلاعات فایل جایگزین می‌شود. مطمئن هستید؟")) {
      e.target.value = "";
      return;
    }
    setBusy(true); setMessage(""); setError("");
    try {
      await importDatabaseFromFile(file);
      setMessage("اطلاعات با موفقیت بازیابی شد. برنامه را رفرش کنید.");
      setTimeout(() => window.location.reload(), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "فایل نامعتبر است.");
    } finally { 
      setBusy(false); 
      e.target.value = ""; 
    }
  };

  const handleCleanup = async () => {
    if (!window.confirm("این عملیات داده‌های یتیم را پاک می‌کند. ادامه می‌دهید؟")) return;
    setBusy(true); setMessage(""); setError("");
    try {
      const result = await cleanupOrphanData();
      setMessage(`پاک‌سازی با موفقیت انجام شد: ${result}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطا در پاک‌سازی.");
    } finally { setBusy(false); }
  };

  const handleReset = async () => {
    const confirm1 = window.confirm("⚠️ هشدار جدی: تمام اطلاعات برای همیشه پاک خواهند شد. آیا مطمئن هستید؟");
    if (!confirm1) return;
    
    const confirm2 = window.prompt("برای تأیید نهایی، عبارت «حذف» را تایپ کنید:");
    if (confirm2 !== "حذف") return;

    setBusy(true); setMessage(""); setError("");
    try {
      await resetAllData();
      setMessage("تمام اطلاعات با موفقیت پاک شد. در حال بازنشانی...");
      setTimeout(() => window.location.reload(), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطا در پاک‌سازی.");
    } finally { setBusy(false); }
  };

  return (
    <main className="settings-page" dir="rtl">
      <header className="settings-heading">
        <h1>تنظیمات و مدیریت اطلاعات</h1>
        <p>مدیریت اطلاعات مالی، پشتیبان‌گیری و تنظیمات دستیار هوشمند</p>
      </header>

      <div className="settings-grid">
        <div className="settings-card ai-key-card">
          <div className="settings-card-icon ai-key"><Key size={24}/></div>
          <h2>کلید API دستیار هوشمند</h2>
          <p>برای استفاده از تحلیل‌های هوش مصنوعی دیپ‌سیک، کلید API خود را وارد کنید. این کلید فقط در مرورگر شما ذخیره می‌شود.</p>
          <div className="api-key-input-group">
            <input 
              type="password" 
              value={apiKey} 
              onChange={e => setApiKey(e.target.value)} 
              placeholder="sk-..." 
            />
            <button className="settings-btn primary" onClick={saveApiKey}>ذخیره کلید</button>
          </div>
        </div>

        <div className="settings-card">
          <div className="settings-card-icon backup"><Download size={24}/></div>
          <h2>پشتیبان‌گیری از اطلاعات</h2>
          <p>تمام اطلاعات در یک فایل دانلود می‌شود.</p>
          <button className="settings-btn primary" onClick={() => void handleBackup()} disabled={busy}>
            {busy ? "در حال آماده‌سازی..." : "دانلود فایل پشتیبان"}
          </button>
        </div>

        <div className="settings-card">
          <div className="settings-card-icon restore"><Upload size={24}/></div>
          <h2>بازیابی از فایل</h2>
          <p>فایل پشتیبان قبلی را انتخاب کنید.</p>
          <label className="settings-btn secondary">
            انتخاب فایل پشتیبان
            <input type="file" accept=".json" onChange={handleRestore} disabled={busy} style={{ display: "none" }}/>
          </label>
        </div>

        <div className="settings-card">
          <div className="settings-card-icon cleanup"><Trash2 size={24}/></div>
          <h2>پاک‌سازی داده‌های یتیم</h2>
          <p>پاک‌سازی اقساط و خطوط سند نامربوط.</p>
          <button className="settings-btn secondary" onClick={() => void handleCleanup()} disabled={busy}>
            پاک‌سازی دیتابیس
          </button>
        </div>

        <div className="settings-card danger-zone">
          <div className="settings-card-icon reset"><RefreshCcw size={24}/></div>
          <h2>شروع مجدد</h2>
          <p>پاک کردن کل اطلاعات و بازگشت به حالت اولیه.</p>
          <button className="settings-btn danger" onClick={() => void handleReset()} disabled={busy}>
            پاک کردن تمام اطلاعات
          </button>
        </div>
      </div>

      {message && <div className="settings-alert success"><CheckCircle2 size={16}/> {message}</div>}
      {error && <div className="settings-alert error"><AlertTriangle size={16}/> {error}</div>}
    </main>
  );
}
