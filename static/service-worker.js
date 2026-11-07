const CACHE_NAME = 'musicwave-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/static/css/variables.css',
  '/static/css/base.css',
  '/static/css/layout.css',
  '/static/css/components.css',
  '/static/css/player.css',
  '/static/js/api.js',
  '/static/js/state.js',
  '/static/js/ui.js',
  '/static/js/app.js',
  '/static/manifest.json',
  '/static/offline.html'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // For API and socket calls, let them pass directly to network
  if (event.request.url.includes('/api/') || event.request.url.includes('/socket.io/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).catch(() => {
        // Return offline page if navigation request fails
        if (event.request.mode === 'navigate') {
          return caches.match('/static/offline.html');
        }
      });
    })
  );
});
