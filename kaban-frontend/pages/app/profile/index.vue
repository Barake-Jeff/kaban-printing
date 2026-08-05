<template>
  <!-- Push toast -->
  <Transition name="fade">
    <div
      v-if="pushToast"
      class="fixed top-16 left-4 right-4 z-[100] bg-on-surface text-surface rounded-xl px-md py-sm font-body-sm text-body-sm shadow-lg"
    >{{ pushToast }}</div>
  </Transition>

  <main class="pt-16 pb-8">

    <!-- Profile header -->
    <section class="flex flex-col items-center gap-md px-margin-mobile py-xl bg-surface-container-low">
      <div
        class="w-20 h-20 rounded-full flex items-center justify-center text-on-primary font-bold text-2xl"
        style="background-color: #1B2D5B;"
      >
        {{ initials }}
      </div>
      <div class="text-center">
        <h1 class="font-headline-md text-headline-md text-on-surface font-bold">{{ auth.user?.name }}</h1>
        <p class="font-body-md text-body-md text-on-surface-variant">{{ auth.user?.phone }}</p>
      </div>
      <NuxtLink to="/app/profile/edit">
        <button
          class="h-10 px-xl rounded-full border border-outline font-label-bold text-label-bold text-on-surface active:scale-95 transition-transform flex items-center gap-xs"
        >
          <span class="material-symbols-outlined text-[18px]">edit</span>
          Edit profile
        </button>
      </NuxtLink>
    </section>

    <!-- Stats -->
    <section class="px-margin-mobile py-xl">
      <h2 class="font-label-bold text-label-bold text-on-surface-variant uppercase mb-md">Account stats</h2>
      <div class="grid grid-cols-2 gap-md">
        <div class="bg-surface-container rounded-xl p-md flex flex-col gap-xs">
          <span class="font-headline-md text-headline-md text-primary font-bold">{{ jobs.jobs.length }}</span>
          <span class="font-label-bold text-[11px] text-on-surface-variant uppercase">Total jobs</span>
        </div>
        <div class="bg-surface-container rounded-xl p-md flex flex-col gap-xs">
          <span class="font-headline-md text-headline-md text-primary font-bold">KES {{ jobs.totalSpent }}</span>
          <span class="font-label-bold text-[11px] text-on-surface-variant uppercase">Total spent</span>
        </div>
        <div class="bg-surface-container rounded-xl p-md flex flex-col gap-xs">
          <span class="font-headline-md text-headline-md text-primary font-bold">{{ auth.user?.loyaltyPoints ?? 0 }}</span>
          <span class="font-label-bold text-[11px] text-on-surface-variant uppercase">Loyalty points</span>
        </div>
        <div class="bg-surface-container rounded-xl p-md flex flex-col gap-xs">
          <span class="font-headline-md text-headline-md text-primary font-bold">KES {{ auth.user?.creditBalance ?? 0 }}</span>
          <span class="font-label-bold text-[11px] text-on-surface-variant uppercase">Credit balance</span>
        </div>
      </div>
    </section>

    <!-- Notifications -->
    <section class="px-margin-mobile pb-xl">
      <h2 class="font-label-bold text-label-bold text-on-surface-variant uppercase mb-md">Notifications</h2>
      <div class="bg-surface-container rounded-xl divide-y divide-outline-variant">

        <!-- Push notifications -->
        <div class="flex items-center justify-between p-md">
          <div class="flex items-center gap-sm flex-1 min-w-0">
            <span class="material-symbols-outlined text-on-surface-variant">notifications</span>
            <div>
              <span class="font-body-lg text-body-lg block">Push notifications</span>
              <span v-if="!isSupported" class="font-body-sm text-body-sm text-on-surface-variant">Not supported on this device</span>
              <span v-else-if="pushDenied" class="font-body-sm text-body-sm text-on-surface-variant">Allow in browser settings to enable</span>
            </div>
          </div>
          <div
            :class="['relative inline-flex items-center', isSupported && !pushDenied ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed']"
            @click="isSupported && !pushDenied && onPushToggle()"
          >
            <div :class="['w-11 h-6 rounded-full transition-colors relative', isGranted ? 'bg-secondary-container' : 'bg-outline-variant']">
              <div :class="['absolute top-[2px] left-[2px] bg-white w-5 h-5 rounded-full transition-transform shadow', isGranted ? 'translate-x-5' : '']"></div>
            </div>
          </div>
        </div>

        <!-- SMS -->
        <!-- <div class="flex items-center justify-between p-md">
          <div class="flex items-center gap-sm">
            <span class="material-symbols-outlined text-on-surface-variant">sms</span>
            <span class="font-body-lg text-body-lg">Notify me via SMS</span>
          </div>
          <div class="relative inline-flex items-center cursor-pointer" @click="toggleSms">
            <div :class="['w-11 h-6 rounded-full transition-colors relative', notifSms ? 'bg-secondary-container' : 'bg-outline-variant']">
              <div :class="['absolute top-[2px] left-[2px] bg-white w-5 h-5 rounded-full transition-transform shadow', notifSms ? 'translate-x-5' : '']"></div>
            </div>
          </div>
        </div> -->

        <!-- WhatsApp -->
        <!-- <div class="flex items-center justify-between p-md">
          <div class="flex items-center gap-sm">
            <span class="material-symbols-outlined text-on-surface-variant">chat</span>
            <span class="font-body-lg text-body-lg">Notify me via WhatsApp</span>
          </div>
          <div class="relative inline-flex items-center cursor-pointer" @click="toggleWhatsapp">
            <div :class="['w-11 h-6 rounded-full transition-colors relative', notifWhatsapp ? 'bg-secondary-container' : 'bg-outline-variant']">
              <div :class="['absolute top-[2px] left-[2px] bg-white w-5 h-5 rounded-full transition-transform shadow', notifWhatsapp ? 'translate-x-5' : '']"></div>
            </div>
          </div>
        </div> -->
      </div>
    </section>

    <!-- Security -->
    <section class="px-margin-mobile pb-xl">
      <h2 class="font-label-bold text-label-bold text-on-surface-variant uppercase mb-md">Security</h2>
      <div class="bg-surface-container rounded-xl">
        <NuxtLink to="/app/profile/edit#password" class="flex items-center justify-between p-md cursor-pointer active:bg-surface-container-high transition-colors rounded-xl">
          <div class="flex items-center gap-sm">
            <span class="material-symbols-outlined text-on-surface-variant">lock</span>
            <span class="font-body-lg text-body-lg">Change password</span>
          </div>
          <span class="material-symbols-outlined text-on-surface-variant">chevron_right</span>
        </NuxtLink>
      </div>
    </section>

    <!-- Support -->
    <section class="px-margin-mobile pb-xl">
      <h2 class="font-label-bold text-label-bold text-on-surface-variant uppercase mb-md">Support</h2>
      <div class="bg-surface-container rounded-xl divide-y divide-outline-variant">
        <a
          href="https://wa.me/254700000000"
          target="_blank"
          rel="noopener"
          class="flex items-center justify-between p-md cursor-pointer active:bg-surface-container-high transition-colors"
        >
          <div class="flex items-center gap-sm">
            <span class="material-symbols-outlined text-on-surface-variant">chat</span>
            <span class="font-body-lg text-body-lg">WhatsApp Support</span>
          </div>
          <span class="material-symbols-outlined text-on-surface-variant">open_in_new</span>
        </a>
        <div
          class="flex items-center justify-between p-md cursor-pointer active:bg-surface-container-high transition-colors rounded-b-xl"
          @click="showHours = !showHours"
        >
          <div class="flex items-center gap-sm">
            <span class="material-symbols-outlined text-on-surface-variant">schedule</span>
            <span class="font-body-lg text-body-lg">Business hours</span>
          </div>
          <span class="material-symbols-outlined text-on-surface-variant transition-transform" :class="showHours ? 'rotate-180' : ''">expand_more</span>
        </div>
        <div v-if="showHours" class="px-md pb-md text-on-surface-variant font-body-sm text-body-sm">
          Mon – Sat, 7 AM – 8 PM
        </div>
      </div>
    </section>

    <!-- Logout -->
    <div class="px-margin-mobile pb-xl">
      <button
        @click="handleLogout"
        class="w-full h-12 rounded-xl border font-label-bold text-label-bold uppercase tracking-widest active:scale-[0.98] transition-transform"
        style="background-color: #fef2f2; color: #dc2626; border-color: #fecaca;"
      >
        Log out
      </button>
    </div>

  </main>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'customer', middleware: 'auth', requiresAuth: true, role: 'customer' })

