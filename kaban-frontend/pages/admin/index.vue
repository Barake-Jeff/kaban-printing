<template>
  <div class="space-y-6">

    <!-- ── Page header ──────────────────────────────────────────────────────── -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p class="text-sm text-gray-500 mt-0.5">Here's what needs attention today</p>
      </div>
      <NuxtLink
        :to="{ name: 'admin-queue' }"
        class="text-sm font-semibold text-primary hover:underline flex items-center gap-1"
      >View full queue <span class="material-symbols-outlined" style="font-size:16px;">arrow_forward</span></NuxtLink>
    </div>

    <!-- ── Stat cards ────────────────────────────────────────────────────────── -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <template v-if="admin.loading && !statsLoaded">
        <AdminSkeletonCard v-for="i in 4" :key="i" />
      </template>
      <template v-else>
        <AdminStatsCard label="Jobs today" :value="admin.stats.jobsToday" icon="print">
          <div class="h-10 mt-1">
            <ClientOnly>
              <ApexChart
                type="area"
                height="40"
                :options="sparklineOpts('#021745')"
                :series="[{ data: sparklineData }]"
              />
            </ClientOnly>
          </div>
        </AdminStatsCard>

        <AdminStatsCard label="Pending" :value="admin.stats.pending" icon="pending_actions">
          <p class="text-xs text-amber-600 font-medium mt-1">
            {{ urgentJobs.length > 0 ? `${urgentJobs.length} waiting >30 min` : 'All on track' }}
          </p>
        </AdminStatsCard>

        <AdminStatsCard label="Completed" :value="admin.stats.completed" icon="check_circle">
          <p class="text-xs text-green-600 font-medium mt-1">Today</p>
        </AdminStatsCard>

        <AdminStatsCard label="Revenue today" :value="admin.stats.revenueToday" icon="payments" prefix="KES ">
          <p class="text-xs text-gray-400 mt-1">Cash + M-Pesa</p>
        </AdminStatsCard>
      </template>
    </div>

    <!-- ── Main content ───────────────────────────────────────────────────── -->
    <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">

      <!-- Urgent jobs table -->
      <div class="xl:col-span-2 space-y-3">
        <div class="flex items-center justify-between">
          <h2 class="font-bold text-gray-900">Urgent jobs</h2>
          <span class="text-xs text-gray-400">Pending / waiting >30 min</span>
        </div>

        <AdminSkeletonTable v-if="admin.loading && !statsLoaded" :rows="4" />
        <AdminJobTable
          v-else
          :jobs="urgentJobs"
          :show-wait="true"
          @row-click="admin.selectJob($event)"
          @quick-advance="onQuickAdvance"
        >
          <template #empty>No urgent jobs right now 🎉</template>
        </AdminJobTable>
      </div>

      <!-- Side panels -->
      <div class="space-y-4">
        <!-- Active Alerts -->
        <div class="bg-white rounded-2xl border border-gray-100 p-4">
          <h3 class="font-bold text-gray-900 text-sm mb-3">Active alerts</h3>
          <div v-if="admin.alerts.length === 0" class="text-xs text-gray-400 py-4 text-center">No alerts</div>
          <ul v-else class="space-y-2">
            <li
              v-for="alert in admin.alerts"
              :key="alert.id"
              :class="['flex items-start gap-2 text-xs p-2 rounded-xl', alertStyle(alert.type)]"
            >
              <span class="material-symbols-outlined" style="font-size:16px; flex-shrink:0; margin-top:1px;">
                {{ alert.type === 'unpaid' ? 'payments' : alert.type === 'wait' ? 'schedule' : 'local_shipping' }}
              </span>
              <span>{{ alert.message }}</span>
            </li>
          </ul>
        </div>

        <!-- Customer lookup -->
        <div class="bg-white rounded-2xl border border-gray-100 p-4">
          <h3 class="font-bold text-gray-900 text-sm mb-3">Customer lookup</h3>
          <div class="flex gap-2">
            <input
              v-model="lookupHouse"
              type="text"
              placeholder="House number…"
              class="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              @keydown.enter="doLookup"
            />
            <button
              @click="doLookup"
              class="px-3 py-2 text-sm font-semibold text-white rounded-xl transition-all active:scale-[0.98]"
              style="background-color:#021745;"
            >Find</button>
          </div>

          <div v-if="lookedUpCustomer" class="mt-3 bg-gray-50 rounded-xl p-3 text-sm space-y-1">
            <p class="font-semibold text-gray-900">{{ lookedUpCustomer.name }}</p>
            <p class="text-gray-500">House {{ lookedUpCustomer.houseNumber }} · {{ lookedUpCustomer.phone }}</p>
            <p class="text-gray-400 text-xs">{{ lookedUpCustomer.totalJobs }} jobs · KES {{ lookedUpCustomer.totalSpent }}</p>
          </div>
          <p v-if="lookupNotFound" class="mt-2 text-xs text-red-500">No customer found for that house number.</p>
        </div>
      </div>
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
import type { Customer } from '~/types'

definePageMeta({ layout: 'admin', middleware: 'auth', requiresAuth: true, role: 'admin' })

const admin = useAdminStore()

const statsLoaded      = ref(false)
const lookupHouse      = ref('')
const lookedUpCustomer = ref<Customer | null>(null)
const lookupNotFound   = ref(false)

const urgentJobs = computed(() => {
  const threshold = Date.now() - 30 * 60 * 1000
  return admin.jobs.filter(j =>
    (j.status === 'pending' || j.status === 'printing') &&
    new Date(j.createdAt).getTime() < threshold
  )
})

const sparklineData = computed(() =>
  Array.from({ length: 7 }, (_, i) => (admin.stats.jobsToday || 1) - i + Math.floor(Math.random() * 3))
    .reverse()
    .map(v => Math.max(0, v))
)

function sparklineOpts(color: string) {
  return {
    chart:   { sparkline: { enabled: true }, toolbar: { show: false }, animations: { enabled: false } },
    stroke:  { curve: 'smooth', width: 2 },
    fill:    { type: 'gradient', gradient: { opacityFrom: 0.25, opacityTo: 0 } },
    colors:  [color],
    tooltip: { enabled: false },
  }
}

function alertStyle(type: string) {
  return {
    unpaid:   'bg-red-50 text-red-700',
    wait:     'bg-amber-50 text-amber-700',
    delivery: 'bg-blue-50 text-blue-700',
  }[type] ?? 'bg-gray-50 text-gray-600'
}

async function doLookup() {
  if (!lookupHouse.value.trim()) return
  lookedUpCustomer.value = null
  lookupNotFound.value = false
  const result = await admin.lookupCustomer(lookupHouse.value.trim())
  if (result) lookedUpCustomer.value = result
  else lookupNotFound.value = true
}

async function onQuickAdvance(job: typeof admin.jobs[number]) {
  const order: typeof job.status[] = ['pending', 'printing', 'ready', 'delivered']
  const idx = order.indexOf(job.status)
  if (idx >= 0 && idx < order.length - 1) await admin.updateJobStatus(job.id, order[idx + 1])
}

onMounted(async () => {
  await Promise.all([admin.fetchQueue(), admin.fetchStats()])
  statsLoaded.value = true
})
</script>
