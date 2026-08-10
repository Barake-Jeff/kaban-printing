<template>
  <div class="space-y-5">

    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Reports</h1>
        <p class="text-sm text-gray-500 mt-0.5">Last 14 days</p>
      </div>
      <button
        @click="onExport"
        class="flex items-center gap-2 px-4 py-2 text-sm font-semibold border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
      >
        <span class="material-symbols-outlined" style="font-size:18px;">download</span>
        Export
      </button>
    </div>

    <!-- Tabs -->
    <div class="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
      <button
        v-for="tab in ['Revenue', 'Jobs', 'Customers']"
        :key="tab"
        @click="activeTab = tab"
        :class="[
          'px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
          activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700',
        ]"
      >{{ tab }}</button>
    </div>

    <div v-if="loading" class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <AdminSkeletonCard v-for="i in 4" :key="i" />
    </div>

    <template v-else-if="data">

      <!-- ── Revenue tab ───────────────────────────────────────────────────── -->
      <template v-if="activeTab === 'Revenue'">
        <!-- Stat cards -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <AdminStatsCard label="Total revenue" :value="totalRevenue" prefix="KES " icon="payments" />
          <AdminStatsCard label="Daily average" :value="dailyAvg" prefix="KES " icon="show_chart" />
          <AdminStatsCard label="Best day" :value="bestDay.revenue" prefix="KES " icon="trending_up" />
          <AdminStatsCard label="Total jobs" :value="totalJobs" icon="print" />
        </div>

        <!-- Area chart -->
        <div class="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 class="font-bold text-gray-900 text-sm mb-4">Daily revenue (KES)</h3>
          <ClientOnly>
            <ApexChart
              type="area"
              height="260"
              :options="revenueChartOpts"
              :series="[{ name: 'Revenue', data: data.dailyRevenue.map(d => d.revenue) }]"
            />
          </ClientOnly>
        </div>
      </template>

      <!-- ── Jobs tab ──────────────────────────────────────────────────────── -->
      <template v-else-if="activeTab === 'Jobs'">
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-2">
          <AdminStatsCard label="Avg fulfillment" :value="data.averageFulfillmentMinutes" unit="min" icon="timer" />
          <AdminStatsCard label="Completed" :value="completedCount" icon="check_circle" />
          <AdminStatsCard label="Busiest day" :value="busiestDay.day" icon="calendar_today" />
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <!-- Donut: status split -->
          <div class="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 class="font-bold text-gray-900 text-sm mb-4">Jobs by status</h3>
            <ClientOnly>
              <ApexChart
                type="donut"
                height="220"
                :options="statusDonutOpts"
                :series="data.jobsByStatus.map(s => s.count)"
              />
            </ClientOnly>
          </div>

          <!-- Bar: by day of week -->
          <div class="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 class="font-bold text-gray-900 text-sm mb-4">Jobs by day of week</h3>
            <ClientOnly>
              <ApexChart
                type="bar"
                height="220"
                :options="dayBarOpts"
                :series="[{ name: 'Jobs', data: data.jobsByDayOfWeek.map(d => d.count) }]"
              />
            </ClientOnly>
          </div>
        </div>
      </template>

      <!-- ── Customers tab ─────────────────────────────────────────────────── -->
      <template v-else>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <AdminStatsCard label="New customers" :value="newCustomers" icon="person_add" />
          <AdminStatsCard label="Returning" :value="returningCustomers" icon="repeat" />
        </div>

        <!-- Top customers table -->
        <div class="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div class="px-5 py-3.5 border-b border-gray-100">
            <h3 class="font-bold text-gray-900 text-sm">Top customers by spend</h3>
          </div>
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-gray-50 border-b border-gray-100 text-left">
                <th class="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400">#</th>
                <th class="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Name</th>
                <th class="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Jobs</th>
                <th class="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Total spent</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-50">
              <tr v-for="(c, i) in data.topCustomers" :key="c.name" class="hover:bg-gray-50 transition-colors">
                <td class="px-5 py-3 text-gray-400 font-mono">{{ i + 1 }}</td>
                <td class="px-5 py-3 font-medium text-gray-900">{{ c.name }}</td>
                <td class="px-5 py-3 text-gray-600">{{ c.totalJobs }}</td>
                <td class="px-5 py-3 font-semibold text-gray-900">KES {{ c.totalSpent }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Payment split bar -->
        <div class="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 class="font-bold text-gray-900 text-sm mb-4">Payment method split</h3>
          <ClientOnly>
            <ApexChart
              type="bar"
              height="140"
              :options="paymentBarOpts"
              :series="[{ name: 'Jobs', data: data.paymentMethodSplit.map(p => p.count) }]"
            />
          </ClientOnly>
        </div>
      </template>
    </template>

  </div>
</template>

<script setup lang="ts">
import { toast } from 'vue-sonner'
import type { ReportData } from '~/types'

definePageMeta({ layout: 'admin', middleware: 'auth', requiresAuth: true, role: 'admin' })

const activeTab = ref('Revenue')
const loading   = ref(false)
const data      = ref<ReportData | null>(null)

// ── Derived stats ────────────────────────────────────────────────────────────
const totalRevenue = computed(() => data.value?.dailyRevenue.reduce((s, d) => s + d.revenue, 0) ?? 0)
const dailyAvg     = computed(() => Math.round((totalRevenue.value ?? 0) / (data.value?.dailyRevenue.length || 1)))
const bestDay      = computed(() => {
  if (!data.value) return { date: '', revenue: 0 }
  return [...data.value.dailyRevenue].sort((a, b) => b.revenue - a.revenue)[0] ?? { date: '', revenue: 0 }
})
const totalJobs     = computed(() => data.value?.jobsByStatus.reduce((s, j) => s + j.count, 0) ?? 0)
const completedCount = computed(() => data.value?.jobsByStatus.find(s => s.status === 'delivered')?.count ?? 0)
const busiestDay    = computed(() => {
  if (!data.value) return { day: '', count: 0 }
  return [...data.value.jobsByDayOfWeek].sort((a, b) => b.count - a.count)[0] ?? { day: '', count: 0 }
})
const newCustomers      = computed(() => Math.round((totalJobs.value ?? 0) * 0.3))
const returningCustomers = computed(() => (totalJobs.value ?? 0) - newCustomers.value)

// ── Chart options ────────────────────────────────────────────────────────────
const revenueChartOpts = computed(() => ({
  chart:    { toolbar: { show: false }, sparkline: { enabled: false } },
  stroke:   { curve: 'smooth', width: 2.5 },
  fill:     { type: 'gradient', gradient: { opacityFrom: 0.35, opacityTo: 0.05 } },
  colors:   ['#021745'],
  xaxis:    { categories: data.value?.dailyRevenue.map(d => d.date.slice(5)) ?? [], labels: { style: { fontSize: '11px' } } },
  yaxis:    { labels: { formatter: (v: number) => `KES ${v}` } },
  grid:     { borderColor: '#f3f4f6' },
  dataLabels: { enabled: false },
  tooltip:  { y: { formatter: (v: number) => `KES ${v}` } },
}))

const statusDonutOpts = computed(() => ({
  labels:    data.value?.jobsByStatus.map(s => s.status.charAt(0).toUpperCase() + s.status.slice(1)) ?? [],
  colors:    ['#f59e0b', '#3b82f6', '#22c55e', '#6b7280'],
  legend:    { position: 'bottom' as const },
  dataLabels: { enabled: true },
  chart:     { toolbar: { show: false } },
}))

const dayBarOpts = computed(() => ({
  chart:    { toolbar: { show: false } },
  colors:   ['#F97316'],
  xaxis:    { categories: data.value?.jobsByDayOfWeek.map(d => d.day) ?? [] },
  grid:     { borderColor: '#f3f4f6' },
  dataLabels: { enabled: false },
  plotOptions: { bar: { borderRadius: 4, columnWidth: '60%' } },
}))

const paymentBarOpts = computed(() => ({
  chart:    { toolbar: { show: false } },
  colors:   ['#021745', '#F97316'],
  xaxis:    { categories: data.value?.paymentMethodSplit.map(p => p.method === 'mpesa' ? 'M-Pesa' : 'Pay on pickup') ?? [] },
  grid:     { borderColor: '#f3f4f6' },
  dataLabels: { enabled: false },
  plotOptions: { bar: { borderRadius: 4, columnWidth: '40%', horizontal: true } },
}))

function onExport() {
  toast.info('Export not yet available')
}

const adminStore = useAdminStore()

onMounted(async () => {
  loading.value = true
  await adminStore.fetchReportData()
  data.value = adminStore.reportData
  loading.value = false
})
</script>