const auth   = useAuthStore()
const jobs   = useJobsStore()
const users  = useUsersStore()
const router = useRouter()
const { isSupported, isGranted, requestAndSubscribe, unsubscribe } = usePushNotifications()

onMounted(() => { if (!jobs.jobs.length) jobs.fetchMyJobs() })

const initials = computed(() => {
  const name = auth.user?.name ?? ''
  return name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
})

const notifSms      = ref(auth.user?.notifSms      ?? true)
const notifWhatsapp = ref(auth.user?.notifWhatsapp  ?? false)
const showHours     = ref(false)
const pushToast     = ref('')
const pushDenied    = computed(() =>
  typeof window !== 'undefined' && Notification.permission === 'denied'
)

async function onPushToggle() {
  if (isGranted.value) {
    await unsubscribe()
  } else {
    const result = await requestAndSubscribe()
    if (!result.success && result.reason === 'denied') {
      pushToast.value = 'To enable notifications, allow them in your browser settings.'
      setTimeout(() => { pushToast.value = '' }, 4000)
    }
  }
}

async function toggleSms() {
  notifSms.value = !notifSms.value
  await users.updateNotifPrefs({ notifSms: notifSms.value, notifWhatsapp: notifWhatsapp.value })
}

async function toggleWhatsapp() {
  notifWhatsapp.value = !notifWhatsapp.value
  await users.updateNotifPrefs({ notifSms: notifSms.value, notifWhatsapp: notifWhatsapp.value })
}

async function handleLogout() {
  await auth.logout()
  router.push('/')
}
</script>
