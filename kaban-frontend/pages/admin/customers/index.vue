<template>
  <div class="space-y-5">

    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center gap-3">
      <div class="flex-1">
        <h1 class="text-2xl font-bold text-gray-900">Customers</h1>
        <p class="text-sm text-gray-500 mt-0.5">{{ filteredCustomers.length }} customers</p>
      </div>
      <!-- Search -->
      <div class="relative">
        <span class="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400" style="font-size:18px;">search</span>
        <input
          v-model="search"
          type="text"
          placeholder="Search by name or house…"
          class="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl w-64 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
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

    <!-- Loading -->
    <div v-if="loading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      <AdminSkeletonCard v-for="i in 8" :key="i" />
    </div>

    <!-- Customer grid -->
    <div
      v-else-if="filteredCustomers.length > 0"
      class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
    >
      <NuxtLink
        v-for="c in filteredCustomers"
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

    <!-- Empty state -->
    <div v-else class="flex flex-col items-center py-16 text-gray-400 gap-2">
      <span class="material-symbols-outlined" style="font-size:48px;">group_off</span>
      <p class="text-sm">No customers found</p>
    </div>

  </div>
</template>

<script setup lang="ts">
import type { Customer } from '~/types'
import { CUSTOMERS } from '~/data/dummy'

definePageMeta({ layout: 'admin', middleware: 'auth', requiresAuth: true, role: 'admin' })

const admin   = useAdminStore()
const search  = ref('')
const loading = ref(false)

const customers = ref<Customer[]>([])

const filteredCustomers = computed(() => {
  const q = search.value.toLowerCase()
  if (!q) return customers.value
  return customers.value.filter(c =>
    c.name.toLowerCase().includes(q) ||
    c.houseNumber.toLowerCase().includes(q) ||
    c.phone?.toLowerCase().includes(q)
  )
})

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

onMounted(async () => {
  loading.value = true
  try {
    await admin.fetchCustomers()
    customers.value = admin.customers.length > 0 ? admin.customers : (CUSTOMERS as unknown as Customer[])
  } finally {
    loading.value = false
  }
})
</script>
