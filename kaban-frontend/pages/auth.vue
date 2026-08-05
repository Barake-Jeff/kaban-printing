<template>
  <div class="text-on-surface">

    <CommonTopAppBar login-action="emit" @login-click="setTab('login')" />

    <main class="pt-12 pb-8 min-h-screen flex flex-col">

      <h1 class="sr-only">Sign in or create a PrintEase account</h1>

      <!-- Auth Tabs -->
      <div
        role="tablist"
        aria-label="Sign up or log in"
        class="flex w-full bg-surface border-b border-outline-variant sticky top-12 z-40"
      >
        <button
          v-for="tab in tabs"
          :id="`tab-${tab.key}`"
          :key="tab.key"
          role="tab"
          type="button"
          :aria-selected="activeTab === tab.key"
          :aria-controls="`panel-${tab.key}`"
          :tabindex="activeTab === tab.key ? 0 : -1"
          :class="['flex-1 py-4 text-center font-label-bold text-label-bold uppercase tracking-wider transition-all',
            activeTab === tab.key ? 'tab-active' : 'tab-inactive']"
          @click="setTab(tab.key)"
          @keydown.left.prevent="cycleTab(-1)"
          @keydown.right.prevent="cycleTab(1)"
        >
          {{ tab.label }}
        </button>
      </div>

      <section class="px-margin-mobile py-xl flex-grow">

        <!-- Offline notice: stops a submit that could never leave the device -->
        <div v-if="!online" class="mb-md">
          <CommonAlertBanner
            tone="error"
            message="You're offline. Reconnect to sign in or create an account."
          />
        </div>

        <div
          v-if="activeTab === 'signup'"
          id="panel-signup"
          role="tabpanel"
          aria-labelledby="tab-signup"
        >
          <AuthSignupForm
            :initial-phone="sharedPhone"
            :disabled="!online"
            @switch-tab="handleSwitchTab"
          />
        </div>

        <div
          v-else
          id="panel-login"
          role="tabpanel"
          aria-labelledby="tab-login"
        >
          <AuthLoginForm
            :initial-phone="sharedPhone"
            :disabled="!online"
            @switch-tab="handleSwitchTab"
          />
        </div>

        <!-- Staff link -->
        <p class="text-center mt-xl">
          <NuxtLink
            to="/admin/login"
            class="text-xs text-on-surface-variant/50 hover:text-on-surface-variant transition-colors"
          >
            Staff? Sign in here →
          </NuxtLink>
        </p>

        <!-- Illustration (decorative) -->
        <div class="mt-md text-center">
          <img
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuAbmbtIHqRKdcMynD5YK3ENsxjkYSiBxYL3ulRpr0mtO4hF4wJ6f9_Tfm4bNKAQVl8TSedOwfcnOZW-iaqx4p43AaKw84KoH1B1UT6AKby5vclFSlbLoWSEhQZzwf24jlrP8LUCdUAlAvvEiZLuZ56O0o-UOtgM6_m3Y1QEZm7rAJjgDUKglNsqpWfzqaIw3Bt02S-HBBztE0VN3sUn3zr6qvp5ZKtnKXedG68zaBAo7umVxwkyxoZw3b5y3fnNNEXBVwQQGyFHcIM"
            alt=""
            aria-hidden="true"
            width="800"
            height="450"
            loading="lazy"
            class="w-full aspect-video object-cover rounded-xl grayscale-[40%] opacity-90"
          />
        </div>

      </section>
    </main>

  </div>
</template>

<script setup lang="ts">
import { useOnline } from '@vueuse/core'

definePageMeta({ middleware: 'auth' })

type TabKey = 'signup' | 'login'

const tabs = [
  { key: 'signup' as const, label: 'Sign up' },
  { key: 'login'  as const, label: 'Log in'  },
]

const route  = useRoute()
const router = useRouter()
const auth   = useAuthStore()
const online = useOnline()

const activeTab   = ref<TabKey>(route.query.tab === 'login' ? 'login' : 'signup')
/** Carries a typed number across the 401/409 handoffs so nobody retypes it. */
const sharedPhone = ref('')

function setTab(tab: TabKey) {
  if (activeTab.value === tab) return
  activeTab.value = tab
}

function cycleTab(direction: number) {
  const i = tabs.findIndex(t => t.key === activeTab.value)
  const next = tabs[(i + direction + tabs.length) % tabs.length]
  setTab(next.key)
  nextTick(() => document.getElementById(`tab-${next.key}`)?.focus())
}

function handleSwitchTab({ tab, phone }: { tab: TabKey; phone: string }) {
  sharedPhone.value = phone
  setTab(tab)
}

// The forms are v-if'd so their local state resets, but auth.error lives in the
// store and would otherwise follow the user across the tab switch.
watch(activeTab, (tab) => {
  auth.error = null
  router.replace({ query: { ...route.query, tab } })
})
</script>

<style scoped>
.tab-active {
  border-bottom: 3px solid #fd761a;
  color: #021745;
}
.tab-inactive {
  color: #757680;
}
</style>
