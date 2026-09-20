<template>
  <div class="space-y-5">

    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center gap-3">
      <div class="flex-1">
        <h1 class="text-2xl font-bold text-gray-900">Customers</h1>
        <p class="text-sm text-gray-500 mt-0.5">
          {{ total }} {{ activeSearch ? (total === 1 ? 'match' : 'matches') : (total === 1 ? 'customer' : 'customers') }}
        </p>
      </div>
      <!-- Search -->
      <div class="relative">
        <span class="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400" style="font-size:18px;">search</span>
        <input
          v-model="search"
          type="text"
          maxlength="50"
          placeholder="Search by name, house or phone…"
          class="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl w-72 max-w-full focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        />
        <button
          v-if="search"
          @click="search = ''"
          class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          <span class="material-symbols-outlined" style="font-size:16px;">close</span>
        </button>
      </div>
    </div>

    <!-- Loading (first load only — later searches keep the current grid and dim it) -->
    <div v-if="loading && customers.length === 0" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      <AdminSkeletonCard v-for="i in 8" :key="i" />
    </div>

    <!-- Customer grid -->
    <div
      v-else-if="customers.length > 0"
      :class="['grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 transition-opacity', loading && 'opacity-60']"
    >
      <NuxtLink
        v-for="c in customers"
        :key="c.id"
        :to="{ name: 'admin-customers-id', params: { id: c.id } }"
        class="bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-md hover:border-gray-200 transition-all group"
      >
        <!-- Activity dot -->
        <div class="flex items-start justify-between mb-3">
          <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
            {{ initials(c.name) }}
          </div>
          <span
            :class="['block h-2.5 w-2.5 rounded-full mt-1', isActive(c) ? 'bg-green-400' : 'bg-gray-200']"
            :title="isActive(c) ? 'Recently active' : 'Inactive'"
          />
        </div>

        <h3 class="font-semibold text-gray-900 group-hover:text-primary transition-colors truncate">{{ c.name }}</h3>
        <p class="text-xs text-gray-400 mt-0.5">House {{ c.houseNumber }}</p>

        <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div class="bg-gray-50 rounded-xl p-2 text-center">
            <p class="font-bold text-gray-900">{{ c.totalJobs }}</p>
            <p class="text-gray-400">Jobs</p>
          </div>
          <div class="bg-gray-50 rounded-xl p-2 text-center">
            <p class="font-bold text-gray-900">{{ c.totalSpent }}</p>
            <p class="text-gray-400">KES</p>
          </div>
        </div>
      </NuxtLink>
    </div>

    <!-- Error state -->
    <div v-else-if="loadError" class="flex flex-col items-center py-16 text-gray-400 gap-2">
      <span class="material-symbols-outlined" style="font-size:48px;">cloud_off</span>
      <p class="text-sm">Could not load customers</p>
      <button class="text-sm font-semibold text-primary hover:underline" @click="load()">Try again</button>
    </div>

    <!-- Empty state -->
    <div v-else class="flex flex-col items-center py-16 text-gray-400 gap-2">
      <span class="material-symbols-outlined" style="font-size:48px;">group_off</span>
      <p class="text-sm">{{ activeSearch ? 'No customers match your search' : 'No customers found' }}</p>
    </div>

    <!-- Pager -->
    <div v-if="total > PAGE_SIZE" class="flex items-center justify-between text-sm text-gray-500">
      <p>Showing {{ rangeStart }}–{{ rangeEnd }} of {{ total }}</p>
      <div class="flex gap-2">
        <button
          :disabled="page <= 1 || loading"
          class="px-3 py-1.5 rounded-lg border border-gray-200 bg-white font-medium hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          @click="goTo(page - 1)"
        >
          Previous
        </button>
        <button
          :disabled="page >= pageCount || loading"
          class="px-3 py-1.5 rounded-lg border border-gray-200 bg-white font-medium hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          @click="goTo(page + 1)"
        >
          Next
        </button>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'
import type { Customer } from '~/types'

definePageMeta({ layout: 'admin', middleware: 'auth', requiresAuth: true, role: 'admin' })

// 24 divides evenly into the 2/3/4-column grids.
const PAGE_SIZE = 24

const admin      = useAdminStore()
const search     = ref('')
const activeSearch = ref('')   // the term the visible results were actually fetched with
const page       = ref(1)
const loading    = ref(false)
const loadError  = ref(false)

const customers  = computed<Customer[]>(() => admin.customers)
const total      = computed(() => admin.customersTotal)
const pageCount  = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))
const rangeStart = computed(() => (total.value === 0 ? 0 : (page.value - 1) * PAGE_SIZE + 1))
const rangeEnd   = computed(() => Math.min(page.value * PAGE_SIZE, total.value))

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase()
}

function isActive(c: Customer) {
  // A customer is "active" if they have any pending/printing/ready job
  return admin.jobs.some(j =>
    (j.houseNumber === c.houseNumber || j.customerName === c.name) &&
    ['pending', 'printing', 'ready'].includes(j.status)
  )
}

// The store already drops stale responses; this keeps the flags below in step with it.
let loadSeq = 0
async function load() {
  const seq  = ++loadSeq
  const term = search.value.trim()
  loading.value   = true
  loadError.value = false
  try {
    await admin.fetchCustomers({ page: page.value, size: PAGE_SIZE, search: term })
    if (seq === loadSeq) activeSearch.value = term
  } catch {
    if (seq === loadSeq) loadError.value = true
  } finally {
    if (seq === loadSeq) loading.value = false
  }
}

function goTo(p: number) {
  page.value = Math.min(Math.max(1, p), pageCount.value)
  load()
}

const searchDebounced = useDebounceFn(() => {
  page.value = 1
  load()
}, 300)

watch(search, () => searchDebounced())

onMounted(load)
</script>
