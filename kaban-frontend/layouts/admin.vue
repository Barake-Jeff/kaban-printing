<template>
  <div class="min-h-screen bg-[#F4F6FA] font-work-sans">

    <!-- ── Mobile drawer backdrop ──────────────────────────────────────────── -->
    <Transition name="overlay">
      <div
        v-if="drawerOpen"
        class="fixed inset-0 z-30 bg-black/40 md:hidden"
        @click="drawerOpen = false"
      />
    </Transition>

    <!-- ── Sidebar ─────────────────────────────────────────────────────────── -->
    <aside
      :class="[
        'fixed top-0 left-0 h-full z-40 flex flex-col w-[260px]',
        'transition-transform duration-300',
        drawerOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
      ]"
      style="background-color: #1B2D5B;"
    >
      <!-- Logo -->
      <div class="flex items-center gap-2 px-6 py-5 border-b border-white/10">
        <span class="material-symbols-outlined text-on-primary" style="font-size:22px;">print</span>
        <span class="font-bold text-lg tracking-tight text-on-primary">PrintEase</span>
        <span class="ml-auto text-xs text-on-primary/50 uppercase tracking-widest">Admin</span>
      </div>

      <!-- Nav -->
      <nav class="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <NuxtLink
          v-for="item in navItems"
          :key="item.route"
          :to="{ name: item.route }"
          custom
          v-slot="{ navigate, isActive, isExactActive }"
        >
          <button
            @click="() => { navigate(); drawerOpen = false }"
            :class="[
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium',
              (item.exact ? isExactActive : isActive)
                ? 'bg-white/15 text-on-primary font-semibold'
                : 'text-on-primary/70 hover:bg-white/10 hover:text-on-primary',
            ]"
          >
            <span
              class="material-symbols-outlined"
              style="font-size:20px;"
              :style="(item.exact ? isExactActive : isActive) ? filledIcon : ''"
            >{{ item.icon }}</span>
            {{ item.name }}
          </button>
        </NuxtLink>
      </nav>

      <!-- New Print Job -->
      <div class="px-3 pb-3">
        <button
          class="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.98]"
          style="background-color: #F97316; color: #fff;"
        >
          <span class="material-symbols-outlined" style="font-size:18px;">add</span>
          New Print Job
        </button>
      </div>

      <!-- User profile -->
      <div class="border-t border-white/10 px-4 py-4 flex items-center gap-3">
        <div class="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold text-on-primary flex-shrink-0">
          {{ userInitials }}
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-semibold text-on-primary truncate">{{ auth.user?.name ?? 'Admin' }}</p>
          <p class="text-xs text-on-primary/60 truncate capitalize">{{ auth.user?.role ?? 'admin' }}</p>
        </div>
        <button @click="handleLogout" class="text-on-primary/60 hover:text-on-primary transition-colors" title="Logout">
          <span class="material-symbols-outlined" style="font-size:18px;">logout</span>
        </button>
      </div>
    </aside>

    <!-- ── Main content ────────────────────────────────────────────────────── -->
    <div class="md:ml-[260px] flex flex-col min-h-screen">

      <!-- Top header bar -->
      <header class="sticky top-0 z-20 bg-white border-b border-gray-200 flex items-center gap-4 px-6 h-14">
        <!-- Mobile hamburger -->
        <button
          class="md:hidden p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          @click="drawerOpen = !drawerOpen"
          aria-label="Toggle menu"
        >
          <span class="material-symbols-outlined" style="font-size:22px;">menu</span>
        </button>

        <!-- Breadcrumb -->
        <nav class="flex items-center gap-1.5 text-sm min-w-0 flex-1">
          <span class="text-gray-400 font-medium hidden sm:block">PrintEase</span>
          <span class="text-gray-300 hidden sm:block">/</span>
          <template v-for="(crumb, i) in breadcrumbs" :key="crumb.label">
            <NuxtLink
              v-if="crumb.route && i < breadcrumbs.length - 1"
              :to="{ name: crumb.route }"
              class="text-gray-500 hover:text-primary transition-colors truncate"
            >{{ crumb.label }}</NuxtLink>
            <span v-else class="text-gray-900 font-semibold truncate">{{ crumb.label }}</span>
            <span v-if="i < breadcrumbs.length - 1" class="text-gray-300 mx-0.5">/</span>
          </template>
        </nav>

        <!-- Last updated (queue page only) -->
        <div v-if="isQueuePage && admin.lastUpdated" class="hidden sm:flex items-center gap-1 text-xs text-gray-400 flex-shrink-0">
          <span class="material-symbols-outlined" style="font-size:14px;">schedule</span>
          <span>{{ lastUpdatedAgo }}</span>
          <button
            @click="admin.fetchQueue()"
            class="ml-1 p-0.5 hover:text-primary transition-colors"
            title="Refresh"
          >
            <span class="material-symbols-outlined" style="font-size:14px;">refresh</span>
          </button>
        </div>

        <!-- Keyboard shortcuts button -->
        <button
          @click="shortcutsOpen = true"
          class="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors border border-gray-200 rounded px-2 py-1 flex-shrink-0"
          title="Keyboard shortcuts (?)"
        >
          <span class="font-mono font-bold">?</span>
        </button>
      </header>

      <!-- Page content -->
      <main class="flex-1 p-6">
        <slot />
      </main>
    </div>

    <!-- ── Keyboard Shortcuts Modal ─────────────────────────────────────────── -->
    <Transition name="overlay">
      <div
        v-if="shortcutsOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        @click.self="shortcutsOpen = false"
      >
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
          <div class="flex items-center justify-between mb-5">
            <h2 class="text-lg font-bold text-gray-900">Keyboard Shortcuts</h2>
            <button @click="shortcutsOpen = false" class="text-gray-400 hover:text-gray-600 transition-colors">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>

          <div class="space-y-3">
            <div v-for="s in shortcutsList" :key="s.key" class="flex items-center justify-between">
              <span class="text-sm text-gray-600">{{ s.label }}</span>
              <kbd class="px-2 py-1 text-xs font-mono bg-gray-100 text-gray-700 rounded border border-gray-200">{{ s.key }}</kbd>
            </div>
          </div>

          <p class="mt-5 text-xs text-gray-400">
            J/K navigate, Enter open, P→printing, R→ready, D→delivered (Queue page)
          </p>
        </div>
      </div>
    </Transition>

  </div>
