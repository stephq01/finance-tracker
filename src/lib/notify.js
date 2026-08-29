// First-pass notifications: these use the browser's Notification API, which
// only fires while this tab/app is open (in the foreground or backgrounded,
// not fully closed). Good enough to catch your eye when you open the app —
// true "buzzes my phone even when closed" push is a separate, bigger build
// (needs a service worker + a server-side scheduled check).

export function notificationsSupported() {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function notificationPermission() {
  return notificationsSupported() ? Notification.permission : 'unsupported'
}

export async function requestNotificationPermission() {
  if (!notificationsSupported()) return 'unsupported'
  return Notification.requestPermission()
}

export function fireNotification(title, body) {
  if (!notificationsSupported() || Notification.permission !== 'granted') return
  try {
    new Notification(title, { body, icon: '/favicon.svg' })
  } catch {
    // some mobile browsers (notably iOS Safari outside an installed PWA)
    // don't support the Notification constructor directly — fail quietly
  }
}
