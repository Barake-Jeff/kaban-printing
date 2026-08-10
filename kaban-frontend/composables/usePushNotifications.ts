export function usePushNotifications() {
  const config = useRuntimeConfig()

  const isSupported = computed(() =>
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )

  const isGranted = computed(() =>
    typeof window !== 'undefined' && Notification.permission === 'granted'
  )

  async function requestAndSubscribe(): Promise<{ success: boolean; reason?: string }> {
    if (!isSupported.value) return { success: false, reason: 'not_supported' }

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return { success: false, reason: 'denied' }

    const reg = await navigator.serviceWorker.ready

    // Fetch public VAPID key from backend (public endpoint — no auth needed)
    const res = await $fetch<{ data: { publicKey: string } }>(
      `${config.public.apiBase}/push/vapid-key`
    )
    const appServerKey = urlBase64ToUint8Array(res.data.publicKey)

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: appServerKey,
    })

    const json = sub.toJSON()
    const api  = useApi()
    await api('/push/subscribe', {
      method: 'POST',
      body: {
        endpoint: json.endpoint,
        p256dh:   json.keys?.p256dh,
        auth:     json.keys?.auth,
      },
    })

    return { success: true }
  }

  async function unsubscribe(): Promise<void> {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) await sub.unsubscribe()
    const api = useApi()
    await api('/push/unsubscribe', { method: 'DELETE' }).catch(() => {})
  }

  return { isSupported, isGranted, requestAndSubscribe, unsubscribe }
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}
