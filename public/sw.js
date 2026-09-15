// Minimal service worker: exists so timer notifications work on Android (which requires
// ServiceWorkerRegistration.showNotification) and so a tap on one brings the app forward.
// Deliberately no fetch handler — nothing is cached, so every deploy is live immediately.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const win = list[0]
      return win ? win.focus() : self.clients.openWindow('/routine/')
    }),
  )
})