</template>

<script setup lang="ts">
import { useEventListener } from '@vueuse/core'

const route  = useRoute()
const router = useRouter()
const auth   = useAuthStore()
const admin  = useAdminStore()

const drawerOpen    = ref(false)
const shortcutsOpen = ref(false)

const filledIcon = "font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;"

const navItems = [
  { name: 'Dashboard', icon: 'dashboard',      route: 'admin',           exact: true  },
  { name: 'Queue',     icon: 'pending_actions', route: 'admin-queue',     exact: false },
  { name: 'Customers', icon: 'group',           route: 'admin-customers', exact: false },
  { name: 'Reports',   icon: 'assessment',      route: 'admin-reports',   exact: false },
  { name: 'Settings',  icon: 'settings',        route: 'admin-settings',  exact: false },
]

const shortcutsList = [
  { key: '?',     label: 'Show this help'        },
  { key: 'G D',   label: 'Go to Dashboard'       },
  { key: 'G Q',   label: 'Go to Queue'           },
  { key: 'G C',   label: 'Go to Customers'       },
  { key: 'G R',   label: 'Go to Reports'         },
  { key: 'G S',   label: 'Go to Settings'        },
  { key: 'J / K', label: 'Navigate jobs (queue)' },
  { key: 'Enter', label: 'Open selected job'     },
  { key: 'Esc',   label: 'Close panel'           },
  { key: 'P',     label: 'Advance to Printing'   },
  { key: 'R',     label: 'Advance to Ready'      },
  { key: 'D',     label: 'Advance to Delivered'  },
]

const isQueuePage = computed(() => route.name === 'admin-queue')

const breadcrumbs = computed(() => {
  const name = (route.name as string) ?? ''
  if (name === 'admin')              return [{ label: 'Dashboard' }]
  if (name === 'admin-queue')        return [{ label: 'Dashboard', route: 'admin' }, { label: 'Queue' }]
  if (name === 'admin-customers')    return [{ label: 'Dashboard', route: 'admin' }, { label: 'Customers' }]
  if (name === 'admin-customers-id') return [{ label: 'Dashboard', route: 'admin' }, { label: 'Customers', route: 'admin-customers' }, { label: 'Profile' }]
  if (name === 'admin-reports')      return [{ label: 'Dashboard', route: 'admin' }, { label: 'Reports' }]
  if (name === 'admin-settings')     return [{ label: 'Dashboard', route: 'admin' }, { label: 'Settings' }]
  return [{ label: 'Admin' }]
})

const userInitials = computed(() => {
  const n = auth.user?.name ?? ''
  return n.split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase() || 'A'
})

const lastUpdatedAgo = computed(() => {
  if (!admin.lastUpdated) return ''
  const diff = Math.floor((Date.now() - (admin.lastUpdated as Date).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  return `${Math.floor(diff / 60)}m ago`
})

// ── Global keyboard shortcuts ───────────────────────────────────────────────
let gPressed = false
let gTimer: ReturnType<typeof setTimeout> | null = null

useEventListener('keydown', (e: KeyboardEvent) => {
  const tag = (e.target as HTMLElement).tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

  if (e.key === '?') { shortcutsOpen.value = true; return }
  if (e.key === 'Escape') { shortcutsOpen.value = false; return }

  if (e.key === 'g' || e.key === 'G') {
    gPressed = true
    if (gTimer) clearTimeout(gTimer)
    gTimer = setTimeout(() => { gPressed = false }, 1000)
    return
  }

  if (gPressed) {
    gPressed = false
    if (gTimer) clearTimeout(gTimer)
    const k = e.key.toLowerCase()
    if (k === 'd') router.push({ name: 'admin' })
    else if (k === 'q') router.push({ name: 'admin-queue' })
    else if (k === 'c') router.push({ name: 'admin-customers' })
    else if (k === 'r') router.push({ name: 'admin-reports' })
    else if (k === 's') router.push({ name: 'admin-settings' })
  }
})

async function handleLogout() {
  auth.logout()
  router.push('/')
}
</script>

<style scoped>
.overlay-enter-active, .overlay-leave-active { transition: opacity 0.2s ease; }
.overlay-enter-from, .overlay-leave-to { opacity: 0; }
</style>
