<template>
  <div class="min-h-screen bg-surface flex flex-col">

    <!-- Top bar -->
    <header class="flex items-center gap-xs px-6 h-14 bg-primary">
      <span class="material-symbols-outlined text-on-primary">print</span>
      <div class="flex flex-col leading-tight">
        <span class="font-bold text-on-primary text-sm tracking-wide">PrintEase</span>
        <span class="text-on-primary/70 text-[10px] uppercase tracking-widest">Staff Portal</span>
      </div>
    </header>

    <!-- Form -->
    <main class="flex-grow flex flex-col justify-center px-6 py-10 max-w-sm mx-auto w-full">
      <h1 class="text-xl font-bold text-primary mb-1">Staff sign in</h1>
      <p class="text-sm text-on-surface-variant mb-8">For PrintEase team members only.</p>

      <!-- --field-accent swaps the shared field's orange focus ring for staff navy -->
      <form
        class="space-y-5"
        style="--field-accent: #021745"
        novalidate
        @submit.prevent="handleLogin"
      >

        <CommonTextField
          v-model="form.phone"
          label="Phone number"
          type="tel"
          placeholder="0712345678"
          autocomplete="username"
          inputmode="tel"
          enterkeyhint="next"
          autocapitalize="off"
          label-class="block text-sm font-semibold text-primary"
        />

        <CommonTextField
          v-model="form.password"
          label="Password"
          placeholder="••••••••"
          autocomplete="current-password"
          enterkeyhint="go"
          revealable
          label-class="block text-sm font-semibold text-primary"
        />

        <CommonAlertBanner tone="error" :message="auth.error" />

        <button
          type="submit"
          :disabled="auth.loading"
          :aria-busy="auth.loading"
          class="w-full h-12 bg-primary text-on-primary font-semibold uppercase tracking-widest rounded-lg active:scale-[0.98] transition-all flex items-center justify-center gap-sm disabled:opacity-60"
        >
          <CommonSpinner v-if="auth.loading" size="sm" />
          {{ auth.loading ? 'Signing in…' : 'Sign in' }}
        </button>
      </form>

      <div class="mt-12 pt-6 border-t border-outline-variant/40 text-center">
        <NuxtLink to="/auth" class="text-xs text-on-surface-variant/50 hover:text-on-surface-variant transition-colors">
          ← Customer login
        </NuxtLink>
      </div>
    </main>

  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })

const auth   = useAuthStore()
const router = useRouter()

const form = reactive({ phone: '', password: '' })

// Redirect already-logged-in staff
onMounted(() => {
  if (auth.isLoggedIn && auth.isAdmin) {
    router.replace(auth.user?.role === 'clerk' ? '/admin/queue' : '/admin')
  }
})

async function handleLogin() {
  await auth.adminLogin({ phone: form.phone, password: form.password })
  if (!auth.error) {
    router.push(auth.user?.role === 'clerk' ? '/admin/queue' : '/admin')
  }
}
</script>
