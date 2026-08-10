<template>
  <main class="pt-16 px-margin-mobile flex flex-col gap-xl pb-8">

    <!-- Greeting -->
    <section class="mt-sm">
      <h1 class="font-headline-lg-mobile text-headline-lg-mobile text-on-surface font-bold">
        Hello {{ firstName }}
      </h1>
      <p class="font-label-bold text-label-bold" style="color: #F97316;">
        House {{ auth.user?.houseNumber }}
      </p>
    </section>

    <!-- Active / recent spotlight -->
    <section>
      <div class="flex justify-between items-center mb-md">
        <h2 class="font-label-bold text-label-bold text-on-surface-variant uppercase">
          {{ hasActiveJobs ? 'Active orders' : 'Recent orders' }}
        </h2>
      </div>

      <div v-if="jobs.loading" class="flex flex-col gap-md">
        <div v-for="n in 2" :key="n" class="bg-surface-container rounded-xl p-md h-24 animate-pulse" />
      </div>

      <div v-else-if="spotlightJobs.length === 0" class="bg-surface-container rounded-xl p-lg text-center">
        <span class="material-symbols-outlined text-outline text-4xl">inbox</span>
        <p class="font-body-sm text-body-sm text-on-surface-variant mt-sm">
          No print jobs yet. Tap "New print job" to get started.
        </p>
      </div>

      <div v-else class="flex flex-col gap-md">
        <div
          v-for="job in spotlightJobs"
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

          <!-- Compact 5-step progress tracker -->
          <div class="flex items-center mt-xs">
            <template v-for="(s, i) in progressSteps" :key="s.key">
              <div
                :class="[
                  'w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0',
                  stepIndex(job.status) > i
                    ? 'bg-secondary-container'
                    : stepIndex(job.status) === i
                    ? 'bg-primary'
                    : 'bg-surface-container-high',
                ]"
              >
                <span
                  v-if="stepIndex(job.status) > i"
                  class="material-symbols-outlined text-white"
                  style="font-size: 11px; font-variation-settings: 'wght' 700;"
                >check</span>
                <span
                  v-else
                  class="material-symbols-outlined"
                  :class="stepIndex(job.status) === i ? 'text-on-primary' : 'text-on-surface-variant'"
                  style="font-size: 11px;"
                >{{ s.icon }}</span>
              </div>
              <div
                v-if="i < progressSteps.length - 1"
                :class="['h-[2px] flex-1', stepIndex(job.status) > i ? 'bg-secondary-container' : 'bg-outline-variant']"
              ></div>
            </template>
          </div>
        </div>
      </div>
    </section>

    <!-- New print job CTA -->
    <NuxtLink to="/app/new-job" class="block">
      <button
        class="w-full h-12 rounded-xl text-on-primary font-label-bold text-label-bold uppercase tracking-widest flex items-center justify-center gap-sm active:scale-[0.98] transition-transform"
        style="background-color: #F97316;"
      >
        <span class="material-symbols-outlined text-[20px]">add</span>
        New print job
      </button>
    </NuxtLink>

    <!-- Stats bar -->
    <section class="grid grid-cols-3 gap-sm">
      <div class="bg-surface-container rounded-xl p-sm flex flex-col items-center gap-xs">
        <span class="font-headline-md text-headline-md text-primary font-bold">{{ jobs.jobsThisMonth }}</span>
        <span class="font-label-bold text-[10px] text-on-surface-variant text-center uppercase leading-tight">Jobs this month</span>
      </div>
      <!-- <div class="bg-surface-container rounded-xl p-sm flex flex-col items-center gap-xs">
        <span class="font-headline-md text-headline-md text-primary font-bold">{{ auth.user?.loyaltyPoints ?? 0 }}</span>
        <span class="font-label-bold text-[10px] text-on-surface-variant text-center uppercase leading-tight">Loyalty pts</span>
      </div>
      <div class="bg-surface-container rounded-xl p-sm flex flex-col items-center gap-xs">
        <span class="font-headline-md text-headline-md text-primary font-bold">{{ auth.user?.creditBalance ?? 0 }}</span>
        <span class="font-label-bold text-[10px] text-on-surface-variant text-center uppercase leading-tight">Credit KES</span>
      </div> -->
    </section>

    <!-- Recent orders (only shown when spotlight is showing active jobs) -->
    <section v-if="hasActiveJobs && recentJobs.length > 0">
      <div class="flex justify-between items-center mb-md">
        <h2 class="font-label-bold text-label-bold text-on-surface-variant uppercase">Recent orders</h2>
        <NuxtLink to="/app/orders" class="font-label-bold text-label-bold" style="color: #F97316;">See all →</NuxtLink>
      </div>
      <div class="flex flex-col gap-md">
        <div
          v-for="job in recentJobs"
          :key="job.id"
          @click="goToJob(job)"
          class="bg-surface-container rounded-xl p-md flex justify-between items-center cursor-pointer active:scale-[0.98] transition-transform"
        >
          <div class="flex-1 min-w-0 mr-sm">
            <p class="font-label-bold text-label-bold text-on-surface truncate">
              {{ job.fileName ?? 'Custom instructions' }}
            </p>
            <p class="font-body-sm text-body-sm text-on-surface-variant">{{ job.id }} · {{ formatDate(job.createdAt) }}</p>
          </div>
          <div class="flex flex-col items-end gap-xs flex-shrink-0">
            <span :class="statusBadgeClass(job.status)" class="text-[10px] font-bold px-2 py-1 rounded-full uppercase">
              {{ statusLabel(job.status) }}
            </span>
            <span class="font-body-sm text-body-sm text-on-surface-variant">KES {{ job.cost + job.deliveryFee }}</span>
          </div>
        </div>
      </div>
    </section>

  </main>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'customer', middleware: 'auth', requiresAuth: true, role: 'customer' })

const auth   = useAuthStore()
const jobs   = useJobsStore()
const router = useRouter()

onMounted(() => { if (!jobs.jobs.length) jobs.fetchMyJobs() })

const firstName     = computed(() => auth.user?.name?.split(' ')[0] ?? 'there')
const hasActiveJobs = computed(() => jobs.activeJobs.length > 0)

const spotlightJobs = computed(() =>
  hasActiveJobs.value ? jobs.activeJobs.slice(0, 3) : jobs.jobs.slice(0, 3)
)

const recentJobs = computed(() => jobs.jobs.slice(0, 3))

const progressSteps = [
  { key: 'received',  icon: 'inbox'          },
  { key: 'paid',      icon: 'payments'       },
  { key: 'printing',  icon: 'print'          },
  { key: 'ready',     icon: 'inventory_2'    },
  { key: 'delivered', icon: 'local_shipping' },
]

function stepIndex(status: string) {
  const s = status
  if (s === 'delivered') return 4
  if (s === 'ready')     return 3
  if (s === 'printing')  return 2
  return 0
}

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
  return new Date(iso).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })
}

function goToJob(job: any) {
  jobs.setActiveJob(job)
  router.push(`/app/orders/${job.id}`)
}
</script>
