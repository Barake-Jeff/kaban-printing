<template>
  <div class="space-y-4">

    <!-- ── Page header ─────────────────────────────────────────────────────── -->
    <div class="flex flex-col sm:flex-row sm:items-center gap-3">
      <div class="flex-1">
        <h1 class="text-2xl font-bold text-gray-900">Print Queue</h1>
        <p class="text-sm text-gray-500 mt-0.5">{{ admin.jobs.length }} total jobs</p>
      </div>
      <button
        @click="refresh"
        :disabled="admin.loading"
        class="flex items-center gap-2 px-4 py-2 text-sm font-semibold border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
      >
        <span class="material-symbols-outlined" :class="admin.loading ? 'animate-spin' : ''" style="font-size:18px;">refresh</span>
        Refresh
      </button>
    </div>

    <!-- ── Status tabs ──────────────────────────────────────────────────────── -->
    <div class="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        @click="activeTab = tab.key"
        :class="[
          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
          activeTab === tab.key
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-500 hover:text-gray-700',
        ]"
      >
        {{ tab.label }}
        <span :class="['text-xs font-bold px-1.5 py-0.5 rounded-full', tab.count > 0 ? 'bg-primary text-white' : 'bg-gray-200 text-gray-500']">
          {{ tab.count }}
        </span>
      </button>
    </div>

    <!-- ── Bulk action bar ─────────────────────────────────────────────────── -->
    <Transition name="bulk-bar">
      <div
        v-if="selectedIds.size > 0"
        class="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-xl px-4 py-3"
      >
        <span class="text-sm font-semibold text-primary">{{ selectedIds.size }} selected</span>
        <div class="flex gap-2 ml-auto">
          <button
            @click="bulkAdvance"
            class="px-3 py-1.5 text-sm font-semibold bg-primary text-white rounded-xl hover:opacity-90 transition-all active:scale-[0.98]"
          >Advance status</button>
          <button
            @click="selectedIds.clear()"
            class="px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 rounded-xl transition-colors"
          >Clear</button>
        </div>
      </div>
    </Transition>

    <!-- ── Job table ────────────────────────────────────────────────────────── -->
    <AdminSkeletonTable v-if="admin.loading && !initialLoaded" :rows="6" />
    <AdminJobTable
      v-else
      :jobs="filteredJobs"
      :selectable="true"
      :selected-ids="selectedIds"
      :focused-index="focusedIndex"
      :show-wait="true"
      @row-click="openJob"
      @toggle-select="toggleSelect"
      @select-all="selectAll"
      @quick-advance="onQuickAdvance"
    >
      <template #empty>
        <div class="py-6">
          <p class="text-gray-400">No jobs in this category</p>
        </div>
      </template>
    </AdminJobTable>

    <!-- ── Job slide panel ────────────────────────────────────────────────── -->
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
import { useEventListener } from '@vueuse/core'
import type { Job } from '~/types'

definePageMeta({ layout: 'admin', middleware: 'auth', requiresAuth: true, role: 'admin' })

const admin = useAdminStore()

const activeTab    = ref<'all' | 'pending' | 'printing' | 'ready' | 'delivered'>('all')
const selectedIds  = ref<Set<string>>(new Set())
const focusedIndex = ref(-1)
const initialLoaded = ref(false)

const statusOrder: Job['status'][] = ['pending', 'printing', 'ready', 'delivered']

const filteredJobs = computed(() => {
  if (activeTab.value === 'all') return admin.jobs
  return admin.jobs.filter(j => j.status === activeTab.value)
})

const tabs = computed(() => [
  { key: 'all'       as const, label: 'All',       count: admin.jobs.length },
  { key: 'pending'   as const, label: 'Pending',   count: admin.jobs.filter(j => j.status === 'pending').length },
  { key: 'printing'  as const, label: 'Printing',  count: admin.jobs.filter(j => j.status === 'printing').length },
  { key: 'ready'     as const, label: 'Ready',     count: admin.jobs.filter(j => j.status === 'ready').length },
  { key: 'delivered' as const, label: 'Delivered', count: admin.jobs.filter(j => j.status === 'delivered').length },
])

function openJob(job: Job) {
  admin.selectJob(job)
  focusedIndex.value = filteredJobs.value.findIndex(j => j.id === job.id)
}

function toggleSelect(id: string) {
  if (selectedIds.value.has(id)) selectedIds.value.delete(id)
  else selectedIds.value.add(id)
  selectedIds.value = new Set(selectedIds.value)
}

function selectAll(val: boolean) {
  if (val) selectedIds.value = new Set(filteredJobs.value.map(j => j.id))
  else selectedIds.value = new Set()
}

async function onQuickAdvance(job: Job) {
  const idx = statusOrder.indexOf(job.status)
  if (idx >= 0 && idx < statusOrder.length - 1) await admin.updateJobStatus(job.id, statusOrder[idx + 1])
}

async function bulkAdvance() {
  const ids = Array.from(selectedIds.value)
  await Promise.all(ids.map(id => {
    const job = admin.jobs.find(j => j.id === id)
    if (!job) return
    const idx = statusOrder.indexOf(job.status)
    if (idx >= 0 && idx < statusOrder.length - 1) return admin.updateJobStatus(id, statusOrder[idx + 1])
  }))
  selectedIds.value = new Set()
}

async function refresh() {
  await admin.fetchQueue()
  admin.lastUpdated = new Date()
}

// ── Keyboard navigation ────────────────────────────────────────────────────
useEventListener('keydown', async (e: KeyboardEvent) => {
  const tag = (e.target as HTMLElement).tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
  if (admin.selectedJob) {
    if (e.key === 'Escape') { admin.clearSelectedJob(); return }
    return
  }

  const jobs = filteredJobs.value
  if (e.key === 'j' || e.key === 'J') {
    e.preventDefault()
    focusedIndex.value = Math.min(focusedIndex.value + 1, jobs.length - 1)
  } else if (e.key === 'k' || e.key === 'K') {
    e.preventDefault()
    focusedIndex.value = Math.max(focusedIndex.value - 1, 0)
  } else if (e.key === 'Enter' && focusedIndex.value >= 0) {
    const job = jobs[focusedIndex.value]
    if (job) admin.selectJob(job)
  } else if (focusedIndex.value >= 0) {
    const job = jobs[focusedIndex.value]
    if (!job) return
    const idx = statusOrder.indexOf(job.status)
    if (e.key === 'p' || e.key === 'P') {
      await admin.updateJobStatus(job.id, 'printing')
    } else if (e.key === 'r' || e.key === 'R') {
      await admin.updateJobStatus(job.id, 'ready')
    } else if (e.key === 'd' || e.key === 'D') {
      await admin.updateJobStatus(job.id, 'delivered')
    }
  }
})

onMounted(async () => {
  await admin.fetchQueue()
  initialLoaded.value = true
  admin.lastUpdated = new Date()
  admin.startPolling(30_000)
})

onUnmounted(() => {
  admin.stopPolling()
})
</script>

<style scoped>
.bulk-bar-enter-active, .bulk-bar-leave-active { transition: all 0.2s ease; }
.bulk-bar-enter-from, .bulk-bar-leave-to { opacity: 0; transform: translateY(-8px); }
</style>
