// sw.js - service worker minimo, solo per abilitare l'installazione PWA su Android/Chrome
// Non fa caching: ogni richiesta va sempre in rete come già avviene oggi.

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(fetch(e.request));
});
