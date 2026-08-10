<template>
  <div class="bg-background text-on-background min-h-screen pb-24">

    <!-- Top Navigation (hidden on job detail page) -->
    <nav
      v-if="!hideTopBar"
      class="fixed top-0 w-full z-50 bg-primary h-12 flex justify-between items-center px-margin-mobile"
    >
      <div class="flex items-center gap-2">
        <span class="material-symbols-outlined text-on-primary">print</span>
        <span class="font-headline-md text-headline-md font-bold text-on-primary">PrintEase</span>
      </div>
      <button @click="notifs.togglePanel()" class="relative active:scale-95 transition-transform p-1" aria-label="Notifications">
        <span class="material-symbols-outlined text-on-primary">notifications</span>
        <span v-if="notifs.hasUnread" class="absolute top-0 right-0 block h-2 w-2 rounded-full bg-secondary ring-2 ring-primary"></span>
      </button>
    </nav>

    <!-- Notification backdrop -->
    <Transition name="notif-overlay">
      <div
        v-if="notifs.panelOpen"
        class="fixed inset-0 z-30 bg-black/40"
        @click="notifs.closePanel()"
      ></div>
    </Transition>

    <!-- Notification panel (slides down from below nav) -->
    <Transition name="notif-panel">
      <div
        v-if="notifs.panelOpen"
        class="fixed top-12 inset-x-0 z-40 bg-surface shadow-2xl overflow-y-auto"
        style="max-height: 72vh;"
      >
        <!-- Panel header -->
        <div class="flex items-center justify-between px-4 py-3 border-b border-outline-variant sticky top-0 bg-surface">
          <span class="font-headline-md text-headline-md text-primary font-bold">Notifications</span>
          <div class="flex items-center gap-4">
            <button
              v-if="notifs.hasUnread"
              @click.stop="notifs.markAllAsRead()"
              class="font-body-sm text-body-sm text-secondary active:opacity-60"
            >Mark all read</button>
            <button
              v-if="notifs.visibleItems.length > 0"
              @click.stop="notifs.clearAll()"
              class="font-body-sm text-body-sm text-on-surface-variant active:opacity-60"
            >Clear all</button>
          </div>
        </div>

        <!-- Empty state -->
        <div v-if="notifs.visibleItems.length === 0" class="flex flex-col items-center py-12 gap-2 px-4 text-center">
          <span class="material-symbols-outlined text-on-surface-variant" style="font-size: 40px;">notifications_off</span>
          <p class="font-body-sm text-body-sm text-on-surface-variant mt-1">No notifications yet</p>
          <p class="font-body-sm text-body-sm text-on-surface-variant opacity-70 text-xs">You'll see print job updates here</p>
        </div>

        <!-- Notification list -->
        <div v-else class="divide-y divide-outline-variant">
          <div
            v-for="notif in notifs.visibleItems"
            :key="notif.id"
            @click="handleNotifTap(notif)"
            class="flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors active:bg-surface-container-low"
            :class="notifs.readIds.has(notif.id) ? 'bg-surface' : 'bg-surface-container-lowest'"
          >
            <!-- Trigger icon -->
            <span
              class="material-symbols-outlined flex-shrink-0 mt-0.5"
              :class="notif.trigger === 'payment_failed' ? 'text-red-500' : 'text-secondary'"
              style="font-size: 20px;"
            >{{ notifs.meta(notif.trigger).icon }}</span>

            <!-- Text -->
            <div class="flex-grow min-w-0">
              <div class="flex items-start justify-between gap-2">
                <span class="font-label-bold text-label-bold text-on-surface leading-snug">
                  {{ notifs.meta(notif.trigger).title }}
                </span>
                <span class="font-body-sm text-body-sm text-on-surface-variant text-xs whitespace-nowrap flex-shrink-0 mt-px">
                  {{ timeAgo(notif.sentAt) }}
                </span>
              </div>
              <p class="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                Job #{{ notif.jobId.slice(0, 8) }}…
              </p>
            </div>

            <!-- Unread dot -->
            <div v-if="!notifs.readIds.has(notif.id)" class="flex-shrink-0 mt-2">
              <span class="block h-2 w-2 rounded-full bg-secondary"></span>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Page content -->
    <slot />

    <!-- Bottom Navigation -->
    <nav
      class="fixed bottom-0 inset-x-0 flex justify-around items-center h-16 px-xs border-t z-50"
      style="background-color: #1B2D5B; border-color: #1B2D5B;"
    >
      <template v-for="item in navItems" :key="item.label">
        <a
          :href="item.to"
          @click.prevent="navigate(item.to)"
          :class="[
            'flex flex-col items-center justify-center px-4 py-1 rounded-full transition-all active:scale-90 cursor-pointer',
            isActive(item) ? 'bg-brand-orange text-on-primary' : 'text-on-primary/80 hover:text-on-primary',
          ]"
        >
          <span
            class="material-symbols-outlined"
            :style="isActive(item) ? filledIcon : ''"
          >{{ item.icon }}</span>
          <span class="font-label-bold text-label-bold">{{ item.label }}</span>
        </a>
      </template>
    </nav>

  </div>
</template>

<script setup lang="ts">
import type { AppNotification } from '~/types'

const route  = useRoute()
const router = useRouter()
const notifs = useNotificationsStore()

const filledIcon = "font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;"

const hideTopBar = computed(() =>
  route.path.startsWith('/app/orders/') && !!route.params.id
)

const navItems = [
  { label: 'Home',     icon: 'home',         to: '/app',         exactMatch: true  },
  { label: 'Services', icon: 'print_connect', to: '/app/new-job', exactMatch: false },
  { label: 'Orders',   icon: 'receipt_long',  to: '/app/orders',  exactMatch: false },
  { label: 'Profile',  icon: 'person',        to: '/app/profile', exactMatch: false },
]

function isActive(item: typeof navItems[0]) {
  if (item.exactMatch) return route.path === item.to
  return route.path.startsWith(item.to)
}

function navigate(to: string) {
  router.push(to)
}

function handleNotifTap(notif: AppNotification) {
  notifs.markAsRead(notif.id)
  notifs.closePanel()
  router.push({ name: 'app-orders-id', params: { id: notif.jobId } })
}

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'yesterday'
  return `${days}d ago`
}

onMounted(() => {
  notifs.fetchNotifications()
})
</script>

<style scoped>
.notif-panel-enter-active,
.notif-panel-leave-active {
  transition: transform 0.22s ease, opacity 0.22s ease;
}
.notif-panel-enter-from,
.notif-panel-leave-to {
  transform: translateY(-6px);
  opacity: 0;
}

.notif-overlay-enter-active,
.notif-overlay-leave-active {
  transition: opacity 0.2s ease;
}
.notif-overlay-enter-from,
.notif-overlay-leave-to {
  opacity: 0;
}
</style>
