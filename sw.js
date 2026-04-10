// sw.js
self.addEventListener('install', (e) => {
    console.log('[Service Worker] Install');
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    console.log('[Service Worker] Activate');
    return self.clients.claim();
});

self.addEventListener('fetch', (e) => {
    // Поки що просто пропускаємо всі запити (щоб не було проблем з кешем під час розробки)
    e.respondWith(fetch(e.request));
});