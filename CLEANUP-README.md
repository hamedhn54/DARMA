# DARMA Explorer Cleanup

این بسته فقط فایل‌های تکراری/قدیمی و دارایی‌های پیش‌فرضِ بدون ارجاع را از Explorer حذف می‌کند.

## اجرا
1. فایل ZIP را در ریشه پروژه `/workspaces/DARMA` آپلود و Extract کن.
2. در ترمینال اجرا کن:

```bash
cd /workspaces/DARMA
bash cleanup-explorer.sh
npm run build
```

## مواردی که حذف می‌شوند
- فایل‌های تاریخی `README_DARMA_*.txt` (فایل اصلی `README.md` باقی می‌ماند)
- ZIPهای نسخه‌های قبلی که داخل ریشه پروژه کپی شده‌اند
- پوشه موقت `.unzip`
- فایل CSS تکراری ریشه که با نسخه داخل `src/pages` یکسان است
- تصاویر پیش‌فرض Vite که در کد استفاده نمی‌شوند

## مواردی که دست‌نخورده می‌مانند
- تمام کدهای `src` به‌جز تصاویر starter بدون استفاده
- دیتابیس و داده‌های IndexedDB مرورگر
- `package.json` و `package-lock.json`
- تنظیمات TypeScript، Vite، ESLint و فایل‌های public

اسکریپت را فقط از ریشه پروژه DARMA اجرا کن. قبل از اجرا، اگر ZIPهای قدیمی را لازم داری، آن‌ها را خارج از پوشه پروژه نگه دار.
