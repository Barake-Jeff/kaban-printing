<template>
  <div class="bg-background text-on-surface min-h-screen pb-32">

    <!-- TopAppBar -->
    <header
      class="fixed top-0 w-full z-50 h-12 flex justify-between items-center px-margin-mobile"
      style="background-color: #1B2D5B;"
    >
      <div class="flex items-center gap-md">
        <button
          @click="router.push({ name: 'app' })"
          class="text-on-primary active:scale-95 transition-transform"
        >
          <span class="material-symbols-outlined" style="font-variation-settings:'wght' 600;">arrow_back</span>
        </button>
        <h1 class="font-headline-md text-headline-md text-on-primary font-bold">{{ job?.id }}</h1>
      </div>
      <div class="text-on-primary/80 font-label-bold text-label-bold uppercase">
        {{ isComplete ? '' : topBarStatus }}
      </div>
    </header>

    <main class="pt-16 px-margin-mobile flex flex-col gap-xl">

      <!-- ══════════════════════════════════════════════════════════
           COMPLETE STATE (delivered)
           ══════════════════════════════════════════════════════════ -->
      <template v-if="isComplete">

        <!-- Status label + badge -->
        <div class="flex justify-between items-center">
          <span class="font-label-bold text-label-bold text-on-surface-variant uppercase tracking-widest">Order Status</span>
          <div class="bg-[#1b8e3e] text-white px-sm py-1 rounded-[4px] font-status-badge text-status-badge">
            COMPLETE WITH RECEIPT
          </div>
        </div>

        <!-- All-complete progress tracker (full-width orange line behind) -->
        <section class="relative px-2">
          <div class="absolute top-4 left-0 w-full h-[2px] bg-secondary-container z-0"></div>
          <div class="flex justify-between relative z-10">
            <div v-for="s in progressSteps" :key="s.key" class="flex flex-col items-center gap-xs">
              <div class="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center text-white">
                <span class="material-symbols-outlined text-[18px]" style="font-variation-settings:'wght' 700;">check</span>
              </div>
              <span class="font-label-bold text-[10px] text-center leading-tight">{{ s.label }}</span>
            </div>
          </div>
        </section>

        <!-- Full receipt card -->
        <section class="bg-surface-container-lowest p-md relative overflow-hidden rounded-xl">
          <div class="absolute top-4 right-4 border-4 border-[#1b8e3e]/30 text-[#1b8e3e]/40 px-4 py-1 rounded font-bold text-headline-lg -rotate-12 select-none pointer-events-none uppercase">
            PAID
          </div>

          <div class="flex flex-col gap-md">
            <div class="flex flex-col gap-1">
              <span class="text-on-surface-variant font-label-bold text-label-bold">Receipt Ref: PE-{{ job?.id?.split('-')[1] }}</span>
              <span class="text-on-surface font-body-sm text-body-sm">{{ formatDate(job?.updatedAt) }}</span>
            </div>

            <div class="flex items-start gap-sm">
              <span class="material-symbols-outlined text-primary-container">person</span>
              <div class="flex flex-col">
                <span class="font-label-bold text-label-bold">{{ auth.user?.name }}</span>
                <span class="text-on-surface-variant font-body-sm text-body-sm">House {{ auth.user?.houseNumber }}, {{ auth.user?.estate }}</span>
              </div>
            </div>

            <div class="bg-surface-container p-md flex flex-col gap-sm rounded-xl">
              <div class="flex justify-between items-start">
                <div class="flex flex-col">
                  <span class="font-label-bold text-label-bold">{{ job?.fileName ?? 'Custom instructions' }}</span>
                  <span class="text-on-surface-variant text-body-sm font-body-sm">
                    {{ job?.colorMode === 'bw' ? 'B&W' : 'Colour' }} · {{ job?.paperSize ?? 'A4' }} · {{ job?.sides === 'double' ? 'Double-sided' : 'Single-sided' }} · {{ job?.pages }} Pages
                  </span>
                </div>
                <span class="material-symbols-outlined text-on-surface-variant">description</span>
              </div>
            </div>

            <div class="flex flex-col gap-sm pt-sm border-t border-outline-variant">
              <div class="flex justify-between text-body-sm font-body-sm">
                <span class="text-on-surface-variant">Print cost</span>
                <span>KES {{ job?.cost?.toFixed(2) }}</span>
              </div>
              <div class="flex justify-between text-body-sm font-body-sm">
                <span class="text-on-surface-variant">Delivery fee</span>
                <span>KES {{ (job?.deliveryFee ?? 0).toFixed(2) }}</span>
              </div>
              <div class="flex justify-between items-end pt-sm">
                <span class="font-label-bold text-label-bold uppercase">Total Amount</span>
                <span class="font-headline-md text-headline-md text-secondary-container">
                  KES {{ ((job?.cost ?? 0) + (job?.deliveryFee ?? 0)).toFixed(2) }}
                </span>
              </div>
            </div>

            <div class="bg-surface-container-low p-sm rounded flex items-center justify-between border-l-4 border-secondary-container">
              <div class="flex flex-col">
                <span class="font-label-bold text-[10px] text-on-surface-variant uppercase">Payment Method</span>
                <span class="text-body-sm font-label-bold">
                  {{ job?.paymentMethod === 'mpesa' ? `M-Pesa (Ref: ${job?.mpesaRef ?? '—'})` : 'Cash on pickup' }}
                </span>
              </div>
              <span class="material-symbols-outlined text-secondary-container">verified_user</span>
            </div>
          </div>
        </section>

        <!-- Action buttons -->
        <div class="flex gap-md items-center justify-center pb-xl">
          <button
            class="flex-1 text-on-primary h-12 rounded-lg flex items-center justify-center gap-sm active:scale-95 transition-transform"
            style="background-color: #F97316;"
          >
            <span class="material-symbols-outlined text-[20px]">download</span>
            <span class="font-label-bold text-label-bold">Save PDF</span>
          </button>
          <button
            class="flex-1 text-on-primary h-12 rounded-lg flex items-center justify-center gap-sm active:scale-95 transition-transform"
            style="background-color: #F97316;"
          >
            <span class="material-symbols-outlined text-[20px]">share</span>
            <span class="font-label-bold text-label-bold">Share</span>
          </button>
        </div>

      </template>

      <!-- ══════════════════════════════════════════════════════════
           IN-PROGRESS STATE (pending / printing / ready)
           ══════════════════════════════════════════════════════════ -->
      <template v-else>

        <!-- In-progress progress tracker with dynamic connectors -->
        <section class="mt-xl mb-xl">
          <div class="flex justify-between items-start w-full px-xs">
            <template v-for="(s, i) in progressSteps" :key="s.key">
              <div class="flex flex-col items-center gap-xs flex-1">
                <div
                  v-if="i < activeStep"
                  class="w-8 h-8 rounded-full bg-secondary-container text-on-primary flex items-center justify-center relative z-10"
                >
                  <span class="material-symbols-outlined text-[18px]" style="font-variation-settings:'FILL' 0,'wght' 700;">check</span>
                </div>
                <div
                  v-else-if="i === activeStep"
                  class="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center relative z-10 pulse-dot"
                >
                  <span class="material-symbols-outlined text-[18px]" :style="filledIcon">{{ s.icon }}</span>
                </div>
                <div
                  v-else
                  class="w-8 h-8 rounded-full bg-surface-container-high text-on-surface-variant flex items-center justify-center relative z-10"
                >
                  <span class="material-symbols-outlined text-[18px]">{{ s.icon }}</span>
                </div>
                <span
                  :class="[
                    'font-label-bold text-label-bold text-center',
                    i === activeStep ? 'text-primary' : i < activeStep ? 'text-on-surface' : 'text-on-surface-variant opacity-50'
                  ]"
                >{{ s.label }}</span>
              </div>
              <div
                v-if="i < progressSteps.length - 1"
                :class="['h-[2px] flex-1 self-center -mx-4 mt-[-20px]', i < activeStep ? 'bg-secondary-container' : 'bg-outline-variant']"
              ></div>
            </template>
          </div>
        </section>

        <!-- Job details card -->
        <div class="bg-surface-container p-md flex flex-col gap-md rounded-xl">
          <div class="flex items-start gap-md border-b border-outline-variant pb-md">
            <div class="w-12 h-12 bg-white rounded-lg flex items-center justify-center shrink-0">
              <span class="material-symbols-outlined text-primary text-[28px]">description</span>
            </div>
            <div class="flex flex-col">
              <h2 class="font-headline-md text-headline-md text-primary truncate max-w-[200px] font-bold">
                {{ job?.fileName ?? 'Custom instructions' }}
              </h2>
              <p class="font-body-sm text-body-sm text-on-surface-variant font-normal">
                Order confirmed {{ formatDate(job?.createdAt) }}
              </p>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-y-md gap-x-gutter">
            <div class="flex flex-col gap-xs">
              <span class="font-label-bold text-label-bold text-on-surface-variant uppercase">Pages</span>
              <span class="font-body-lg text-body-lg">{{ job?.pages }} Pages</span>
            </div>
            <div class="flex flex-col gap-xs">
              <span class="font-label-bold text-label-bold text-on-surface-variant uppercase">Copies</span>
              <span class="font-body-lg text-body-lg">{{ job?.copies }} {{ job?.copies === 1 ? 'Copy' : 'Copies' }}</span>
            </div>
            <div class="flex flex-col gap-xs">
              <span class="font-label-bold text-label-bold text-on-surface-variant uppercase">Colour mode</span>
              <span class="font-body-lg text-body-lg">{{ job?.colorMode === 'bw' ? 'Black & white' : 'Colour' }}</span>
            </div>
            <div class="flex flex-col gap-xs">
              <span class="font-label-bold text-label-bold text-on-surface-variant uppercase">Delivery type</span>
              <span class="font-body-lg text-body-lg capitalize">{{ job?.deliveryType }}</span>
            </div>
            <div class="flex flex-col gap-xs col-span-2 pt-sm border-t border-outline-variant">
              <span class="font-label-bold text-label-bold text-on-surface-variant uppercase">Estimated ready time</span>
              <div class="flex items-center gap-xs text-secondary">
                <span class="material-symbols-outlined text-[16px]">schedule</span>
                <span class="font-body-lg text-body-lg">{{ estimatedReady }}</span>
              </div>
            </div>
          </div>

          <!-- Notification toggles -->
          <!-- <div class="mt-md pt-md border-t border-outline-variant flex flex-col gap-md">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-sm">
                <span class="material-symbols-outlined text-on-surface-variant">sms</span>
                <span class="font-body-lg text-body-lg font-normal">Notify me via SMS</span>
              </div>
              <div class="relative inline-flex items-center cursor-pointer" @click="notifSms = !notifSms">
                <div :class="['w-11 h-6 rounded-full transition-colors relative', notifSms ? 'bg-secondary-container' : 'bg-outline-variant']">
                  <div :class="['absolute top-[2px] left-[2px] bg-white w-5 h-5 rounded-full transition-transform', notifSms ? 'translate-x-5' : '']"></div>
                </div>
              </div>
            </div>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-sm">
                <span class="material-symbols-outlined text-on-surface-variant">chat</span>
                <span class="font-body-lg text-body-lg font-normal">Notify me via WhatsApp</span>
              </div>
              <div class="relative inline-flex items-center cursor-pointer" @click="notifWhatsapp = !notifWhatsapp">
                <div :class="['w-11 h-6 rounded-full transition-colors relative', notifWhatsapp ? 'bg-secondary-container' : 'bg-outline-variant']">
                  <div :class="['absolute top-[2px] left-[2px] bg-white w-5 h-5 rounded-full transition-transform', notifWhatsapp ? 'translate-x-5' : '']"></div>
                </div>
              </div>
            </div>
          </div> -->
        </div>

        <!-- Help section -->
        <section class="text-center pb-xl">
          <p class="font-body-sm text-body-sm text-on-surface-variant mb-sm font-normal">Something wrong with your order?</p>
          <button
            class="w-full h-12 rounded-lg text-on-primary font-label-bold text-label-bold uppercase active:scale-95 transition-transform"
            style="background-color: #F97316;"
          >
            Contact Support
          </button>
        </section>

      </template>
    </main>

    <!-- Bottom nav — Orders tab active -->
    <nav class="fixed bottom-0 w-full z-50 bg-surface-container-lowest border-t border-outline-variant flex justify-around items-center h-16 px-xs">
      <NuxtLink
        to="/app"
        class="flex flex-col items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors px-4 py-1 rounded-full active:scale-90"
      >
        <span class="material-symbols-outlined">home</span>
        <span class="font-label-bold text-label-bold">Home</span>
      </NuxtLink>
      <NuxtLink
        :to="{ name: 'app-new-job' }"
        class="flex flex-col items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors px-4 py-1 rounded-full active:scale-90"
      >
        <span class="material-symbols-outlined">print_connect</span>
        <span class="font-label-bold text-label-bold">Services</span>
      </NuxtLink>
      <div class="flex flex-col items-center justify-center bg-secondary-container text-on-secondary-container rounded-full px-4 py-1 active:scale-90">
        <span class="material-symbols-outlined" style="font-variation-settings:'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24;">receipt_long</span>
        <span class="font-label-bold text-label-bold">Orders</span>
      </div>
      <div class="flex flex-col items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors px-4 py-1 rounded-full active:scale-90">
        <span class="material-symbols-outlined">person</span>
        <span class="font-label-bold text-label-bold">Profile</span>
      </div>
    </nav>

  </div>
