<template>
  <header class="fixed top-0 w-full z-50 flex justify-between items-center px-margin-mobile h-12 bg-primary-container">

    <!-- Brand — links home: landing page when signed out, the user's own home when signed in -->
    <NuxtLink
      :to="homeLink"
      class="flex items-center gap-xs active:scale-95 transition-transform"
      aria-label="Go to home"
    >
      <span class="material-symbols-outlined text-on-primary">print</span>
      <span class="font-headline-md text-headline-md font-bold text-on-primary">PrintEase</span>
    </NuxtLink>

    <!-- Login action, hidden once signed in -->
    <template v-if="!auth.isLoggedIn">
      <!-- On the auth page itself we switch tabs rather than navigate -->
      <button
        v-if="loginAction === 'emit'"
        @click="$emit('login-click')"
        class="font-label-bold text-label-bold px-md py-sm rounded-lg active:scale-95 transition-transform"
        style="background-color: #F97316; color: #5c2400;"
      >
        Login
      </button>
      <NuxtLink
        v-else
        to="/auth"
        class="font-label-bold text-label-bold px-md py-sm rounded-lg active:scale-95 transition-transform"
        style="background-color: #F97316; color: #5c2400;"
      >
        Login
      </NuxtLink>
    </template>

  </header>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    /** 'link' navigates to /auth; 'emit' fires `login-click` instead (used on the auth page). */
    loginAction?: 'link' | 'emit'
  }>(),
  { loginAction: 'link' },
)

defineEmits<{ 'login-click': [] }>()

const auth = useAuthStore()

// Mirrors the redirect rule in middleware/auth.ts so "home" is consistent app-wide
const homeLink = computed(() => {
  if (!auth.isLoggedIn) return '/'
  return auth.isAdmin ? '/admin' : '/app'
})
</script>
