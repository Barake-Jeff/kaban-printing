<template>
  <main class="pt-16 px-margin-mobile pb-8 flex flex-col gap-xl">

    <!-- Personal info form -->
    <section>
      <h2 class="font-label-bold text-label-bold text-on-surface-variant uppercase mb-md">Personal info</h2>
      <div class="bg-surface-container-low rounded-xl p-md flex flex-col gap-md">

        <div class="flex flex-col gap-xs">
          <label class="font-label-bold text-label-bold text-primary">Full name</label>
          <input v-model="form.name" type="text" class="input-field" placeholder="Your full name" required />
        </div>

        <div class="flex flex-col gap-xs">
          <label class="font-label-bold text-label-bold text-primary">Phone number</label>
          <input
            :value="auth.user?.phone"
            type="tel"
            class="input-field opacity-60 cursor-not-allowed"
            readonly
            title="Phone number cannot be changed"
          />
          <p class="font-body-sm text-body-sm text-on-surface-variant">Phone number changes require verification and are not available yet.</p>
        </div>

        <div class="grid grid-cols-2 gap-md">
          <div class="flex flex-col gap-xs">
            <label class="font-label-bold text-label-bold text-primary">House number</label>
            <input v-model="form.houseNumber" type="text" class="input-field" placeholder="e.g. 14B" required />
          </div>
          <div class="flex flex-col gap-xs">
            <label class="font-label-bold text-label-bold text-primary">Estate / Street</label>
            <input v-model="form.estate" type="text" class="input-field" placeholder="Street name" required />
          </div>
        </div>

        <p v-if="profileSuccess" class="text-green-600 font-body-sm text-body-sm">Profile updated successfully.</p>
        <p v-if="profileError" class="text-red-600 font-body-sm text-body-sm">{{ profileError }}</p>
      </div>

      <button
        @click="saveProfile"
        :disabled="users.loading"
        class="w-full h-12 rounded-xl text-on-primary font-label-bold text-label-bold uppercase tracking-widest mt-md active:scale-[0.98] transition-transform disabled:opacity-60"
        style="background-color: #F97316;"
      >
        {{ users.loading ? 'Saving…' : 'Save changes' }}
      </button>
    </section>

    <!-- Change password section -->
    <section id="password">
      <h2 class="font-label-bold text-label-bold text-on-surface-variant uppercase mb-md">Change password</h2>
      <div class="bg-surface-container-low rounded-xl p-md flex flex-col gap-md">

        <div class="flex flex-col gap-xs">
          <label class="font-label-bold text-label-bold text-primary">Current password</label>
          <div class="relative">
            <input
              v-model="passwords.current"
              :type="showCurrent ? 'text' : 'password'"
              class="input-field pr-12"
              placeholder="••••••••"
            />
            <button
              @click="showCurrent = !showCurrent"
              type="button"
              class="absolute right-3 top-3 text-outline hover:text-primary transition-colors"
            >
              <span class="material-symbols-outlined">{{ showCurrent ? 'visibility_off' : 'visibility' }}</span>
            </button>
          </div>
        </div>

        <div class="flex flex-col gap-xs">
          <label class="font-label-bold text-label-bold text-primary">New password</label>
          <div class="relative">
            <input
              v-model="passwords.newPass"
              :type="showNew ? 'text' : 'password'"
              class="input-field pr-12"
              placeholder="Minimum 8 characters"
            />
            <button
              @click="showNew = !showNew"
              type="button"
              class="absolute right-3 top-3 text-outline hover:text-primary transition-colors"
            >
              <span class="material-symbols-outlined">{{ showNew ? 'visibility_off' : 'visibility' }}</span>
            </button>
          </div>
        </div>

        <div class="flex flex-col gap-xs">
          <label class="font-label-bold text-label-bold text-primary">Confirm new password</label>
          <div class="relative">
            <input
              v-model="passwords.confirm"
              :type="showConfirm ? 'text' : 'password'"
              class="input-field pr-12"
              placeholder="Repeat new password"
            />
            <button
              @click="showConfirm = !showConfirm"
              type="button"
              class="absolute right-3 top-3 text-outline hover:text-primary transition-colors"
            >
              <span class="material-symbols-outlined">{{ showConfirm ? 'visibility_off' : 'visibility' }}</span>
            </button>
          </div>
        </div>

        <p v-if="passwordSuccess" class="text-green-600 font-body-sm text-body-sm">Password updated successfully.</p>
        <p v-if="passwordError"  class="text-red-600 font-body-sm text-body-sm">{{ passwordError }}</p>
      </div>

      <button
        @click="changePassword"
        :disabled="users.loading"
        class="w-full h-12 rounded-xl text-on-primary font-label-bold text-label-bold uppercase tracking-widest mt-md active:scale-[0.98] transition-transform disabled:opacity-60"
        style="background-color: #1B2D5B;"
      >
        {{ users.loading ? 'Updating…' : 'Update password' }}
      </button>
    </section>

    <!-- Danger zone -->
    <section>
      <h2 class="font-label-bold text-label-bold text-on-surface-variant uppercase mb-md">Danger zone</h2>
      <div class="bg-surface-container-low rounded-xl p-md">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-sm">
            <span class="material-symbols-outlined text-red-500">delete</span>
            <span class="font-body-lg text-body-lg text-red-600">Delete account</span>
          </div>
        </div>
        <p class="font-body-sm text-body-sm text-on-surface-variant mt-sm">
          To delete your account, please contact support via WhatsApp.
        </p>
      </div>
    </section>

  </main>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'customer', middleware: 'auth', requiresAuth: true, role: 'customer' })

const auth   = useAuthStore()
const users  = useUsersStore()
const router = useRouter()

const form = reactive({
  name:        auth.user?.name        ?? '',
  houseNumber: auth.user?.houseNumber ?? '',
  estate:      auth.user?.estate      ?? '',
})

const passwords = reactive({
  current: '',
  newPass: '',
  confirm: '',
})

const showCurrent    = ref(false)
const showNew        = ref(false)
const showConfirm    = ref(false)
const profileSuccess = ref(false)
const profileError   = ref('')
const passwordSuccess = ref(false)
const passwordError   = ref('')

async function saveProfile() {
  profileError.value   = ''
  profileSuccess.value = false
  await users.updateProfile({ name: form.name, houseNumber: form.houseNumber, estate: form.estate })
  profileSuccess.value = true
  setTimeout(() => router.push('/app/profile'), 1200)
}

async function changePassword() {
  passwordError.value   = ''
  passwordSuccess.value = false
  if (passwords.newPass.length < 8) {
    passwordError.value = 'New password must be at least 8 characters.'
    return
  }
  if (passwords.newPass !== passwords.confirm) {
    passwordError.value = 'Passwords do not match.'
    return
  }
  await users.changePassword({ currentPassword: passwords.current, newPassword: passwords.newPass })
  passwordSuccess.value = true
  passwords.current = ''
  passwords.newPass = ''
  passwords.confirm = ''
}
</script>

<style scoped>
.input-field {
  width: 100%;
  height: 3rem;
  padding-left: 16px;
  padding-right: 16px;
  background: white;
  border: 1px solid #c5c6d0;
  border-radius: 12px;
  font-size: 16px;
  line-height: 24px;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.input-field:focus {
  border-color: #fd761a;
  box-shadow: 0 0 0 1px #fd761a;
}
</style>