</template>

<script setup lang="ts">
import { JOBS } from '~/data/dummy'

definePageMeta({
  middleware: 'auth',
  requiresAuth: true,
  role: 'customer',
})

const route  = useRoute()
const router = useRouter()
const auth   = useAuthStore()
const jobs   = useJobsStore()

const jobId = computed(() => {
  const id = route.params.id
  return Array.isArray(id) ? id[0] : id
})

const job = computed(() =>
  jobs.activeJob?.id === jobId.value
    ? jobs.activeJob
    : JOBS.find(j => j.id === jobId.value)
)

const notifSms      = ref(job.value?.notifySms      ?? true)
const notifWhatsapp = ref(job.value?.notifyWhatsapp  ?? false)
const filledIcon    = "font-variation-settings:'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24;"

const isComplete = computed(() => job.value?.status === 'delivered')

const progressSteps = [
  { key: 'received',  label: 'Received',  icon: 'inbox'          },
  { key: 'paid',      label: 'Paid',      icon: 'payments'       },
  { key: 'printing',  label: 'Printing',  icon: 'print'          },
  { key: 'ready',     label: 'Ready',     icon: 'inventory_2'    },
  { key: 'delivered', label: 'Delivered', icon: 'local_shipping' },
]

const activeStep = computed(() => {
  const s = job.value?.status
  const p = job.value?.paymentStatus
  if (s === 'delivered') return 4
  if (s === 'ready')     return 3
  if (s === 'printing')  return 2
  if (p === 'paid')      return 1
  return 0
})

const topBarStatus = computed(() => {
  return ['Received', 'Paid', 'In Progress', 'Ready', 'Delivered'][activeStep.value] ?? 'In Progress'
})

const estimatedReady = computed(() => {
  if (!job.value?.updatedAt) return 'Calculating…'
  const d = new Date(job.value.updatedAt)
  d.setMinutes(d.getMinutes() + 30)
  return 'Today, ' + d.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })
})

function formatDate(iso: string | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })
}
</script>

<style scoped>
@keyframes pulse-dot {
  0%   { transform: scale(.9); }
  50%  { transform: scale(1.05); }
  100% { transform: scale(.9); }
}
.pulse-dot {
  animation: pulse-dot 1.25s cubic-bezier(0.455, 0.03, 0.515, 0.955) infinite;
}
</style>
