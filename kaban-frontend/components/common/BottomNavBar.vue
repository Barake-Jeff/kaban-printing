<template>
  <template v-if="authStore.isLoggedIn">
    <div class="md:hidden fixed bottom-0 w-full z-50 flex justify-around items-center h-16 bg-surface-container-lowest border-t border-outline-variant">
      <NuxtLink
        v-for="item in bottomNav"
        :key="item.label"
        :to="item.to"
        class="flex flex-col items-center justify-center px-4 py-1 rounded-full transition-transform active:scale-90 cursor-pointer"
        :class="item.active
          ? 'bg-secondary-container text-on-secondary-container'
          : 'text-on-surface-variant hover:bg-surface-container-high'"
      >
        <span
          class="material-symbols-outlined"
          :class="{ filled: item.active }"
        >{{ item.icon }}</span>
        <span class="font-label-bold text-label-bold">{{ item.label }}</span>
      </NuxtLink>
    </div>

    <!-- Spacer for fixed bottom nav on mobile -->
    <div class="h-16 md:hidden"></div>
  </template>
</template>

<script setup lang="ts">
const authStore = useAuthStore()

const bottomNav = [
  { label: 'Home',     icon: 'home',          to: '/',      active: true },
  { label: 'Services', icon: 'print_connect',  to: '/auth',  active: false },
  { label: 'Orders',   icon: 'receipt_long',   to: '/auth',  active: false },
  { label: 'Profile',  icon: 'person',         to: '/auth',  active: false },
]
</script>
