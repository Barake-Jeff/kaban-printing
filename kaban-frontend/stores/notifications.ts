import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { AppNotification } from '~/types'

const READ_KEY    = 'notif_read'
const CLEARED_KEY = 'notif_cleared_before'

const TRIGGER_META: Record<string, { icon: string; title: string }> = {
  job_received:      { icon: 'inbox',          title: 'Job received'         },
  payment_confirmed: { icon: 'check_circle',   title: 'Payment confirmed'    },
  printing_started:  { icon: 'print',          title: 'Now printing'         },
  job_ready:         { icon: 'done_all',       title: 'Ready for collection' },
  job_delivered:     { icon: 'local_shipping', title: 'Job delivered'        },
  payment_failed:    { icon: 'error',          title: 'Payment failed'       },
}

function loadReadIds(): string[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(READ_KEY) ?? '[]') } catch { return [] }
}

function loadClearedBefore(): string {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem(CLEARED_KEY) ?? ''
}

export const useNotificationsStore = defineStore('notifications', () => {
  const items         = ref<AppNotification[]>([])
  const loading       = ref(false)
  const panelOpen     = ref(false)
  const readIdList    = ref<string[]>(loadReadIds())
  const clearedBefore = ref<string>(loadClearedBefore())

  // Computed Set for O(1) lookups — reactive because it depends on readIdList
  const readIds = computed(() => new Set(readIdList.value))

  const visibleItems = computed(() =>
    clearedBefore.value
      ? items.value.filter(n => n.sentAt > clearedBefore.value)
      : items.value
  )

  const hasUnread = computed(() =>
    visibleItems.value.some(n => !readIds.value.has(n.id))
  )

  async function fetchNotifications() {
    loading.value = true
    try {
      const api = useApi()
      const res = await api<any>('/notifications')
      items.value = res.data?.notifications ?? []
    } catch { /* silent — user may not be authenticated yet */ }
    finally { loading.value = false }
  }

  function togglePanel() {
    panelOpen.value = !panelOpen.value
    if (panelOpen.value) fetchNotifications()
  }

  function closePanel() { panelOpen.value = false }

  function markAsRead(id: string) {
    if (!readIdList.value.includes(id)) {
      readIdList.value.push(id)
      persist()
    }
  }

  function markAllAsRead() {
    const newIds = visibleItems.value
      .map(n => n.id)
      .filter(id => !readIdList.value.includes(id))
    readIdList.value.push(...newIds)
    persist()
  }

  function clearAll() {
    const now = new Date().toISOString()
    clearedBefore.value = now
    localStorage.setItem(CLEARED_KEY, now)
    // Prune read IDs for cleared items
    readIdList.value = readIdList.value.filter(
      id => !items.value.some(n => n.id === id),
    )
    persist()
  }

  function persist() {
    localStorage.setItem(READ_KEY, JSON.stringify(readIdList.value))
  }

  function meta(trigger: string) {
    return TRIGGER_META[trigger] ?? { icon: 'notifications', title: trigger }
  }

  return {
    items, loading, panelOpen, visibleItems, hasUnread, readIds,
    fetchNotifications, togglePanel, closePanel,
    markAsRead, markAllAsRead, clearAll, meta,
  }
})
