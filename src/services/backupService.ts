import { definitionsDb } from "../database/definitionsDb";

const blobToBase64 = (blob: Blob): Promise<string> => new Promise((resolve) => {
  const reader = new FileReader();
  reader.onloadend = () => resolve(reader.result as string);
  reader.readAsDataURL(blob);
});

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

  data.definitions = await definitionsDb.definitions.toArray();
  data.journalEntries = await definitionsDb.journalEntries.toArray();
  data.journalLines = await definitionsDb.journalLines.toArray();
  data.installments = await definitionsDb.installments.toArray();
  data.creditPurchases = await definitionsDb.creditPurchases.toArray();
  data.budgets = await definitionsDb.budgets.toArray();

  const attachments = await definitionsDb.attachments.toArray();
  data.attachments = await Promise.all(attachments.map(async (file) => {
    const base64 = await blobToBase64(file.blob);
    return { ...file, blob: base64 };
  }));

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

  if (data.attachments) {
    data.attachments = await Promise.all(data.attachments.map(async (file: any) => {
      const blob = await base64ToBlob(file.blob, file.mimeType);
      return { ...file, blob };
    }));
  }

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

export async function cleanupOrphanData(): Promise<string> {
  let deletedInstallments = 0;
  let deletedLines = 0;
  let deletedAttachments = 0;

  await definitionsDb.transaction("rw", 
    definitionsDb.installments, definitionsDb.journalEntries, definitionsDb.journalLines, 
    definitionsDb.definitions, definitionsDb.creditPurchases, definitionsDb.attachments, 
    async () => {
      // ۱. پاک‌سازی اقساط یتیم
      const installments = await definitionsDb.installments.toArray();
      const validLoanIds = new Set((await definitionsDb.definitions.where("kind").equals("loan").toArray()).map(l => l.id));
      const validPurchaseIds = new Set((await definitionsDb.creditPurchases.toArray()).map(p => p.id));
      
      const orphanInstallments = installments.filter(inst => 
        (inst.ownerType === "loan" && !validLoanIds.has(inst.ownerId)) ||
        (inst.ownerType === "credit" && !validPurchaseIds.has(inst.ownerId))
      );
      for (const inst of orphanInstallments) {
        await definitionsDb.installments.delete(inst.id);
        deletedInstallments++;
      }

      // ۲. پاک‌سازی خطوط سند یتیم
      const lines = await definitionsDb.journalLines.toArray();
      const validEntryIds = new Set((await definitionsDb.journalEntries.toArray()).map(e => e.id));
      const orphanLines = lines.filter(l => !validEntryIds.has(l.entryId));
      for (const line of orphanLines) {
        await definitionsDb.journalLines.delete(line.id);
        deletedLines++;
      }

      // ۳. پاک‌سازی پیوست‌های یتیم
      const attachments = await definitionsDb.attachments.toArray();
      const orphanAttachments = attachments.filter(a => !validEntryIds.has(a.transactionId));
      for (const att of orphanAttachments) {
        await definitionsDb.attachments.delete(att.id);
        deletedAttachments++;
      }
  });
  
  return `${deletedInstallments} قسط یتیم، ${deletedLines} خط سند و ${deletedAttachments} پیوست پاک‌سازی شد.`;
}