<template>
  <div class="bg-background text-on-background min-h-screen flex flex-col">

    <!-- TopAppBar -->
    <header
      class="fixed top-0 w-full z-50 text-on-primary flex justify-between items-center px-margin-mobile h-12"
      style="background-color: #1B2D5B;"
    >
      <div class="flex items-center gap-base">
        <button @click="router.push({ name: 'app' })" aria-label="Back" class="active:scale-95 transition-transform">
          <span class="material-symbols-outlined">arrow_back</span>
        </button>
        <span class="font-headline-md text-headline-md font-bold text-on-primary">PrintEase</span>
      </div>
      <div class="flex items-center">
        <span class="material-symbols-outlined text-on-primary">print</span>
      </div>
    </header>

    <!-- Main content -->
    <main class="flex-grow pt-16 pb-32 px-margin-mobile">

      <!-- Heading -->
      <section class="mb-lg mt-sm">
        <h1 class="font-headline-lg-mobile text-headline-lg-mobile text-primary mb-xs font-bold">
          How would you like to pay?
        </h1>
        <p class="font-body-lg text-body-lg text-on-surface-variant">
          {{ job?.id }} · KES {{ job?.cost ?? 0 }}
        </p>
      </section>

      <div class="space-y-md">

        <!-- ── M-Pesa card ── -->
        <div
          :class="[
            'overflow-hidden transition-all duration-300 rounded-xl',
            selectedPayment === 'mpesa'
              ? 'bg-[#FFF7ED] border-2 border-secondary-container'
              : 'bg-surface-container-low border border-transparent'
          ]"
        >
          <!-- Card header (tap to select) -->
          <div class="p-md flex items-start gap-md cursor-pointer" @click="selectedPayment = 'mpesa'">
            <!-- Radio dot -->
            <div class="mt-base">
              <div
                :class="[
                  'w-5 h-5 rounded-full border-2 flex items-center justify-center',
                  selectedPayment === 'mpesa'
                    ? 'border-secondary-container'
                    : 'border-outline'
                ]"
              >
                <div v-if="selectedPayment === 'mpesa'" class="w-2.5 h-2.5 rounded-full bg-secondary-container"></div>
              </div>
            </div>
            <div class="flex-grow">
              <div class="flex items-center gap-xs mb-xs">
                <span class="material-symbols-outlined text-secondary">phone_iphone</span>
                <h3 class="font-headline-md text-headline-md text-primary font-bold">M-Pesa STK Push</h3>
              </div>
              <p class="font-body-sm text-body-sm text-on-surface-variant leading-tight">
                Instant prompt on your phone. Confirm with your PIN.
              </p>
            </div>
          </div>

          <!-- Expanded M-Pesa panel -->
          <div v-if="selectedPayment === 'mpesa'" class="px-md pb-md flex flex-col gap-md">
            <div class="relative">
              <label class="block font-label-bold text-label-bold text-on-surface-variant mb-xs">
                M-Pesa Phone Number
              </label>
              <input
                :value="auth.user?.phone"
                type="text"
                readonly
                class="w-full bg-surface-container-lowest border-2 border-outline-variant rounded-lg h-12 px-md font-body-lg text-on-surface focus:outline-none focus:border-secondary-container"
              />
            </div>

            <!-- Pay button (idle state) -->
            <button
              v-if="mpesaState === 'idle'"
              @click="payMpesa"
              class="w-full h-12 text-white font-headline-md text-headline-md rounded-lg active:scale-95 transition-transform"
              style="background-color: #F97316;"
            >
              Pay KES {{ job?.cost ?? 0 }} via M-Pesa
            </button>

            <!-- Waiting state -->
            <div v-if="mpesaState === 'waiting'" class="flex flex-col gap-md">
              <div class="flex items-center justify-center gap-sm py-sm">
                <span class="material-symbols-outlined text-on-surface-variant spinner">progress_activity</span>
                <p class="font-body-sm text-body-sm text-on-surface-variant">Waiting for M-Pesa confirmation…</p>
              </div>
            </div>

            <!-- Success state -->
            <div v-if="mpesaState === 'success'" class="flex items-center justify-center gap-sm py-sm">
              <span class="material-symbols-outlined text-green-600" style="font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;">check_circle</span>
              <p class="font-body-sm text-body-sm text-green-700 font-semibold">Payment confirmed! Your job is in the queue.</p>
            </div>

            <!-- Error state -->
            <div v-if="mpesaState === 'error'" class="flex flex-col gap-sm">
              <p class="font-body-sm text-body-sm text-red-600 text-center">Payment failed. Please try again.</p>
              <button
                @click="mpesaState = 'idle'"
                class="w-full h-10 border border-outline rounded-lg font-label-bold text-label-bold text-on-surface active:scale-95 transition-transform"
              >Try again</button>
            </div>
          </div>
        </div>

        <!-- ── Pay on pickup card (hidden for delivery orders) ── -->
        <div
          v-if="job?.deliveryType !== 'delivery'"
          :class="[
            'overflow-hidden transition-all duration-300 rounded-xl',
            selectedPayment === 'pickup'
              ? 'bg-[#FFF7ED] border-2 border-secondary-container'
              : 'bg-surface-container-low border border-transparent'
          ]"
        >
          <!-- Card header -->
          <div class="p-md flex items-start gap-md cursor-pointer" @click="selectedPayment = 'pickup'">
            <div class="mt-base">
              <div
                :class="[
                  'w-5 h-5 rounded-full border-2 flex items-center justify-center',
                  selectedPayment === 'pickup'
                    ? 'border-secondary-container'
                    : 'border-outline'
                ]"
              >
                <div v-if="selectedPayment === 'pickup'" class="w-2.5 h-2.5 rounded-full bg-secondary-container"></div>
              </div>
            </div>
            <div class="flex-grow">
              <div class="flex items-center gap-xs mb-xs">
                <span class="material-symbols-outlined text-primary">store</span>
                <h3 class="font-headline-md text-headline-md text-primary font-bold">Pay on pickup</h3>
              </div>
              <p class="font-body-sm text-body-sm text-on-surface-variant leading-tight">
                Cash or M-Pesa when you collect. Job enters queue now.
              </p>
            </div>
          </div>

          <!-- Expanded pickup panel -->
          <div v-if="selectedPayment === 'pickup'" class="px-md pb-md flex flex-col gap-md">
            <p class="font-body-sm text-body-sm text-on-surface-variant italic">
              Your job joins the queue immediately. Pay KES {{ job?.cost ?? 0 }} when you arrive.
            </p>
            <button
              @click="payOnPickup"
              class="w-full h-12 bg-primary text-on-primary font-headline-md text-headline-md rounded-lg active:scale-95 transition-transform"
            >
              Confirm — pay on pickup
            </button>
          </div>
        </div>

      </div>

      <!-- Note -->
      <p class="mt-xl font-body-sm text-body-sm text-on-surface-variant italic text-center">
        Pay on pickup is not available for delivery orders
      </p>

    </main>

    <!-- Footer -->
    <footer class="w-full bg-surface-container text-on-surface-variant flex flex-col items-center gap-sm py-xl px-margin-mobile text-center">
      <span class="font-headline-md text-headline-md text-primary">PrintEase</span>
      <div class="flex flex-wrap justify-center gap-md">
        <span class="font-body-sm text-body-sm hover:text-secondary transition-colors cursor-pointer">Business Hours</span>
        <span class="font-body-sm text-body-sm hover:text-secondary transition-colors cursor-pointer">WhatsApp Support</span>
        <span class="font-body-sm text-body-sm hover:text-secondary transition-colors cursor-pointer">Privacy Policy</span>
      </div>
      <p class="font-body-sm text-body-sm mt-sm opacity-80">© 2026 PrintEase. All rights reserved.</p>
    </footer>

  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
  requiresAuth: true,
  role: 'customer',
})

const router = useRouter()
const auth   = useAuthStore()
const jobs   = useJobsStore()

const selectedPayment = ref<'mpesa' | 'pickup'>('mpesa')
const mpesaState      = ref<'idle' | 'waiting' | 'success' | 'error'>('idle')

const job = computed(() => jobs.activeJob)

async function payMpesa() {
  mpesaState.value = 'waiting'
  const result = await jobs.initiateMpesa(job.value?.id)
  if (result.success) {
    mpesaState.value = 'success'
    setTimeout(() => {
      router.push({ name: 'app-orders-id', params: { id: job.value?.id } })
    }, 1800)
  } else {
    mpesaState.value = 'error'
  }
}

function payOnPickup() {
  router.push({ name: 'app-orders-id', params: { id: job.value?.id } })
}
</script>

<style scoped>
.spinner {
  animation: rotate 1s linear infinite;
}
@keyframes rotate {
  100% { transform: rotate(360deg); }
}
</style>
