/* global self */
// Basic service worker to handle push notifications and focus behavior

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  self.clients.claim();
});

async function anyClientVisible(){
  const clis = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const c of clis){
    if ('visibilityState' in c && c.visibilityState === 'visible') return true;
  }
  return false;
}

self.addEventListener('push', async (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch {}
  const title = data.title || 'SADD';
  const body = data.body || '';
  const tag = data.tag || undefined;
  const payload = { data: data.data || {} };

  const visible = await anyClientVisible();
  if (visible){
    // Post a message to open clients to play chime + toast; do not show notification
    const clis = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    clis.forEach(c=> c.postMessage({ type:'inapp_notify', title, body, tag, ...payload }));
    return;
  }
  event.waitUntil(self.registration.showNotification(title, { body, tag, data: payload.data, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png' }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (allClients.length > 0){
      const c = allClients[0];
      c.focus && c.focus();
      return;
    }
    self.clients.openWindow && self.clients.openWindow('/');
  })());
});

