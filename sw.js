// Service Worker: guarda toda la aplicación para que funcione sin conexión.
// Al publicar cambios, sube el número de versión: la app se actualizará sola.
const VERSION = 'alba-v2';
const ASSETS = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/backup.js', 'js/db.js', 'js/ui.js', 'js/util.js', 'js/domain.js', 'js/charts.js',
  'js/data/exercises.js', 'js/data/foods.js',
  'js/views/shared.js', 'js/views/today.js', 'js/views/steps.js', 'js/views/train.js', 'js/views/food.js', 'js/views/care.js', 'js/views/photos.js', 'js/views/life.js', 'js/views/cycle.js', 'js/views/overview.js', 'js/views/settings.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png',
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== VERSION).map(x => caches.delete(x)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const { request: r } = e, url = new URL(r.url);
  if (r.method !== 'GET' || url.origin !== location.origin) return; // Open Food Facts va directo a la red
  if (r.mode === 'navigate') {
    e.respondWith(caches.match('index.html').then(c => c || fetch(r)));
    return;
  }
  e.respondWith(caches.match(r, { ignoreSearch: true }).then(c => c || fetch(r).then(resp => {
    if (resp.ok) { const copy = resp.clone(); caches.open(VERSION).then(ca => ca.put(r, copy)); }
    return resp;
  })));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window' }).then(l => l[0] ? l[0].focus() : clients.openWindow('./')));
});
