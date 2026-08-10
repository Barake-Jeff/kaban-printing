<template>
  <div class="space-y-5 max-w-4xl">

    <!-- Back -->
    <NuxtLink
      :to="{ name: 'admin-customers' }"
      class="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary transition-colors"
    >
      <span class="material-symbols-outlined" style="font-size:18px;">arrow_back</span>
      Back to customers
    </NuxtLink>

    <div v-if="loading" class="space-y-4">
      <AdminSkeletonCard v-for="i in 3" :key="i" />
    </div>

    <template v-else-if="customer">

      <!-- ── Header card ─────────────────────────────────────────────────── -->
      <div class="bg-white rounded-2xl border border-gray-100 p-6 flex flex-col sm:flex-row items-start sm:items-center gap-5">
        <div class="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary flex-shrink-0">
          {{ initials(customer.name) }}
        </div>
        <div class="flex-1 min-w-0">
          <h1 class="text-2xl font-bold text-gray-900">{{ customer.name }}</h1>
          <p class="text-sm text-gray-500 mt-0.5">House {{ customer.houseNumber }} · {{ customer.phone }}</p>
        </div>
        <div class="grid grid-cols-3 gap-4 text-center">
          <div>
            <p class="text-2xl font-bold text-gray-900">{{ customer.totalJobs }}</p>
            <p class="text-xs text-gray-400">Total jobs</p>
          </div>
          <div>
            <p class="text-2xl font-bold text-gray-900">{{ customer.totalSpent }}</p>
            <p class="text-xs text-gray-400">KES spent</p>
          </div>
          <div>
            <p class="text-2xl font-bold text-gray-900">{{ activeJobCount }}</p>
            <p class="text-xs text-gray-400">Active now</p>
          </div>
        </div>
      </div>

      <!-- ── Order history ────────────────────────────────────────────────── -->
      <div>
        <h2 class="font-bold text-gray-900 mb-3">Order history</h2>
        <AdminJobTable
          :jobs="customerJobs"
          @row-click="admin.selectJob($event)"
          @quick-advance="onQuickAdvance"
        >
          <template #empty>No jobs found for this customer.</template>
        </AdminJobTable>
      </div>

      <!-- ── Payment split + Notifications ──────────────────────────────── -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">

        <!-- Payment split -->
        <div class="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 class="font-bold text-gray-900 text-sm mb-4">Payment method split</h3>
          <div class="space-y-3">
            <div>
              <div class="flex justify-between text-sm mb-1">
                <span class="text-gray-600">M-Pesa</span>
                <span class="font-semibold">{{ customer.mpesaCount }} jobs</span>
              </div>
              <div class="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  class="h-full bg-green-400 rounded-full transition-all"
                  :style="`width:${mpesaPct}%`"
                />
              </div>
            </div>
            <div>
              <div class="flex justify-between text-sm mb-1">
                <span class="text-gray-600">Pay on pickup</span>
                <span class="font-semibold">{{ customer.payOnPickupCount }} jobs</span>
              </div>
              <div class="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  class="h-full bg-amber-400 rounded-full transition-all"
                  :style="`width:${100 - mpesaPct}%`"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Notification settings -->
        <div class="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 class="font-bold text-gray-900 text-sm mb-4">Notification settings</h3>
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2 text-sm text-gray-700">
                <span class="material-symbols-outlined" style="font-size:18px;">sms</span>
                SMS notifications
              </div>
              <div :class="['w-10 h-6 rounded-full flex items-center px-1', notifSms ? 'bg-primary' : 'bg-gray-200']">
                <div :class="['w-4 h-4 rounded-full bg-white shadow transition-transform', notifSms ? 'translate-x-4' : '']" />
              </div>
            </div>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2 text-sm text-gray-700">
                <span class="material-symbols-outlined" style="font-size:18px;">chat</span>
                WhatsApp notifications
              </div>
              <div :class="['w-10 h-6 rounded-full flex items-center px-1', notifWa ? 'bg-primary' : 'bg-gray-200']">
                <div :class="['w-4 h-4 rounded-full bg-white shadow transition-transform', notifWa ? 'translate-x-4' : '']" />
              </div>
            </div>
          </div>
          <p class="text-xs text-gray-400 mt-3">Customer-controlled — view only</p>
        </div>
      </div>
    </template>

    <div v-else class="flex flex-col items-center py-16 text-gray-400 gap-2">
      <span class="material-symbols-outlined" style="font-size:48px;">person_off</span>
      <p class="text-sm">Customer not found</p>
    </div>

    <!-- Job slide panel -->
    <AdminJobSlidePanel
      :job="admin.selectedJob"
      @close="admin.clearSelectedJob()"
      @update-status="admin.updateJobStatus"
      @mark-paid="admin.markAsPaid"
      @save-notes="admin.saveNotes"
      @cancel="admin.cancelJob"
    />

  </div>
</template>

<script setup lang="ts">
import type { Customer, Job } from '~/types'
import { CUSTOMERS } from '~/data/dummy'

definePageMeta({ layout: 'admin', middleware: 'auth', requiresAuth: true, role: 'admin' })

const route   = useRoute()
const admin   = useAdminStore()
const loading = ref(false)
const customer = ref<Customer | null>(null)

const customerId = computed(() => route.params.id as string)

const customerJobs = computed<Job[]>(() =>
  admin.jobs.filter(j =>
    j.houseNumber === customer.value?.houseNumber ||
    j.customerName === customer.value?.name
  )
)

const activeJobCount = computed(() =>
  customerJobs.value.filter(j => ['pending', 'printing', 'ready'].includes(j.status)).length
)

const mpesaPct = computed(() => {
  const total = (customer.value?.mpesaCount ?? 0) + (customer.value?.payOnPickupCount ?? 0)
  if (total === 0) return 50
  return Math.round(((customer.value?.mpesaCount ?? 0) / total) * 100)
})

const notifSms = ref(true)
const notifWa  = ref(false)

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase()
}

const statusOrder: Job['status'][] = ['pending', 'printing', 'ready', 'delivered']

async function onQuickAdvance(job: Job) {
  const idx = statusOrder.indexOf(job.status)
  if (idx >= 0 && idx < statusOrder.length - 1) await admin.updateJobStatus(job.id, statusOrder[idx + 1])
}

onMounted(async () => {
  loading.value = true
  try {
    if (admin.customers.length === 0) await admin.fetchCustomers()
    if (admin.jobs.length === 0) await admin.fetchQueue()
    customer.value = admin.customers.find(c => c.id === customerId.value)
      ?? (CUSTOMERS as unknown as Customer[]).find(c => c.id === customerId.value)
      ?? null
  } finally {
    loading.value = false
  }
})
</script>
