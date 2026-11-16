const CACHE_NAME = 'darma-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/favicon.svg'
];

// نصب سرویس‌ورکر و کش کردن فایل‌های اولیه
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

// فعال‌سازی و پاک کردن کش‌های قدیمی
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// استراتژی شبکه-اول برای فایل‌های آپدیت‌شده و کش-اول برای فایل‌های ثابت
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});