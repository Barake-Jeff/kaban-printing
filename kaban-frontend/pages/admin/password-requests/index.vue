<template>
  <div class="space-y-5 max-w-4xl">

    <div>
      <h1 class="text-2xl font-bold text-gray-900">Password requests</h1>
      <p class="text-sm text-gray-500 mt-1">
        People who used “Forgot password”. Contact them, set a new password, and share it directly —
        they're signed out on every device when you do.
      </p>
    </div>

    <div v-if="loading" class="space-y-4">
      <AdminSkeletonCard v-for="i in 2" :key="i" />
    </div>

    <div
      v-else-if="loadError"
      class="bg-white rounded-2xl border border-gray-100 p-10 flex flex-col items-center gap-3 text-gray-500"
    >
      <span class="material-symbols-outlined" style="font-size:40px;">cloud_off</span>
      <p class="text-sm">{{ loadError }}</p>
      <button class="text-sm font-semibold text-primary hover:underline" @click="load">Try again</button>
    </div>

    <div
      v-else-if="!requests.length"
      class="bg-white rounded-2xl border border-gray-100 p-10 flex flex-col items-center gap-2 text-gray-400"
    >
      <span class="material-symbols-outlined" style="font-size:48px;">lock_reset</span>
      <p class="text-sm">No pending requests</p>
    </div>

    <ul v-else class="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50 overflow-hidden">
      <li
        v-for="r in requests"
        :key="r.id"
        class="p-5 flex flex-col sm:flex-row sm:items-center gap-4"
      >
        <div class="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary flex-shrink-0">
          {{ initials(r.name) }}
        </div>

        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <p class="font-semibold text-gray-900 truncate">{{ r.name ?? 'Unknown user' }}</p>
            <span
              :class="[
                'px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize',
                r.role === 'admin' ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-600',
              ]"
            >{{ r.role ?? 'unknown' }}</span>
          </div>
          <p class="text-sm text-gray-500 mt-0.5">
            {{ r.phone }}<template v-if="r.houseNumber && r.houseNumber !== 'N/A'"> · House {{ r.houseNumber }}</template>
          </p>
          <p class="text-xs text-gray-400 mt-0.5">Requested {{ timeAgo(r.createdAt) }}</p>
          <p v-if="r.role === 'admin'" class="text-xs text-amber-700 mt-1.5">
            Admin passwords can't be reset here. Handle this outside the app, then dismiss.
          </p>
        </div>

        <div class="flex items-center gap-2 sm:flex-shrink-0">
          <button
            v-if="r.role !== 'admin' && r.name && r.phone"
            class="primary-btn"
            @click="openSetPassword(r)"
          >Set password</button>
          <button class="ghost-btn" @click="askDismiss(r)">Dismiss</button>
        </div>
      </li>
    </ul>

    <AdminSetPasswordDialog v-model="setOpen" :target="setTarget" @saved="onSaved" />

    <AdminConfirmDialog
      v-model="dismissOpen"
      title="Dismiss this request?"
      description="Use this when you've handled it another way, such as over the phone. The person's password won't change."
      confirm-label="Dismiss"
      @confirm="doDismiss"
    />
  </div>
</template>

<script setup lang="ts">
import { toast } from 'vue-sonner'
import type { PasswordResetRequest } from '~/types'

definePageMeta({ layout: 'admin', middleware: 'auth', requiresAuth: true, role: 'admin', adminOnly: true })

const { fetchRequests, dismissRequest } = usePasswordResets()

const requests  = ref<PasswordResetRequest[]>([])
const loading   = ref(false)
const loadError = ref<string | null>(null)

const setOpen    = ref(false)
const setTarget  = ref<{ id: string; name: string; phone: string } | null>(null)
const dismissOpen   = ref(false)
const dismissTarget = ref<string | null>(null)

async function load() {
  loading.value   = true
  loadError.value = null
  try {
    requests.value = await fetchRequests()
  } catch (e: any) {
    loadError.value = parseAuthError(e).message
  } finally {
    loading.value = false
  }
}

function openSetPassword(r: PasswordResetRequest) {
  setTarget.value = { id: r.userId, name: r.name!, phone: r.phone! }
  setOpen.value   = true
}

// The backend resolves the request itself when the password is set.
function onSaved(userId: string) {
  requests.value = requests.value.filter(r => r.userId !== userId)
}

function askDismiss(r: PasswordResetRequest) {
  dismissTarget.value = r.id
  dismissOpen.value   = true
}

async function doDismiss() {
  const id = dismissTarget.value
  if (!id) return
  try {
    await dismissRequest(id)
    requests.value = requests.value.filter(r => r.id !== id)
    toast.success('Request dismissed')
  } catch (e: any) {
    toast.error(parseAuthError(e).message)
  } finally {
    dismissTarget.value = null
  }
}

function initials(name: string | null) {
  return (name ?? '?').split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase()
}

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs} hr ago`
  const days = Math.floor(hrs / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

onMounted(load)
</script>

<style scoped>
.primary-btn {
  @apply px-4 py-2 text-sm font-semibold rounded-xl bg-primary text-on-primary hover:opacity-90 active:scale-[0.98] transition-all;
}
.ghost-btn {
  @apply px-4 py-2 text-sm font-medium rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors;
}
</style>
