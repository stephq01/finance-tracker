// Service worker: the piece that lets a notification arrive even when this
// tab isn't the active one, or the app is backgrounded. It does two jobs —
// show a notification when a push arrives, and focus/open the app when
// that notification is tapped.

self.addEventListener('push', (event) => {
  let data = { title: 'Current', body: 'You have an update.' }
  try {
    if (event.data) data = event.data.json()
  } catch {
    // if the payload isn't JSON, fall back to the default text above
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus()
      }
      if (self.clients.openWindow) return self.clients.openWindow('/businesses')
    })
  )
})
