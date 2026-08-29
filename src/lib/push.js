import { supabase } from './supabaseClient'

// Converts the VAPID public key from base64url text into the raw byte
// format the browser's push API expects. Boilerplate every web-push setup
// needs — no need to touch this.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

export function pushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window
}

export async function registerServiceWorker() {
  if (!pushSupported()) return null
  return navigator.serviceWorker.register('/sw.js')
}

export async function subscribeToPush(userId) {
  const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
  if (!vapidKey) {
    console.error('Missing VITE_VAPID_PUBLIC_KEY — push subscription cannot proceed.')
    return { error: 'Missing VAPID key configuration.' }
  }
  const registration = await registerServiceWorker()
  if (!registration) return { error: 'Push not supported on this browser.' }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return { error: 'Notification permission not granted.' }

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey),
  })

  const { error } = await supabase.from('push_subscriptions').insert({
    user_id: userId,
    subscription: subscription.toJSON(),
  })
  if (error) return { error: error.message }
  return { success: true }
}

export async function pushSubscriptionState() {
  if (!pushSupported()) return 'unsupported'
  const registration = await navigator.serviceWorker.getRegistration()
  const existing = registration ? await registration.pushManager.getSubscription() : null
  return existing ? 'subscribed' : Notification.permission
}
