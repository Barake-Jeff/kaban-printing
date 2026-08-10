<template>
  <div class="pt-12">
    <!-- Filter tabs (sticky below the layout top nav) -->
    <nav class="flex w-full bg-surface border-b border-outline-variant sticky top-12 z-40">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        @click="activeTab = tab.key"
        :class="[
          'flex-1 py-3 text-center font-label-bold text-label-bold uppercase tracking-wider transition-all',
          activeTab === tab.key ? 'text-primary border-b-[3px]' : 'text-on-surface-variant border-b-[3px] border-transparent',
        ]"
        :style="activeTab === tab.key ? 'border-color: #F97316; color: #1B2D5B;' : ''"
      >{{ tab.label }}</button>
    </nav>

    <!-- Search bar -->
    <div class="px-margin-mobile pt-md pb-sm bg-background">
      <div class="relative">
        <span class="material-symbols-outlined absolute left-3 top-[10px] text-on-surface-variant text-[20px]">search</span>
        <input
          v-model="search"
          type="text"
          placeholder="Search by file name or job ID…"
          class="w-full h-11 pl-10 pr-10 bg-surface-container rounded-xl border border-outline-variant font-body-md text-body-md outline-none focus:border-primary transition-colors"
        />
        <button
          v-if="search"
          @click="search = ''"
          class="absolute right-3 top-[10px] text-on-surface-variant"
        >
          <span class="material-symbols-outlined text-[20px]">close</span>
        </button>
      </div>
    </div>

    <!-- Job list -->
    <div class="px-margin-mobile flex flex-col gap-md pb-8 mt-sm">

      <!-- Empty state -->
      <div v-if="filteredJobs.length === 0 && !loading" class="flex flex-col items-center gap-lg py-2xl text-center">
        <span class="material-symbols-outlined text-on-surface-variant" style="font-size: 48px;">receipt_long</span>
        <p class="font-body-lg text-body-lg text-on-surface-variant">{{ emptyMessage }}</p>
        <NuxtLink v-if="activeTab !== 'completed'" to="/app/new-job">
          <button
            class="h-11 px-xl rounded-lg text-on-primary font-label-bold text-label-bold uppercase active:scale-95 transition-transform"
            style="background-color: #F97316;"
          >New print job</button>
        </NuxtLink>
      </div>

      <!-- Job cards -->
      <div
        v-for="job in filteredJobs"
        :key="job.id"
        @click="goToJob(job)"
        class="bg-surface-container rounded-xl p-md flex flex-col gap-sm cursor-pointer active:scale-[0.98] transition-transform"
      >
        <div class="flex justify-between items-start">
          <div class="flex-1 min-w-0 mr-sm">
            <p class="font-label-bold text-label-bold text-on-surface truncate">
              {{ job.fileName ?? 'Custom instructions' }}
            </p>
            <p class="font-body-sm text-body-sm text-on-surface-variant">{{ job.id }}</p>
          </div>
          <span :class="statusBadgeClass(job.status)" class="text-[10px] font-bold px-2 py-1 rounded-full uppercase flex-shrink-0">
            {{ statusLabel(job.status) }}
          </span>
        </div>
        <div class="flex justify-between items-center text-on-surface-variant">
          <div class="flex items-center gap-sm">
            <span class="text-[11px] font-bold uppercase px-2 py-[2px] rounded-full bg-surface-container-high">
              {{ job.deliveryType }}
            </span>
            <span class="font-body-sm text-body-sm">{{ formatDate(job.createdAt) }}</span>
          </div>
          <span class="font-label-bold text-label-bold text-on-surface">
            KES {{ job.cost + job.deliveryFee }}
          </span>
        </div>
      </div>

      <!-- Spinner -->
      <div v-if="loading" class="flex justify-center py-md">
        <div class="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>

      <!-- End marker -->
      <p v-if="allLoaded && filteredJobs.length > 0" class="text-center font-body-sm text-body-sm text-on-surface-variant py-md">
        You've reached the end
      </p>

      <!-- Sentinel -->
      <div ref="sentinel" class="h-1"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useIntersectionObserver } from '@vueuse/core'
import type { Job } from '~/types'

definePageMeta({ layout: 'customer', middleware: 'auth', requiresAuth: true, role: 'customer' })

const jobsStore = useJobsStore()
const router    = useRouter()

const PAGE_SIZE  = 10
const page       = ref(1)
const allLoaded  = ref(false)
const loading    = ref(false)
const localJobs  = ref<Job[]>([])
const sentinel   = ref<HTMLElement | null>(null)
const search     = ref('')
const activeTab  = ref<'all' | 'active' | 'completed'>('all')

const tabs = [
  { key: 'all'       as const, label: 'All'       },
  { key: 'active'    as const, label: 'Active'    },
  { key: 'completed' as const, label: 'Completed' },
]

async function loadMore() {
  if (loading.value || allLoaded.value) return
  loading.value = true
  const newJobs = await jobsStore.fetchPage(page.value, PAGE_SIZE)
  if (newJobs.length < PAGE_SIZE) allLoaded.value = true
  localJobs.value.push(...newJobs)
  page.value++
  loading.value = false
}

useIntersectionObserver(sentinel, ([entry]) => {
  if (entry?.isIntersecting) loadMore()
})

onMounted(() => loadMore())

const filteredJobs = computed(() => {
  let list = localJobs.value
  if (activeTab.value === 'active')    list = list.filter(j => ['pending', 'printing', 'ready'].includes(j.status))
  if (activeTab.value === 'completed') list = list.filter(j => j.status === 'delivered')
  if (search.value.trim()) {
    const q = search.value.toLowerCase()
    list = list.filter(j =>
      j.id.toLowerCase().includes(q) ||
      (j.fileName ?? '').toLowerCase().includes(q) ||
      (j.instructions ?? '').toLowerCase().includes(q)
    )
  }
  return list
})

const emptyMessage = computed(() => {
  if (activeTab.value === 'active')    return 'No active jobs right now.'
  if (activeTab.value === 'completed') return 'No completed jobs yet.'
  return 'No print jobs yet.'
})

function statusLabel(status: string) {
  const map: Record<string, string> = { pending: 'Queued', printing: 'Printing', ready: 'Ready', delivered: 'Complete' }
  return map[status] ?? status
}

function statusBadgeClass(status: string) {
  const map: Record<string, string> = {
    pending:   'bg-yellow-100 text-yellow-700',
    printing:  'bg-blue-100 text-blue-700',
    ready:     'bg-green-100 text-green-700',
    delivered: 'bg-gray-100 text-gray-600',
  }
  return map[status] ?? 'bg-gray-100 text-gray-500'
}

function formatDate(iso: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
}

function goToJob(job: Job) {
  jobsStore.setActiveJob(job)
  router.push(`/app/orders/${job.id}`)
}
</script>
