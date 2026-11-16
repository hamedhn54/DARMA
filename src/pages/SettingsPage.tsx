import { useState } from "react";
import { Download, Upload, AlertTriangle } from "lucide-react";
import { exportDatabaseToFile, importDatabaseFromFile } from "../services/backupService";
import "./SettingsPage.css";

export default function SettingsPage() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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

  return (
    <main className="settings-page" dir="rtl">
      <header className="settings-heading">
        <h1>تنظیمات و مدیریت اطلاعات</h1>
        <p>از اطلاعات مالی خود نسخه پشتیبان تهیه کنید یا اطلاعات قبلی را بازیابی کنید.</p>
      </header>

      <div className="settings-grid">
        <div className="settings-card">
          <div className="settings-card-icon backup"><Download size={24}/></div>
          <h2>پشتیبان‌گیری از اطلاعات</h2>
          <p>تمام حساب‌ها، تراکنش‌ها، وام‌ها، اقساط و پیوست‌ها در یک فایل دانلود می‌شوند تا در دستگاه دیگری بازیابی کنید.</p>
          <button className="settings-btn primary" onClick={() => void handleBackup()} disabled={busy}>
            {busy ? "در حال آماده‌سازی..." : "دانلود فایل پشتیبان"}
          </button>
        </div>

        <div className="settings-card">
          <div className="settings-card-icon restore"><Upload size={24}/></div>
          <h2>بازیابی از فایل</h2>
          <p>فایل پشتیبان قبلی را انتخاب کنید. توجه داشته باشید که اطلاعات فعلی با اطلاعات این فایل جایگزین می‌شوند.</p>
          <label className="settings-btn secondary">
            انتخاب فایل پشتیبان
            <input type="file" accept=".json" onChange={handleRestore} disabled={busy} style={{ display: "none" }}/>
          </label>
        </div>
      </div>

      {message && <div className="settings-alert success">{message}</div>}
      {error && <div className="settings-alert error"><AlertTriangle size={16}/> {error}</div>}
    </main>
  );
}
