import { definitionsDb } from "../database/definitionsDb";

// تبدیل فایل (Blob) به متن Base64 برای ذخیره در JSON
const blobToBase64 = (blob: Blob): Promise<string> => new Promise((resolve) => {
  const reader = new FileReader();
  reader.onloadend = () => resolve(reader.result as string);
  reader.readAsDataURL(blob);
});

// تبدیل متن Base64 به فایل (Blob) در زمان بازیابی
const base64ToBlob = (base64: string, mimeType: string): Blob => {
  const byteCharacters = atob(base64.split(',')[1]);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
};

export async function exportDatabaseToFile(): Promise<void> {
  const data: any = {
    version: "0.5.0",
    exportedAt: new Date().toISOString(),
  };

  // خواندن تمام جداول دیتابیس
  data.definitions = await definitionsDb.definitions.toArray();
  data.journalEntries = await definitionsDb.journalEntries.toArray();
  data.journalLines = await definitionsDb.journalLines.toArray();
  data.installments = await definitionsDb.installments.toArray();
  data.creditPurchases = await definitionsDb.creditPurchases.toArray();
  data.budgets = await definitionsDb.budgets.toArray();

  // تبدیل پیوست‌ها به متن
  const attachments = await definitionsDb.attachments.toArray();
  data.attachments = await Promise.all(attachments.map(async (file) => {
    const base64 = await blobToBase64(file.blob);
    return { ...file, blob: base64 };
  }));

  // ساخت و دانلود فایل JSON
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement("a");
  a.href = url;
  a.download = `DARMA-Backup-${new Date().toISOString().split("T")[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importDatabaseFromFile(file: File): Promise<void> {
  const text = await file.text();
  const data = JSON.parse(text);

  if (!data.definitions || !data.journalEntries) {
    throw new Error("فایل پشتیبان معتبر نیست.");
  }

  // بازگرداندن پیوست‌ها به حالت فایل
  if (data.attachments) {
    data.attachments = await Promise.all(data.attachments.map(async (file: any) => {
      const blob = await base64ToBlob(file.blob, file.mimeType);
      return { ...file, blob };
    }));
  }

  // خالی کردن دیتابیس و جایگزینی با اطلاعات جدید به صورت اتمیک
  await definitionsDb.transaction("rw", 
    definitionsDb.definitions, definitionsDb.journalEntries, definitionsDb.journalLines, 
    definitionsDb.installments, definitionsDb.creditPurchases, definitionsDb.budgets, definitionsDb.attachments, 
    async () => {
      await definitionsDb.definitions.clear();
      await definitionsDb.journalEntries.clear();
      await definitionsDb.journalLines.clear();
      await definitionsDb.installments.clear();
      await definitionsDb.creditPurchases.clear();
      await definitionsDb.budgets.clear();
      await definitionsDb.attachments.clear();

      await definitionsDb.definitions.bulkAdd(data.definitions);
      await definitionsDb.journalEntries.bulkAdd(data.journalEntries);
      await definitionsDb.journalLines.bulkAdd(data.journalLines);
      await definitionsDb.installments.bulkAdd(data.installments || []);
      await definitionsDb.creditPurchases.bulkAdd(data.creditPurchases || []);
      await definitionsDb.budgets.bulkAdd(data.budgets || []);
      await definitionsDb.attachments.bulkAdd(data.attachments || []);
  });
}
