// Pluma · service worker mínimo: navegación con red primero y página sin conexión.
const CACHE = 'pluma-v2';
const OFFLINE = '/offline.html';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.add(OFFLINE)));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  if (e.request.mode !== 'navigate') return;
  e.respondWith(fetch(e.request).catch(() => caches.match(OFFLINE)));
});

// Push: { title, body, url, tag } (ver @pluma/emails renderPush)
self.addEventListener('push', (e) => {
  let data = {};
  try {
    data = e.data ? e.data.json() : {};
  } catch {
    data = { title: 'Pluma', body: e.data ? e.data.text() : '' };
  }
  e.waitUntil(
    self.registration.showNotification(data.title || 'Pluma', {
      body: data.body || '',
      tag: data.tag,
      icon: '/icon-maskable',
      badge: '/icon',
      data: { url: data.url || '/notificaciones' },
    }),
  );
});

// Al tocarla: enfoca una pestaña abierta de Pluma o abre una nueva en el destino (solo mismo origen).
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const raw = (e.notification.data && e.notification.data.url) || '/notificaciones';
  const target = new URL(raw, self.location.origin);
  const url = target.origin === self.location.origin ? target.href : self.location.origin + '/notificaciones';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const same = wins.find((w) => new URL(w.url).origin === self.location.origin);
      if (same) return same.navigate(url).then((w) => (w || same).focus());
      return self.clients.openWindow(url);
    }),
  );
});
